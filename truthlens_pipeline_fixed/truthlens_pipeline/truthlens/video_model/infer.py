"""
Standalone inference for a single video using a trained checkpoint.

Usage:
    python video_model/infer.py --checkpoint checkpoints/video_model_best.pt --video path/to/video.mp4
"""
import argparse
import sys
from pathlib import Path

import torch

sys.path.append(str(Path(__file__).resolve().parent.parent))
from video_model.dataset import DeepfakeVideoDataset, sample_frame_indices
from video_model.model import ResNeXtLSTMDetector
import cv2
from torchvision import transforms


def load_model(checkpoint_path, device):
    ckpt = torch.load(checkpoint_path, map_location=device)
    model = ResNeXtLSTMDetector(pretrained=False).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model, ckpt["frames_per_clip"]


def load_clip(path, frames_per_clip, image_size=224):
    transform = transforms.Compose([
        transforms.ToPILImage(),
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    cap = cv2.VideoCapture(str(path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    indices = set(sample_frame_indices(total, frames_per_clip))
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

    ordered = sample_frame_indices(total, frames_per_clip)
    clip = [frames[i] for i in ordered if i in frames]
    while len(clip) < frames_per_clip and len(clip) > 0:
        clip.append(clip[-1])
    return torch.stack(clip).unsqueeze(0)  # (1, T, C, H, W)


def predict_video(model, video_path, frames_per_clip, device):
    clip = load_clip(video_path, frames_per_clip).to(device)
    with torch.no_grad():
        logit = model(clip)
        prob_fake = torch.sigmoid(logit).item()
    return {
        "label": "fake" if prob_fake > 0.5 else "real",
        "confidence": prob_fake if prob_fake > 0.5 else 1 - prob_fake,
        "fake_probability": prob_fake,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--video", required=True)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model, frames_per_clip = load_model(args.checkpoint, device)
    result = predict_video(model, args.video, frames_per_clip, device)
    print(result)


if __name__ == "__main__":
    main()
