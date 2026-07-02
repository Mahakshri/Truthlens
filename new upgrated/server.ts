import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware for parsing large bodies (for base64 images)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini API Client
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Ensure dataset directory exists
const datasetDir = path.join(process.cwd(), 'dataset');
if (!fs.existsSync(datasetDir)) {
  fs.mkdirSync(datasetDir, { recursive: true });
}

// 1. API: Get details about Kaggle Datasets and Preloaded Sample Cases
const datasetsMetadata = {
  datasets: [
    {
      id: "deepfake-detection-challenge",
      name: "Deepfake Detection Challenge (DFDC)",
      url: "https://www.kaggle.com/competitions/deepfake-detection-challenge/data",
      description: "The premier competition hosted by Facebook, Microsoft, and partnerships, targeting video deepfakes. Contains thousands of manipulated and original high-fidelity videos featuring diverse actors.",
      size: "470 GB (Full)",
      features: ["Temporal Flickering", "Audio-Visual Lip Sync Errors", "Inconsistent Facial Boundaries"],
      applications: ["Forensics", "News Journalism", "Cybersecurity Verification"]
    },
    {
      id: "artifact-dataset",
      name: "Artifact Dataset",
      url: "https://www.kaggle.com/datasets/awsaf49/artifact-dataset",
      description: "A large-scale multi-class dataset containing both real and synthetic images generated using 25 different generative methods (GANs, Diffusion Models, etc.). Excellent for spotting diffusion-based synthetic textures.",
      size: "105 GB",
      features: ["Diffusion Artifacts", "Structural Anomalies", "Synthetic Fingerprints"],
      applications: ["Generative Art Detection", "Adversarial Image Auditing"]
    },
    {
      id: "deepfake-and-real-images",
      name: "Deepfake and Real Images",
      url: "https://www.kaggle.com/datasets/manjilkarki/deepfake-and-real-images",
      description: "A balanced benchmark dataset focusing on real vs computer-generated face comparisons, helping models specialize in human facial synthesis detection.",
      size: "1.8 GB",
      features: ["Facial Symmetry Analysis", "Eye Reflective Inconsistencies", "Synthesized Skin Grain"],
      applications: ["KYC Fraud Prevention", "Digital ID Verification"]
    },
    {
      id: "real-and-fake-face-detection",
      name: "Real and Fake Face Detection",
      url: "https://www.kaggle.com/datasets/ciplab/real-and-fake-face-detection",
      description: "An expert-annotated collection of real and manipulated faces (swapped, blended, morphed), designed for testing local visual manipulation algorithms.",
      size: "1.2 GB",
      features: ["Blending Edges", "Color Matching Discrepancies", "Lighting Gradient Errors"],
      applications: ["Digital Forensics", "Law Enforcement Evidence Validation"]
    }
  ],
  samples: [
    {
      id: "sample-1",
      name: "AI Generated Portrait (Diffusion)",
      type: "image",
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600",
      isFake: true,
      label: "SYNTHETIC",
      description: "An ultra-realistic human portrait featuring typical diffusion smoothing, minor asymmetrical jewelry artifacts, and an abstract background structure."
    },
    {
      id: "sample-2",
      name: "Authentic Photo Journalist Shot",
      type: "image",
      url: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&q=80&w=600",
      isFake: false,
      label: "REAL",
      description: "An original high-resolution photograph taken on a professional DSLR, showing natural sensor noise, camera EXIF tags, and true depth-of-field lighting gradients."
    },
    {
      id: "sample-3",
      name: "Synthesized Voice / Audio Sync",
      type: "audio",
      url: "", // local/mock audio
      isFake: true,
      label: "MANIPULATED",
      description: "Audio snippet exhibiting minor digital phase canceling, voice-cloning cadence inconsistencies, and brief millisecond delays in mouth sync."
    },
    {
      id: "sample-4",
      name: "Face Swap Video Deepfake",
      type: "video",
      url: "", // local/mock video
      isFake: true,
      label: "MANIPULATED",
      description: "Video segment of a political speech showing micro-flicker on the neck boundary line and mismatched temporal shadows when rotating."
    }
  ]
};

// Write metadata to dataset folder
fs.writeFileSync(
  path.join(datasetDir, 'metadata.json'),
  JSON.stringify(datasetsMetadata, null, 2)
);

