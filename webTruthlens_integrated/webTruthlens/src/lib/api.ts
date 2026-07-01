/**
 * Client for the Truthlens FastAPI inference service
 * (see truthlens_pipeline/truthlens/api/main.py).
 *
 * In dev, requests go through the Vite proxy at /api (see vite.config.ts),
 * which forwards to VITE_API_PROXY_TARGET (default http://localhost:8000).
 * This avoids CORS issues and keeps the deployed frontend pointed at
 * whatever backend URL you configure at build time via VITE_API_BASE_URL.
 */

export const API_BASE_URL: string =
  (import.meta as any).env?.VITE_API_BASE_URL || "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface VerifyResult {
  label: "real" | "fake";
  confidence: number; // 0..1
  fake_probability: number; // 0..1
  backbone?: string;
  frames_analyzed?: number;
}

export interface TrustScoreResult {
  trust_index: number; // 0..100
  risk_level: "low" | "medium" | "high";
  authenticity_score: number; // 0..100
  components: {
    metadata_score: number;
    source_score: number;
    provenance_score: number;
  };
}

export interface HealthResult {
  status: string;
  image_model_loaded: boolean;
  video_model_loaded: boolean;
  device: string;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    return JSON.stringify(data);
  } catch {
    return res.statusText || `Request failed with status ${res.status}`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (err) {
    // Network-level failure: backend unreachable, CORS blocked, offline, etc.
    throw new ApiError(
      "Could not reach the verification service. Is the Truthlens API running?",
      0
    );
  }

  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

export function checkHealth(): Promise<HealthResult> {
  return request<HealthResult>("/health");
}

export function verifyImage(file: File): Promise<VerifyResult> {
  const form = new FormData();
  form.append("file", file);
  return request<VerifyResult>("/verify/image", { method: "POST", body: form });
}

export function verifyVideo(file: File): Promise<VerifyResult> {
  const form = new FormData();
  form.append("file", file);
  return request<VerifyResult>("/verify/video", { method: "POST", body: form });
}

export interface TrustScoreInput {
  fake_probability: number;
  has_clean_metadata?: boolean;
  source_known?: boolean;
  reverse_search_matches?: number;
}

export function getTrustScore(input: TrustScoreInput): Promise<TrustScoreResult> {
  return request<TrustScoreResult>("/verify/trust-score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
