"""
Dataset loader for the image deepfake detector. Expects:
    data_dir/train/real/*.jpg, data_dir/train/fake/*.jpg
    data_dir/val/real/*.jpg,   data_dir/val/fake/*.jpg
"""
from pathlib import Path

import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms

IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class DeepfakeImageDataset(Dataset):
    def __init__(self, root_dir, split="train", image_size=224):
        self.samples = []
        split_dir = Path(root_dir) / split
        for label_name, label_val in [("real", 0), ("fake", 1)]:
            class_dir = split_dir / label_name
            if not class_dir.exists():
                continue
            for p in class_dir.iterdir():
                if p.suffix.lower() in IMG_EXTS:
                    self.samples.append((p, label_val))

        if len(self.samples) == 0:
            raise RuntimeError(
                f"No images found under {split_dir}. Expected {split_dir}/real/*.jpg and {split_dir}/fake/*.jpg"
            )

        if split == "train":
            self.transform = transforms.Compose([
                transforms.Resize((image_size, image_size)),
                transforms.RandomHorizontalFlip(),
                transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
                transforms.RandomApply([transforms.GaussianBlur(3)], p=0.1),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
        else:
            self.transform = transforms.Compose([
                transforms.Resize((image_size, image_size)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.float32)
