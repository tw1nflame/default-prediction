// ===========================================
// API Types for Bankruptcy Prediction System
// ===========================================

// ----------- Common -----------
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  error: {
    message: string;
    code?: string;
  };
}

// ----------- Models -----------
export interface Model {
  id: string;
  name: string;
}

export interface ModelsResponse {
  models: Model[];
}

// ----------- Model Schema -----------
export interface SchemaProperty {
  type: 'number' | 'integer' | 'string' | 'boolean';
  title?: string;
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  default?: string | number | boolean;
}

export interface ModelSchema {
  type: 'object';
  title?: string;
  required?: string[];
  properties: Record<string, SchemaProperty>;
}

// ----------- File Upload -----------
export interface UploadResponse {
  fileId: string;
  filename: string;
}

// ----------- Batch Prediction -----------
export interface BatchPredictRequest {
  modelId: string;
  fileId: string;
}

export interface PredictionRow {
  rowIndex: number;
  probability: number;
  rawProbability?: number;
  prediction: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface BatchPredictResponse {
  resultId: string;
  preview: {
    columns: string[];
    rows: PredictionRow[];
  };
}

// ----------- Waterfall -----------
export interface WaterfallItem {
  feature: string;
  value: string | number | boolean | null;
  contribution: number;
}

export interface WaterfallResponse {
  baseValue: number;
  outputValue: number;
  // Optional extended fields (backend may return them)
  units?: 'log_odds' | string;
  baseLogOdds?: number;
  outputLogOdds?: number;
  calibratedOutputValue?: number;
  items: WaterfallItem[];
}

// ----------- Single Prediction -----------
export interface SinglePredictRequest {
  modelId: string;
  features: Record<string, string | number | boolean>;
}

export interface SinglePredictResponse {
  rawProbability?: number;
  probability: number;
  prediction: number;
  score?: number;
  waterfall?: WaterfallResponse;
}
