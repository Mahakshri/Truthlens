"""
Train the video deepfake detector (ResNeXt50 + LSTM).

Usage:
    python video_model/train.py --data_dir data/videos --epochs 20 --batch_size 8 --frames_per_clip 20
"""
import argparse
import sys
from pathlib import Path

import torch
import torch.nn as nn
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from torch.utils.data import DataLoader
from tqdm import tqdm

sys.path.append(str(Path(__file__).resolve().parent.parent))
from video_model.dataset import DeepfakeVideoDataset
from video_model.model import ResNeXtLSTMDetector


def evaluate(model, loader, device, criterion):
    model.eval()
    losses, all_preds, all_labels, all_probs = [], [], [], []
    with torch.no_grad():
        for clips, labels in loader:
            clips, labels = clips.to(device), labels.to(device)
            logits = model(clips)
            loss = criterion(logits, labels)
            losses.append(loss.item())
            probs = torch.sigmoid(logits)
            all_probs.extend(probs.cpu().numpy().tolist())
            all_preds.extend((probs > 0.5).float().cpu().numpy().tolist())
            all_labels.extend(labels.cpu().numpy().tolist())

    acc = accuracy_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds, zero_division=0)
    try:
        auc = roc_auc_score(all_labels, all_probs)
    except ValueError:
        auc = float("nan")
    return sum(losses) / len(losses), acc, f1, auc


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data_dir", required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--frames_per_clip", type=int, default=20)
    parser.add_argument("--lr", type=float, default=5e-5)
    parser.add_argument("--weight_decay", type=float, default=1e-5)
    parser.add_argument("--freeze_backbone", action="store_true",
                         help="Freeze ResNeXt50 weights, train only LSTM+head (faster, less data needed)")
    parser.add_argument("--num_workers", type=int, default=2)
    parser.add_argument("--checkpoint_dir", default="checkpoints")
    args = parser.parse_args()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    model = ResNeXtLSTMDetector(freeze_backbone=args.freeze_backbone).to(device)

    train_ds = DeepfakeVideoDataset(args.data_dir, split="train", frames_per_clip=args.frames_per_clip)
    val_ds = DeepfakeVideoDataset(args.data_dir, split="val", frames_per_clip=args.frames_per_clip)
    print(f"Train clips: {len(train_ds)} | Val clips: {len(val_ds)}")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                               num_workers=args.num_workers, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.num_workers, pin_memory=True)

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()), lr=args.lr, weight_decay=args.weight_decay
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)
    best_auc = -1.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0
        pbar = tqdm(train_loader, desc=f"Epoch {epoch}/{args.epochs}")
        for clips, labels in pbar:
            clips, labels = clips.to(device), labels.to(device)

            optimizer.zero_grad()
            logits = model(clips)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            pbar.set_postfix(loss=running_loss / (pbar.n + 1))

        scheduler.step()

        val_loss, val_acc, val_f1, val_auc = evaluate(model, val_loader, device, criterion)
        print(f"Epoch {epoch}: val_loss={val_loss:.4f} acc={val_acc:.4f} f1={val_f1:.4f} auc={val_auc:.4f}")

        torch.save({
            "model_state_dict": model.state_dict(),
            "frames_per_clip": args.frames_per_clip,
            "epoch": epoch,
            "val_auc": val_auc,
        }, ckpt_dir / "video_model_last.pt")

        if val_auc > best_auc:
            best_auc = val_auc
            torch.save({
                "model_state_dict": model.state_dict(),
                "frames_per_clip": args.frames_per_clip,
                "epoch": epoch,
                "val_auc": val_auc,
            }, ckpt_dir / "video_model_best.pt")
            print(f"  -> new best model saved (auc={val_auc:.4f})")

    print(f"Training complete. Best val AUC: {best_auc:.4f}")


if __name__ == "__main__":
    main()
