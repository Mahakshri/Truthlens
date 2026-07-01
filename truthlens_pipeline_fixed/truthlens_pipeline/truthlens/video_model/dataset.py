"""
Dataset loader for the video deepfake detector. Expects:
    data_dir/train/real/*.mp4, data_dir/train/fake/*.mp4
    data_dir/val/real/*.mp4,   data_dir/val/fake/*.mp4

Each item samples `frames_per_clip` evenly spaced frames from the video.
"""
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from torchvision import transforms

VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv"}


def sample_frame_indices(total_frames, n_frames):
    if total_frames <= n_frames:
        return list(range(total_frames)) + [total_frames - 1] * (n_frames - total_frames)
    return np.linspace(0, total_frames - 1, n_frames).astype(int).tolist()


class DeepfakeVideoDataset(Dataset):
    def __init__(self, root_dir, split="train", frames_per_clip=20, image_size=224):
        self.samples = []
        self.frames_per_clip = frames_per_clip
        split_dir = Path(root_dir) / split
        for label_name, label_val in [("real", 0), ("fake", 1)]:
            class_dir = split_dir / label_name
            if not class_dir.exists():
                continue
            for p in class_dir.iterdir():
                if p.suffix.lower() in VIDEO_EXTS:
                    self.samples.append((p, label_val))

        if len(self.samples) == 0:
            raise RuntimeError(
                f"No videos found under {split_dir}. Expected {split_dir}/real/*.mp4 and {split_dir}/fake/*.mp4"
            )

        if split == "train":
            self.transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((image_size, image_size)),
                transforms.RandomHorizontalFlip(),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.ToPILImage(),
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])

    def __len__(self):
        return len(self.samples)

    def _load_clip(self, path):
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            cap.release()
            raise RuntimeError(f"Could not read frames from {path}")

        indices = set(sample_frame_indices(total, self.frames_per_clip))
        frames = {}
        idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx in indices:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames[idx] = frame
            idx += 1
        cap.release()

        ordered_indices = sample_frame_indices(total, self.frames_per_clip)
        clip = [frames[i] for i in ordered_indices if i in frames]
        while len(clip) < self.frames_per_clip and len(clip) > 0:
            clip.append(clip[-1])  # pad with last good frame if some reads failed
        return clip

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        clip = self._load_clip(path)
        tensor_frames = torch.stack([self.transform(f) for f in clip])  # (T, C, H, W)
        return tensor_frames, torch.tensor(label, dtype=torch.float32)
