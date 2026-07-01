"""
Truthlens inference API. Loads trained image/video checkpoints (if present)
and exposes REST endpoints your website backend can call directly.

Run:
    uvicorn api.main:app --reload --port 8000

Endpoints:
    POST /verify/image        multipart file upload -> image deepfake result
    POST /verify/video        multipart file upload -> video deepfake result
    POST /verify/trust-score  combine results + basic metadata into a Trust Index
    GET  /health               readiness check, reports which models are loaded
"""
import io
import sys
import tempfile
from pathlib import Path

import torch
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

sys.path.append(str(Path(__file__).resolve().parent.parent))
from image_model.model import DeepfakeImageDetector
from video_model.model import ResNeXtLSTMDetector
from video_model.dataset import sample_frame_indices
from torchvision import transforms
import cv2

app = FastAPI(title="Truthlens Verification API", version="0.1.0")

# Allow your website frontend to call this directly during development.
# Tighten allow_origins to your real domain before going to production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CHECKPOINT_DIR = Path(__file__).resolve().parent.parent / "checkpoints"

image_model = None
image_model_backbone = None
video_model = None
video_frames_per_clip = None


def _try_load_image_model():
    global image_model, image_model_backbone
    ckpt_path = CHECKPOINT_DIR / "image_model_best.pt"
    if not ckpt_path.exists():
        return
    ckpt = torch.load(ckpt_path, map_location=DEVICE)
    model = DeepfakeImageDetector(backbone=ckpt["backbone"], pretrained=False).to(DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    image_model = model
    image_model_backbone = ckpt["backbone"]


def _try_load_video_model():
    global video_model, video_frames_per_clip
    ckpt_path = CHECKPOINT_DIR / "video_model_best.pt"
    if not ckpt_path.exists():
        return
    ckpt = torch.load(ckpt_path, map_location=DEVICE)
    model = ResNeXtLSTMDetector(pretrained=False).to(DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    video_model = model
    video_frames_per_clip = ckpt["frames_per_clip"]


@app.on_event("startup")
def startup_event():
    _try_load_image_model()
    _try_load_video_model()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "image_model_loaded": image_model is not None,
        "video_model_loaded": video_model is not None,
        "device": str(DEVICE),
    }


class TrustScoreRequest(BaseModel):
    fake_probability: float           # from /verify/image or /verify/video
    has_clean_metadata: bool = True   # e.g. no edited-by tags, consistent EXIF timestamps
    source_known: bool = False        # e.g. verified publisher/account
    reverse_search_matches: int = 0   # number of near-duplicate matches found elsewhere (provenance signal)


@app.post("/verify/image")
async def verify_image(file: UploadFile = File(...)):
    if image_model is None:
        raise HTTPException(503, "Image model not loaded yet. Train it first: see README.md")

    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Could not read uploaded file as an image.")

    image_size = image_model.input_size()
    transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    tensor = transform(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logit = image_model(tensor)
        prob_fake = torch.sigmoid(logit).item()

    return {
        "label": "fake" if prob_fake > 0.5 else "real",
        "confidence": round(prob_fake if prob_fake > 0.5 else 1 - prob_fake, 4),
        "fake_probability": round(prob_fake, 4),
        "backbone": image_model_backbone,
    }


@app.post("/verify/video")
async def verify_video(file: UploadFile = File(...)):
    if video_model is None:
        raise HTTPException(503, "Video model not loaded yet. Train it first: see README.md")

    suffix = Path(file.filename).suffix or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        cap = cv2.VideoCapture(tmp_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            raise HTTPException(400, "Could not read frames from uploaded video.")

        indices = set(sample_frame_indices(total, video_frames_per_clip))
        frames = {}
        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx in indices:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames[idx] = transform(frame)
            idx += 1
        cap.release()

        ordered = sample_frame_indices(total, video_frames_per_clip)
        clip = [frames[i] for i in ordered if i in frames]
        if len(clip) == 0:
            raise HTTPException(400, "No readable frames could be extracted from the uploaded video.")
        while len(clip) < video_frames_per_clip and len(clip) > 0:
            clip.append(clip[-1])

        clip_tensor = torch.stack(clip).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            logit = video_model(clip_tensor)
            prob_fake = torch.sigmoid(logit).item()
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return {
        "label": "fake" if prob_fake > 0.5 else "real",
        "confidence": round(prob_fake if prob_fake > 0.5 else 1 - prob_fake, 4),
        "fake_probability": round(prob_fake, 4),
        "frames_analyzed": video_frames_per_clip,
    }


@app.post("/verify/trust-score")
def trust_score(req: TrustScoreRequest):
    """
    Rule-based fusion stand-in for the spec's Trust Scoring Engine.
    This is NOT a trained model (no labeled trust-score data exists yet) --
    it's a transparent, tunable scoring function you can swap for a learned
    fusion model later using the exact same input/output contract.
    """
    authenticity = 1 - req.fake_probability  # 0..1, higher = more authentic

    metadata_score = 1.0 if req.has_clean_metadata else 0.4
    source_score = 1.0 if req.source_known else 0.6
    provenance_penalty = min(req.reverse_search_matches * 0.1, 0.5)
    provenance_score = max(0.0, 1.0 - provenance_penalty)

    weights = {"authenticity": 0.55, "metadata": 0.15, "source": 0.15, "provenance": 0.15}
    trust_index = (
        authenticity * weights["authenticity"]
        + metadata_score * weights["metadata"]
        + source_score * weights["source"]
        + provenance_score * weights["provenance"]
    ) * 100

    if trust_index >= 75:
        risk_level = "low"
    elif trust_index >= 45:
        risk_level = "medium"
    else:
        risk_level = "high"

    return {
        "trust_index": round(trust_index, 1),
        "risk_level": risk_level,
        "authenticity_score": round(authenticity * 100, 1),
        "components": {
            "metadata_score": round(metadata_score * 100, 1),
            "source_score": round(source_score * 100, 1),
            "provenance_score": round(provenance_score * 100, 1),
        },
    }
