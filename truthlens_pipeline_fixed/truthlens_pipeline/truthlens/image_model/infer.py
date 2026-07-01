"""
Standalone inference for a single image using a trained checkpoint.

Usage:
    python image_model/infer.py --checkpoint checkpoints/image_model_best.pt --image path/to/image.jpg
"""
import argparse
import sys
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

sys.path.append(str(Path(__file__).resolve().parent.parent))
from image_model.model import DeepfakeImageDetector


def load_model(checkpoint_path, device):
    ckpt = torch.load(checkpoint_path, map_location=device)
    model = DeepfakeImageDetector(backbone=ckpt["backbone"], pretrained=False).to(device)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    return model


def predict_image(model, image_path, device):
    image_size = model.input_size()
    transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    img = Image.open(image_path).convert("RGB")
    tensor = transform(img).unsqueeze(0).to(device)

    with torch.no_grad():
        logit = model(tensor)
        prob_fake = torch.sigmoid(logit).item()

    return {
        "label": "fake" if prob_fake > 0.5 else "real",
        "confidence": prob_fake if prob_fake > 0.5 else 1 - prob_fake,
        "fake_probability": prob_fake,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", required=True)
    parser.add_argument("--image", required=True)
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = load_model(args.checkpoint, device)
    result = predict_image(model, args.image, device)
    print(result)


if __name__ == "__main__":
    main()