// Create a download script template inside dataset directory to satisfy "make different folder for the dataset"
const downloadScript = `#!/bin/bash
# Truthlens Kaggle Dataset Downloader Helper Script
# This script is generated to assist downloading the full/sample datasets for development.
# Usage: ./download_kaggle.sh [dataset_id]

export KAGGLE_API_TOKEN="KGAT_eddb47da13b385ac339bbacdb6ad2efa"

# Save token to credentials file
mkdir -p ~/.kaggle
echo "$KAGGLE_API_TOKEN" > ~/.kaggle/access_token
chmod 600 ~/.kaggle/access_token

echo "Kaggle API Authenticated successfully."

if [ "$1" == "deepfake-detection-challenge" ]; then
  echo "Downloading Deepfake Detection Challenge..."
  kaggle competitions download -c deepfake-detection-challenge -p ./deepfake-detection-challenge
elif [ "$1" == "artifact-dataset" ]; then
  echo "Downloading Artifact Dataset..."
  kaggle datasets download -d awsaf49/artifact-dataset -p ./artifact-dataset
elif [ "$1" == "deepfake-and-real-images" ]; then
  echo "Downloading Deepfake and Real Images..."
  kaggle datasets download -d manjilkarki/deepfake-and-real-images -p ./deepfake-and-real-images
elif [ "$1" == "real-and-fake-face-detection" ]; then
  echo "Downloading Real and Fake Face Detection..."
  kaggle datasets download -d ciplab/real-and-fake-face-detection -p ./real-and-fake-face-detection
else
  echo "Please specify a valid dataset id. Options:"
  echo "  - deepfake-detection-challenge"
  echo "  - artifact-dataset"
  echo "  - deepfake-and-real-images"
  echo "  - real-and-fake-face-detection"
fi
`;

fs.writeFileSync(path.join(datasetDir, 'download_kaggle.sh'), downloadScript);
fs.chmodSync(path.join(datasetDir, 'download_kaggle.sh'), '755');

app.get('/api/datasets', (req, res) => {
  res.json(datasetsMetadata);
});

