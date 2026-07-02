export interface Dataset {
  id: string;
  name: string;
  url: string;
  description: string;
  size: string;
  features: string[];
  applications: string[];
}

export interface SampleCase {
  id: string;
  name: string;
  type: string; // "image" | "video" | "audio"
  url?: string;
  isFake: boolean;
  label: "REAL" | "MANIPULATED" | "SYNTHETIC";
  description: string;
}

export interface AnalysisSection {
  status: "PASSED" | "SUSPICIOUS" | "FAILED";
  score: number;
  artifactsDetected: string[];
  details: string;
}

export interface LineageNode {
  id: string;
  label: string;
  type: "origin" | "step" | "result";
}

export interface LineageEdge {
  from: string;
  to: string;
  label: string;
}

export interface ProvenanceAnalysis extends AnalysisSection {
  creationTimestamp: string;
  deviceInfo: string;
  editingHistory: string[];
  lineageGraph: {
    nodes: LineageNode[];
    edges: LineageEdge[];
  };
}

export interface AuditResult {
  mediaType: "image" | "video" | "audio";
  authenticityScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidenceScore: number;
  trustIndex: number;
  verdict: "REAL" | "MANIPULATED" | "SYNTHETIC";
  spatialAnalysis: AnalysisSection;
  temporalAnalysis: AnalysisSection;
  audioVisualAnalysis: AnalysisSection;
  provenanceAnalysis: ProvenanceAnalysis;
  summary: string;
  technicalExplanation: string;
}
