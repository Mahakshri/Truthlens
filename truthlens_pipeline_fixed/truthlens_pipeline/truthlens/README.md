# Truthlens — Training Pipeline

This is a working, runnable training pipeline for the image and video deepfake
detectors described in the Truthlens spec, plus a FastAPI inference service
that fuses their outputs into a trust score. It is built to run as-is once you
point it at a real labeled dataset.

## Why this isn't pre-trained on your uploaded files

The CSVs you provided (`FVC.csv`, `FVC_dup.csv`, `FVC_text_queries.csv`) are
from the Fake Video Corpus — they contain only YouTube/Facebook **URLs** and
`real`/`fake` labels (380 unique videos), not actual video/frame data. There's
no audio or image data either. That's not enough to train a CNN/ViT from
scratch, and the raw videos aren't included, so no model in this repo has been
trained yet. What's here is the complete pipeline: once you download a proper
dataset, you run one script and get a trained model + checkpoint.

## Recommended datasets (free, commonly used for this exact task)

- **FaceForensics++** (image + video frames, 5 manipulation methods) — best starting point for the image detector.
- **DFDC (Deepfake Detection Challenge)** — large video dataset, good for the ResNeXt+LSTM video model.
- **Celeb-DF v2** — high-quality deepfakes, good for evaluation/generalization testing.
- You can also use your FVC URLs as a video *download list* — see `utils/download_fvc_videos.py`, which will pull the actual videos for you (subject to many being dead links, which is normal for this dataset).

## Project structure

```
truthlens/
├── image_model/        # ViT / EfficientNet-B4 image deepfake detector
│   ├── dataset.py
│   ├── model.py
│   ├── train.py
│   └── infer.py
├── video_model/         # ResNeXt50 + LSTM video deepfake detector
│   ├── dataset.py
│   ├── model.py
│   ├── train.py
│   └── infer.py
├── utils/
│   ├── face_extraction.py     # MTCNN face cropper used by both pipelines
│   └── download_fvc_videos.py # optional: pull videos from your FVC.csv
├── api/
│   └── main.py          # FastAPI service: /verify/image, /verify/video, /verify/trust-score
├── requirements.txt
└── README.md
```

## Expected dataset layout

Both training scripts expect a simple folder-per-class layout, which is what
you get after running standard FaceForensics++/DFDC preprocessing scripts
(face-cropped frames):

```
data/
├── images/
│   ├── train/
│   │   ├── real/*.jpg
│   │   └── fake/*.jpg
│   └── val/
│       ├── real/*.jpg
│       └── fake/*.jpg
└── videos/
    ├── train/
    │   ├── real/*.mp4
    │   └── fake/*.mp4
    └── val/
        ├── real/*.mp4
        └── fake/*.mp4
```

If you only have raw videos for the image model, run
`utils/face_extraction.py` first to extract face crops as JPGs into the
layout above (1 frame every N frames, face-cropped).

## Quickstart

```bash
pip install -r requirements.txt

# 1. (optional) extract face-cropped frames from raw videos for the image model
python utils/face_extraction.py --input_dir data/raw_videos --output_dir data/images --every_n_frames 10

# 2. train the image detector (ViT or EfficientNet-B4)
python image_model/train.py --data_dir data/images --backbone vit --epochs 15 --batch_size 32

# 3. train the video detector (ResNeXt50 + LSTM)
python video_model/train.py --data_dir data/videos --epochs 20 --batch_size 8 --frames_per_clip 20

# 4. serve both models behind FastAPI for your website
uvicorn api.main:app --reload --port 8000
```

Checkpoints are saved to `checkpoints/image_model_best.pt` and
`checkpoints/video_model_best.pt`. `api/main.py` loads both automatically and
exposes REST endpoints you can call directly from your website's backend.

## Integrating with your website

Once trained, your frontend/backend just calls the FastAPI service:

- `POST /verify/image` — multipart image upload → `{ "label": "fake", "confidence": 0.93, "score": 0.07 }`
- `POST /verify/video` — multipart video upload → same shape, computed over sampled frames
- `POST /verify/trust-score` — combine image/video result + metadata (from `utils`) into a single 0–100 Trust Index, matching the spec's Trust Scoring Engine

The metadata/provenance and audio-visual sync modules from the original spec
are not full ML models in this first pass (no labeled training data exists
for them in your uploads either) — `api/main.py` includes a clearly-marked
rule-based stand-in for metadata/provenance scoring that you can replace with
a trained model later the same way the image/video ones are structured.
