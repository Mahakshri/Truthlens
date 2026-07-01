"""
Extract face-cropped frames from raw videos into a class-folder layout
suitable for image_model/train.py.

Expects input_dir laid out as:
    raw_videos/
        train/real/*.mp4
        train/fake/*.mp4
        val/real/*.mp4
        val/fake/*.mp4

Produces output_dir laid out as:
    images/
        train/real/*.jpg
        train/fake/*.jpg
        val/real/*.jpg
        val/fake/*.jpg

Usage:
    python utils/face_extraction.py --input_dir data/raw_videos --output_dir data/images --every_n_frames 10
"""
import argparse
import os
from pathlib import Path

import cv2
from facenet_pytorch import MTCNN
from tqdm import tqdm


def extract_faces_from_video(video_path, mtcnn, out_dir, every_n_frames=10, margin=20):
    cap = cv2.VideoCapture(str(video_path))
    frame_idx = 0
    saved = 0
    stem = Path(video_path).stem

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % every_n_frames == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            boxes, _ = mtcnn.detect(rgb)
            if boxes is not None:
                x1, y1, x2, y2 = [int(v) for v in boxes[0]]
                h, w = frame.shape[:2]
                x1, y1 = max(0, x1 - margin), max(0, y1 - margin)
                x2, y2 = min(w, x2 + margin), min(h, y2 + margin)
                face = frame[y1:y2, x1:x2]
                if face.size > 0:
                    out_path = out_dir / f"{stem}_f{frame_idx}.jpg"
                    cv2.imwrite(str(out_path), face)
                    saved += 1
        frame_idx += 1

    cap.release()
    return saved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input_dir", required=True)
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--every_n_frames", type=int, default=10)
    parser.add_argument("--device", default="cuda" if os.environ.get("USE_CUDA", "1") == "1" else "cpu")
    args = parser.parse_args()

    import torch
    device = args.device if torch.cuda.is_available() else "cpu"
    mtcnn = MTCNN(keep_all=False, device=device)

    input_root = Path(args.input_dir)
    output_root = Path(args.output_dir)

    splits = [d for d in input_root.iterdir() if d.is_dir()]
    for split_dir in splits:
        for class_dir in split_dir.iterdir():
            if not class_dir.is_dir():
                continue
            out_class_dir = output_root / split_dir.name / class_dir.name
            out_class_dir.mkdir(parents=True, exist_ok=True)

            videos = list(class_dir.glob("*.mp4")) + list(class_dir.glob("*.avi")) + list(class_dir.glob("*.mov"))
            total_saved = 0
            for video_path in tqdm(videos, desc=f"{split_dir.name}/{class_dir.name}"):
                total_saved += extract_faces_from_video(
                    video_path, mtcnn, out_class_dir, every_n_frames=args.every_n_frames
                )
            print(f"{split_dir.name}/{class_dir.name}: saved {total_saved} face crops from {len(videos)} videos")


if __name__ == "__main__":
    main()
