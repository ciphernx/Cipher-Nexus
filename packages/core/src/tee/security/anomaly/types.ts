export interface Feature {
  securityScore?: number;
  vulnerabilityCount?: number;
  highSeverityCount?: number;
  mediumSeverityCount?: number;
  lowSeverityCount?: number;
  securityScoreChange?: number;
  vulnerabilityCountChange?: number;
  integrityChange?: number;
  avgSecurityScore?: number;
  avgVulnerabilityCount?: number;
  behaviorPattern?: number;
  resourceUsage?: number;
  errorRate?: number;
  [key: string]: number | undefined;
}

export interface AnomalyScore {
  model: string;
  score: number;
  timestamp: number;
}

export interface DetectionResult {
  isAnomaly: boolean;
  ensembleScore: number;
  type: string;
  severity: 'low' | 'medium' | 'high';
  explanation: string;
  timestamp: number;
  modelScores: AnomalyScore[];
  confidence: number;
}

export interface ModelConfig {
  modelPath?: string;
  threshold?: number;
  historySize?: number;
  updateInterval?: number;
  features?: string[];
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  auc: number;
  timestamp: number;
}

export interface ModelState {
  lastUpdate: number;
  metrics: ModelMetrics;
  parameters: Record<string, any>;
  version: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  contribution: number;
}

export interface AnomalyAlert {
  id: string;
  result: DetectionResult;
  timestamp: number;
  context: {
    features: Feature;
    measurements: any;
  };
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  resolution?: {
    type: string;
    description: string;
    timestamp: number;
    resolvedBy: string;
  };
} 