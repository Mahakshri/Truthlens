"""
Image deepfake detector. Backbone is selectable: 'vit' (ViT-B/16 via timm)
or 'efficientnet' (EfficientNet-B4 via timm), both pretrained on ImageNet
and fine-tuned with a binary head (real=0, fake=1).
"""
import timm
import torch
import torch.nn as nn


class DeepfakeImageDetector(nn.Module):
    def __init__(self, backbone: str = "vit", pretrained: bool = True, dropout: float = 0.3):
        super().__init__()
        self.backbone_name = backbone

        if backbone == "vit":
            self.backbone = timm.create_model("vit_base_patch16_224", pretrained=pretrained, num_classes=0)
            feat_dim = self.backbone.num_features
        elif backbone == "efficientnet":
            self.backbone = timm.create_model("efficientnet_b4", pretrained=pretrained, num_classes=0)
            feat_dim = self.backbone.num_features
        else:
            raise ValueError(f"Unknown backbone: {backbone}. Use 'vit' or 'efficientnet'.")

        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(feat_dim, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(256, 1),  # single logit, sigmoid -> P(fake)
        )

    def forward(self, x):
        feats = self.backbone(x)
        logit = self.classifier(feats)
        return logit.squeeze(-1)

    def input_size(self):
        return 224 if self.backbone_name == "vit" else 380  # EfficientNet-B4 native res
