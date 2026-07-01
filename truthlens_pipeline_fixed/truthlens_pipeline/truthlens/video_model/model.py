"""
Video deepfake detector: ResNeXt50 extracts per-frame spatial features,
an LSTM models temporal consistency across the frame sequence, and a
classification head outputs a single fake-probability logit per clip.
"""
import torch
import torch.nn as nn
from torchvision import models


class ResNeXtLSTMDetector(nn.Module):
    def __init__(self, lstm_hidden=512, lstm_layers=2, dropout=0.4, pretrained=True, freeze_backbone=False):
        super().__init__()

        resnext = models.resnext50_32x4d(weights=models.ResNeXt50_32X4D_Weights.DEFAULT if pretrained else None)
        self.feature_dim = resnext.fc.in_features  # 2048
        self.backbone = nn.Sequential(*list(resnext.children())[:-1])  # drop final fc

        if freeze_backbone:
            for p in self.backbone.parameters():
                p.requires_grad = False

        self.lstm = nn.LSTM(
            input_size=self.feature_dim,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if lstm_layers > 1 else 0.0,
        )

        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(lstm_hidden * 2, 256),  # *2 for bidirectional
            nn.ReLU(inplace=True),
            nn.Dropout(dropout),
            nn.Linear(256, 1),
        )

    def forward(self, x):
        # x: (batch, frames, C, H, W)
        b, t, c, h, w = x.shape
        x = x.view(b * t, c, h, w)
        feats = self.backbone(x)              # (b*t, feature_dim, 1, 1)
        feats = feats.view(b, t, self.feature_dim)  # (b, t, feature_dim)

        lstm_out, (h_n, _) = self.lstm(feats)
        # use last timestep's combined forward/backward hidden state
        last_out = lstm_out[:, -1, :]         # (b, hidden*2)

        logit = self.classifier(last_out)
        return logit.squeeze(-1)
