<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6845f04b-4d2b-4f52-b4f7-8f2f9a055101

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Connecting the Truthlens ML backend

The "Real-Time Telemetry Lab" section calls a separate FastAPI service
(`truthlens_pipeline/truthlens/api/main.py`) that runs the actual image and
video deepfake detector models. The frontend talks to it through `/api/*`,
which Vite proxies to `http://localhost:8000` in dev (override with
`VITE_API_PROXY_TARGET`).

1. In the pipeline repo:
   ```bash
   cd truthlens_pipeline/truthlens
   pip install -r requirements.txt
   ```
2. **Train the models first.** There are no pretrained checkpoints included —
   the CSVs in this project (`FVC.csv`, etc.) only contain video URLs and
   labels, not actual image/video data, so nothing has been trained yet. Point
   `image_model/train.py` and `video_model/train.py` at a real labeled
   dataset (FaceForensics++, DFDC, Celeb-DF v2 — see the pipeline README for
   details) to produce `checkpoints/image_model_best.pt` and
   `checkpoints/video_model_best.pt`.
3. Start the API:
   ```bash
   uvicorn api.main:app --reload --port 8000
   ```
4. Run the frontend (`npm run dev`) alongside it. The lab page shows a live
   "Verification API connected / offline" indicator, and uploaded files are
   sent to `/verify/image` or `/verify/video` for a real prediction — if no
   checkpoint is loaded yet, the UI surfaces that clearly instead of failing
   silently. The three "scripted demo samples" are illustrative only and are
   never sent to the API.
