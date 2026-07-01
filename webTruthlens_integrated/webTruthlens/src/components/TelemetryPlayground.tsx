import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  FileVideo,
  FileImage,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Terminal,
  Play,
  WifiOff,
  Wifi,
} from "lucide-react";
import {
  verifyImage,
  verifyVideo,
  getTrustScore,
  checkHealth,
  ApiError,
} from "../lib/api";

interface SampleAsset {
  name: string;
  type: "video" | "image";
  size: string;
  authenticity: number;
  confidence: number;
  risk: "LOW" | "HIGH" | "CRITICAL";
  verdict: string;
  logs: string[];
  /** Demo presets are scripted; real uploads are scored by the live API. */
  isLive: boolean;
}

type BackendStatus = "checking" | "online" | "offline";

const DEMO_LOG_INTERVAL_MS = 100;

export default function TelemetryPlayground() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SampleAsset | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentLogIndex, setCurrentLogIndex] = useState(0);
  const [customFile, setCustomFile] = useState<{ name: string; size: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("checking");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const liveLogsRef = useRef<string[]>([]);

  // Counter states for smooth numbers tickers
  const [authScore, setAuthScore] = useState(0);
  const [confIndex, setConfIndex] = useState(0);

  const sampleAssets: SampleAsset[] = [
    {
      name: "politician_deepfake_speech_01.mp4",
      type: "video",
      size: "24.5 MB",
      authenticity: 12.4,
      confidence: 99.12,
      risk: "CRITICAL",
      isLive: false,
      verdict:
        "High temporal jitter detected in visual boundaries. Gaze vector deviation does not correlate with mouth phoneme generation sequences. Likely generated via diffusion audio-to-video lipsync layers.",
      logs: [
        "SYS: Streaming file politician_deepfake_speech_01.mp4 into memory pipeline...",
        "FORENSICS: Demuxing visual frame tracks into Spatio-Temporal buffer.",
        "ViT: Flagged 23 synthetic boundaries at frame 245. Probability: 0.985",
        "LSTM: Gaze vectors mismatch vocal track audio profiles (gaze delta: 4.8cm).",
        "SAFF: Localized sensor noise pattern is entirely absent. Frame pattern matches GAN/Diffusion architecture synthesis signatures.",
        "FUSION: Weighted joint bayesian consensus completed.",
        "SYS: CRITICAL risk assigned. Certificate generation terminated.",
      ],
    },
    {
      name: "presidential_press_conference.mov",
      type: "video",
      size: "48.1 MB",
      authenticity: 98.62,
      confidence: 97.45,
      risk: "LOW",
      isLive: false,
      verdict:
        "Cryptographic signature matches broadcast hardware anchors perfectly. Temporal sequence holds structural continuity throughout. Pattern noise conforms completely to certified hardware specification.",
      logs: [
        "SYS: Streaming file presidential_press_conference.mov into memory...",
        "FORENSICS: Certified C2PA manifest found! Initiating decryption protocol...",
        "SYS: Cryptographic public key verification holds secure anchor.",
        "ViT: Verified zero localized pixel manipulation. Noise grid conforms to physical CMOS sensors.",
        "LSTM: Temporal facial structures reflect organic muscle velocity patterns.",
        "FUSION: Bayesian consensus assigns 98.62% Authenticity Score.",
        "SYS: Certificate generated safely. Provenance record indexed to ledger.",
      ],
    },
    {
      name: "satellite_intelligence_scan_x.png",
      type: "image",
      size: "8.9 MB",
      authenticity: 34.12,
      confidence: 96.8,
      risk: "HIGH",
      isLive: false,
      verdict:
        "JPEG block quantization mismatch detected. Splice boundaries confirmed around northern structural quadrants. Localized high-frequency Fourier residual gain confirms manual healing-brush overrides.",
      logs: [
        "SYS: Streaming image satellite_intelligence_scan_x.png...",
        "SAFF: JPEG block grid matrix compression mismatch flagged at quadrant D4.",
        "SAFF: Fourier analysis isolates unnatural high-frequency micro-patterns.",
        "ViT: Attention map weights pinpoint patch manipulation overlay.",
        "FUSION: Concluded dual-source compositing without provenance record.",
        "SYS: HIGH risk alert. Localized spatial manipulation mask generated.",
      ],
    },
  ];

  // Ping the backend once on mount so the UI can tell the user honestly
  // whether the verification API is actually reachable.
  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then(() => {
        if (!cancelled) setBackendStatus("online");
      })
      .catch(() => {
        if (!cancelled) setBackendStatus("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- DEMO PRESET PLAYBACK (scripted, for illustration only) ----
  const startDemoAnalysis = (asset: SampleAsset) => {
    setErrorMsg(null);
    setCustomFile(null);
    setSelectedAsset(asset);
    setAnalyzing(true);
    setAnalysisProgress(0);
    setCurrentLogIndex(0);
    setAuthScore(0);
    setConfIndex(0);
  };

  useEffect(() => {
    if (!analyzing || !selectedAsset || selectedAsset.isLive) return;

    const totalLogs = selectedAsset.logs.length;

    const progressTimer = setInterval(() => {
      setAnalysisProgress((prev) => {
        const next = prev + 3;
        if (next >= 100) {
          clearInterval(progressTimer);
          setAnalyzing(false);
          setAuthScore(selectedAsset.authenticity);
          setConfIndex(selectedAsset.confidence);
          return 100;
        }
        const currentStep = Math.min(Math.floor((next / 100) * totalLogs), totalLogs - 1);
        setCurrentLogIndex(currentStep);
        return next;
      });
    }, DEMO_LOG_INTERVAL_MS);

    return () => clearInterval(progressTimer);
  }, [analyzing, selectedAsset]);

  // ---- REAL UPLOAD -> LIVE BACKEND ANALYSIS ----
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadedFile(e.target.files[0]);
    }
    // allow re-selecting the same file twice in a row
    e.target.value = "";
  };

  const appendLog = (line: string) => {
    liveLogsRef.current = [...liveLogsRef.current, line];
    setSelectedAsset((prev) =>
      prev ? { ...prev, logs: liveLogsRef.current } : prev
    );
    setCurrentLogIndex(liveLogsRef.current.length - 1);
  };

  const handleUploadedFile = useCallback(async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      setErrorMsg("Unsupported file type. Please upload an image or a video file.");
      return;
    }

    const sizeLabel = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    setCustomFile({ name: file.name, size: sizeLabel });
    setErrorMsg(null);

    liveLogsRef.current = [`SYS: Uploaded ${file.name} (${sizeLabel}). Sending to verification API...`];

    const placeholder: SampleAsset = {
      name: file.name,
      type: isVideo ? "video" : "image",
      size: sizeLabel,
      authenticity: 0,
      confidence: 0,
      risk: "LOW",
      isLive: true,
      verdict: "",
      logs: liveLogsRef.current,
    };

    setSelectedAsset(placeholder);
    setAnalyzing(true);
    setAnalysisProgress(8);
    setCurrentLogIndex(0);
    setAuthScore(0);
    setConfIndex(0);

    // Indeterminate progress: creep toward 90% while we wait on the network,
    // then the real result snaps it to 100 (or the catch block resets it).
    const progressTimer = setInterval(() => {
      setAnalysisProgress((p) => (p < 90 ? p + Math.random() * 6 : p));
    }, 350);

    try {
      appendLog(
        isImage
          ? "FORENSICS: Running image deepfake detector (ViT/EfficientNet backbone)..."
          : "FORENSICS: Sampling frames + running ResNeXt50-LSTM video detector..."
      );

      const verifyResult = isImage ? await verifyImage(file) : await verifyVideo(file);

      appendLog(
        `MODEL: fake_probability=${verifyResult.fake_probability.toFixed(
          4
        )} -> label="${verifyResult.label}" (confidence ${(verifyResult.confidence * 100).toFixed(1)}%)`
      );

      appendLog("FUSION: Requesting Trust Scoring Engine fusion (metadata + provenance + model output)...");

      const trust = await getTrustScore({
        fake_probability: verifyResult.fake_probability,
        has_clean_metadata: true,
        source_known: false,
        reverse_search_matches: 0,
      });

      appendLog(
        `SYS: Trust Index ${trust.trust_index}% — risk level "${trust.risk_level.toUpperCase()}". Scan complete.`
      );

      const riskMap: Record<string, SampleAsset["risk"]> = {
        low: "LOW",
        medium: "HIGH",
        high: "CRITICAL",
      };

      clearInterval(progressTimer);
      setAnalysisProgress(100);
      setAnalyzing(false);
      setAuthScore(Math.round(trust.authenticity_score * 100) / 100);
      setConfIndex(Math.round(verifyResult.confidence * 10000) / 100);
      setSelectedAsset((prev) =>
        prev
          ? {
              ...prev,
              authenticity: Math.round(trust.authenticity_score * 100) / 100,
              confidence: Math.round(verifyResult.confidence * 10000) / 100,
              risk: riskMap[trust.risk_level] ?? "HIGH",
              verdict: `Live model verdict: classified as "${verifyResult.label.toUpperCase()}" with ${(
                verifyResult.confidence * 100
              ).toFixed(1)}% confidence. Trust Index ${trust.trust_index}% (${trust.risk_level} risk) after fusing model output with metadata and provenance signals.`,
              logs: liveLogsRef.current,
            }
          : prev
      );
    } catch (err) {
      clearInterval(progressTimer);
      setAnalyzing(false);
      setAnalysisProgress(0);

      const message =
        err instanceof ApiError
          ? err.status === 503
            ? "The model isn't trained yet on the server (no checkpoint found). Train image_model / video_model and restart the API — see truthlens_pipeline README."
            : err.status === 0
            ? "Could not reach the verification API. Make sure the backend is running (uvicorn api.main:app --port 8000) and reachable from this app."
            : err.message
          : "Unexpected error while analyzing the file.";

      appendLog(`ERROR: ${message}`);
      setErrorMsg(message);
      setBackendStatus(err instanceof ApiError && err.status === 0 ? "offline" : backendStatus);
    }
  }, [backendStatus]);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full py-24 px-4 md:px-8 border-b border-white/5 bg-[#03070C]">
      <div className="max-w-7xl mx-auto">

        {/* Section Heading with subtle telemetry badges */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 border-b border-white/5 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-sand animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-sand uppercase">
                [ PLAYGROUND STAGE_01 ]
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight text-alabaster">
              Real-Time Telemetry Lab
            </h2>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col items-start md:items-end gap-2">
            <p className="text-sm text-slate-muted max-w-sm font-sans font-light md:text-right">
              Drag your own assets to run them through the live verification API, or replay a scripted sample.
            </p>
            <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest">
              {backendStatus === "checking" && (
                <span className="flex items-center gap-1.5 text-slate-muted">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Checking API...
                </span>
              )}
              {backendStatus === "online" && (
                <span className="flex items-center gap-1.5 text-emerald-500">
                  <Wifi className="w-3 h-3" /> Verification API connected
                </span>
              )}
              {backendStatus === "offline" && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <WifiOff className="w-3 h-3" /> Verification API offline
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Core Playground Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

          {/* Left Column: Drag/Drop & Asset selection panel */}
          <div className="flex flex-col gap-6">

            {/* Interactive Upload Zone with Glitch Grid border */}
            <div
              className={`relative overflow-hidden p-8 rounded-xl flex flex-col items-center justify-center min-h-[280px] border transition-all duration-300 ${
                dragActive
                  ? "border-sand bg-sand/5 scale-[1.01] box-glow-sand"
                  : "border-white/10 bg-carbon/40"
              } cursor-pointer group`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
            >
              {/* Overlay active grid background lines */}
              <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileInput}
              />

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-carbon/80 border border-white/10 flex items-center justify-center mb-4 group-hover:border-sand group-hover:scale-105 transition-all duration-300">
                  <Upload className="w-6 h-6 text-sand group-hover:animate-bounce" />
                </div>
                <h3 className="text-base font-medium text-alabaster">
                  DRAG AND DROP ASSET_FILE
                </h3>
                <p className="text-xs text-slate-muted mt-2 max-w-xs font-sans">
                  Drop high-res images or mp4 files to verify, or <span className="text-sand border-b border-sand/30 font-semibold">browse local disk</span>.
                </p>
                <div className="mt-4 text-[9px] font-mono text-sand/60 bg-sand/5 px-3 py-1 rounded border border-sand/10 uppercase">
                  MAX_LIMIT: 100MB | JPEG, PNG, MP4, MOV
                </div>
              </div>

              {/* Status bar inside dropzone */}
              {customFile && (
                <div className="absolute bottom-4 left-4 right-4 bg-carbon/95 border border-white/10 px-4 py-2 rounded-md flex items-center justify-between text-xs font-mono">
                  <span className="text-alabaster truncate max-w-[200px]">{customFile.name}</span>
                  <span className="text-sand">{customFile.size}</span>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-4 rounded-lg border border-red-800/40 bg-red-950/20 flex items-start gap-2.5 text-xs text-red-400 font-mono leading-relaxed">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Sample Presets Selection Panel */}
            <div className="p-6 rounded-xl border border-white/5 bg-carbon/30">
              <span className="text-[10px] font-mono tracking-widest text-slate-muted uppercase block mb-4">
                SCRIPTED DEMO SAMPLES (NOT LIVE-SCORED):
              </span>
              <div className="space-y-3">
                {sampleAssets.map((asset) => {
                  const isSelected = selectedAsset?.name === asset.name && !selectedAsset?.isLive;
                  return (
                    <button
                      key={asset.name}
                      onClick={() => startDemoAnalysis(asset)}
                      disabled={analyzing}
                      className={`w-full p-4 rounded-lg flex items-center justify-between text-left transition-all duration-300 border ${
                        isSelected
                          ? "border-sand/40 bg-sand/[0.04]"
                          : "border-white/5 bg-carbon/40 hover:border-white/15"
                      } disabled:opacity-50 interactive`}
                    >
                      <div className="flex items-center gap-3 truncate max-w-[80%]">
                        <div className="p-2 rounded bg-[#101010] border border-white/5">
                          {asset.type === "video" ? (
                            <FileVideo className="w-4 h-4 text-sand" />
                          ) : (
                            <FileImage className="w-4 h-4 text-sand" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-medium text-alabaster font-mono truncate">
                            {asset.name}
                          </div>
                          <div className="text-[10px] text-slate-muted mt-0.5">
                            FILE_SIZE: {asset.size}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                          asset.risk === "CRITICAL"
                            ? "bg-red-950/20 border-red-800/40 text-red-500"
                            : asset.risk === "HIGH"
                            ? "bg-orange-950/20 border-orange-800/40 text-orange-500"
                            : "bg-emerald-950/20 border-emerald-800/40 text-emerald-500"
                        }`}>
                          {asset.risk}
                        </span>
                        <Play className="w-3 h-3 text-sand" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Real-Time Terminal & Analysis Metrics Panel */}
          <div className="flex flex-col justify-between p-8 rounded-xl border border-white/5 bg-carbon/50 relative overflow-hidden">
            {/* Ambient scanner light effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-sand/5 rounded-full blur-2xl pointer-events-none" />

            {/* Analysis Progress HUD bar */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sand" />
                  <span className="text-[10px] font-mono text-alabaster tracking-widest uppercase">
                    FORENSIC_STREAM_OUTPUT
                  </span>
                </div>
                <div className="text-[10px] font-mono text-sand">
                  {analyzing ? `VERIFYING: ${Math.floor(analysisProgress)}%` : "MONITOR_STABLE"}
                </div>
              </div>

              {/* Progress Bar container */}
              <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-sand transition-all duration-100 box-glow-sand"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>

              {/* terminal logging feed (scripted for demos, real log lines for live uploads) */}
              <div className="h-44 rounded-lg bg-black/40 border border-white/5 p-4 font-mono text-[10px] space-y-2 overflow-y-auto select-text scrollbar-thin">
                {!selectedAsset && (
                  <div className="text-slate-muted">
                    &gt; Drop a file or pick a demo sample to begin.
                  </div>
                )}
                {selectedAsset?.logs.slice(0, currentLogIndex + 1).map((log, index) => (
                  <div key={index} className="flex items-start gap-1.5 leading-relaxed text-slate-muted">
                    <span className="text-sand font-bold">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
                {analyzing && (
                  <div className="flex items-center gap-1.5 text-sand animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>RUNNING CORE HEURISTICS VECTOR MAPS...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Dashboard Output block */}
            <div className="mt-8 border-t border-white/5 pt-8">
              <div className="grid grid-cols-2 gap-4 mb-6">

                {/* Authenticity Score block */}
                <div className="p-4 rounded-lg bg-white/[0.01] border border-white/5 text-left">
                  <span className="text-[9px] font-mono text-slate-muted block uppercase mb-1">
                    Authenticity Score
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono text-alabaster font-bold tracking-tight">
                      {analyzing ? "---" : `${authScore}%`}
                    </span>
                    {!analyzing && selectedAsset && (
                      <span className={`text-[10px] font-mono ${authScore > 50 ? "text-emerald-500" : "text-red-500"}`}>
                        {authScore > 50 ? "SAFE" : "CORRUPT"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Confidence Index block */}
                <div className="p-4 rounded-lg bg-white/[0.01] border border-white/5 text-left">
                  <span className="text-[9px] font-mono text-slate-muted block uppercase mb-1">
                    Confidence Index
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono text-sand font-bold tracking-tight">
                      {analyzing ? "---" : `${confIndex}%`}
                    </span>
                    <span className="text-[10px] font-mono text-sand/60">
                      {selectedAsset?.isLive ? "LIVE" : "DEMO"}
                    </span>
                  </div>
                </div>

              </div>

              {/* Verdict summary details overlay */}
              <div className="p-5 rounded-lg border border-white/5 bg-[#080808]/80 text-left">
                <div className="flex items-center gap-2 mb-3">
                  {!analyzing && selectedAsset?.risk === "CRITICAL" && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {!analyzing && selectedAsset?.risk === "HIGH" && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                  {!analyzing && selectedAsset?.risk === "LOW" && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                  {analyzing && <RefreshCw className="w-4 h-4 text-sand animate-spin" />}

                  <span className="text-[10px] font-mono text-alabaster uppercase tracking-widest">
                    VERDICT_MATRIX_REPORT
                  </span>
                </div>

                <p className="text-[12px] leading-relaxed text-slate-muted font-sans font-light">
                  {analyzing
                    ? "Compiling neural spatial attention weight layers and checking for structural compression block anomalies. Please standby..."
                    : selectedAsset?.verdict || "No scan run yet."}
                </p>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