// 2. API: Verify content via Gemini
app.post('/api/verify', async (req, res) => {
  try {
    const { mediaType, imageBase64, sampleId, description, name } = req.body;

    if (!aiClient) {
      return res.status(500).json({
        error: "Gemini API Client is not configured. Please supply a GEMINI_API_KEY in the Secrets panel."
      });
    }

    // Prepare content for Gemini
    let contents: any[] = [];
    let systemInstruction = `You are Truthlens, a world-class digital forensic expert and AI Content Provenance and Verification engine.
Your purpose is to thoroughly audit digital content (images, videos, or audio descriptions) to identify generative manipulation, diffusion artifacts, temporal inconsistencies, and synthetic origins.

You must evaluate and return a strict JSON response containing the analysis and a precise Trust Score.
`;

    const userPrompt = `Perform a comprehensive media forensics audit on this uploaded ${mediaType}.
Name: ${name || 'Uploaded File'}
Description provided by user or context: ${description || 'No additional description provided.'}

Your response must be returned in JSON format strictly matching this schema structure:
{
  "mediaType": "${mediaType}",
  "authenticityScore": number (0-100 where 100 is pure unedited reality, 0 is fully synthetic),
  "riskLevel": string ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL"),
  "confidenceScore": number (0-100 indicating analysis confidence),
  "trustIndex": number (0-100 incorporating provenance, metadata, and visual indicators),
  "verdict": string ("REAL" | "MANIPULATED" | "SYNTHETIC"),
  "spatialAnalysis": {
    "status": string ("PASSED" | "SUSPICIOUS" | "FAILED"),
    "score": number (0-100),
    "artifactsDetected": string[],
    "details": string (specific micro-details about textures, lighting, blending, or diffusion markers found or evaluated)
  },
  "temporalAnalysis": {
    "status": string ("PASSED" | "SUSPICIOUS" | "FAILED"),
    "score": number (0-100),
    "artifactsDetected": string[],
    "details": string (assessment of multi-frame flickering, edge transitions, or dynamic boundaries)
  },
  "audioVisualAnalysis": {
    "status": string ("PASSED" | "SUSPICIOUS" | "FAILED"),
    "score": number (0-100),
    "artifactsDetected": string[],
    "details": string (assessment of speech alignment, lip synchronization, frequency anomalies, or voice patterns)
  },
  "provenanceAnalysis": {
    "status": string ("PASSED" | "SUSPICIOUS" | "FAILED"),
    "score": number (0-100),
    "creationTimestamp": string (estimated, e.g. "2026-07-02" or extracted metadata),
    "deviceInfo": string (estimated capture hardware or edit software),
    "editingHistory": string[],
    "lineageGraph": {
      "nodes": [{"id": "1", "label": "Source", "type": "origin"}, {"id": "2", "label": "Processing", "type": "step"}, {"id": "3", "label": "Current View", "type": "result"}],
      "edges": [{"from": "1", "to": "2", "label": "modifications"}, {"from": "2", "to": "3", "label": "final render"}]
    },
    "details": string (forensic overview of metadata signatures and editing trails)
  },
  "summary": string (human-friendly forensic audit summary of your findings),
  "technicalExplanation": string (detailed technical explanation suitable for digital identity verification, law enforcement, or cybersecurity engineers)
}

Be analytical and point out precise clues (such as eye glint irregularities, chromatic aberration, sensor noise presence, facial edge softening, compression ratios, frequency domains, etc.).
`;

    if (mediaType === 'image' && imageBase64) {
      // Split header off if present
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const mimeType = imageBase64.includes(',') ? imageBase64.split(';')[0].split(':')[1] : 'image/png';

      contents = [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        {
          text: userPrompt
        }
      ];
    } else {
      // For audio/video/text description
      contents = [
        {
          text: `${userPrompt}\n\nAnalyzing description of physical characteristics/cues:\n${description || 'Generic uploaded media.'}`
        }
      ];
    }

    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mediaType: { type: Type.STRING },
            authenticityScore: { type: Type.INTEGER },
            riskLevel: { type: Type.STRING },
            confidenceScore: { type: Type.INTEGER },
            trustIndex: { type: Type.INTEGER },
            verdict: { type: Type.STRING },
            spatialAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                score: { type: Type.INTEGER },
                artifactsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
                details: { type: Type.STRING }
              },
              required: ["status", "score", "artifactsDetected", "details"]
            },
            temporalAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                score: { type: Type.INTEGER },
                artifactsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
                details: { type: Type.STRING }
              },
              required: ["status", "score", "artifactsDetected", "details"]
            },
            audioVisualAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                score: { type: Type.INTEGER },
                artifactsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
                details: { type: Type.STRING }
              },
              required: ["status", "score", "artifactsDetected", "details"]
            },
            provenanceAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                score: { type: Type.INTEGER },
                creationTimestamp: { type: Type.STRING },
                deviceInfo: { type: Type.STRING },
                editingHistory: { type: Type.ARRAY, items: { type: Type.STRING } },
                lineageGraph: {
                  type: Type.OBJECT,
                  properties: {
                    nodes: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          label: { type: Type.STRING },
                          type: { type: Type.STRING }
                        },
                        required: ["id", "label", "type"]
                      }
                    },
                    edges: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          from: { type: Type.STRING },
                          to: { type: Type.STRING },
                          label: { type: Type.STRING }
                        },
                        required: ["from", "to", "label"]
                      }
                    }
                  },
                  required: ["nodes", "edges"]
                },
                details: { type: Type.STRING }
              },
              required: ["status", "score", "creationTimestamp", "deviceInfo", "editingHistory", "lineageGraph", "details"]
            },
            summary: { type: Type.STRING },
            technicalExplanation: { type: Type.STRING }
          },
          required: ["mediaType", "authenticityScore", "riskLevel", "confidenceScore", "trustIndex", "verdict", "spatialAnalysis", "temporalAnalysis", "audioVisualAnalysis", "provenanceAnalysis", "summary", "technicalExplanation"]
        }
      }
    });

    const parsedResponse = JSON.parse(response.text || '{}');
    res.json(parsedResponse);

  } catch (error: any) {
    console.error("Forensic analysis error:", error);
    res.status(500).json({
      error: "Failed to perform forensic audit. " + (error.message || error)
    });
  }
});

// Configure Vite middleware in development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Truthlens Backend listening on port ${PORT}`);
  });
}

startServer();
