// ===========================================
// API Client for Bankruptcy Prediction System
// ===========================================

import type {
  ModelsResponse,
  ModelSchema,
  UploadResponse,
  BatchPredictRequest,
  BatchPredictResponse,
  WaterfallResponse,
  SinglePredictRequest,
  SinglePredictResponse,
  ApiError,
} from '@/src/types/api';

export const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// ----------- Helper Functions -----------

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    throw new Error(errorData.error?.message || `Ошибка: ${response.status}`);
  }
  return response.json();
}

// ----------- API Functions -----------

/**
 * 3.1 Получить список моделей
 * GET /api/models
 */
export async function getModels(): Promise<ModelsResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/models`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<ModelsResponse>(response);
}

/**
 * 3.2 Получить схему параметров модели
 * GET /api/models/{modelId}/schema
 */
export async function getModelSchema(modelId: string): Promise<ModelSchema> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/models/${encodeURIComponent(modelId)}/schema`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });
  return handleResponse<ModelSchema>(response);
}

/**
 * 3.3 Загрузить Excel
 * POST /api/predict/batch/upload
 */
export async function uploadExcel(file: File, modelId: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('modelId', modelId);

  const response = await fetch(`${BACKEND_BASE_URL}/api/predict/batch/upload`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<UploadResponse>(response);
}

/**
 * 3.4 Запустить пакетный прогноз
 * POST /api/predict/batch/run
 */
export async function runBatchPredict(data: BatchPredictRequest): Promise<BatchPredictResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/predict/batch/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<BatchPredictResponse>(response);
}

/**
 * 3.5 Скачать результат Excel
 * GET /api/predict/batch/{resultId}/download
 */
export async function downloadResult(resultId: string): Promise<Blob> {
  const response = await fetch(
    `${BACKEND_BASE_URL}/api/predict/batch/${encodeURIComponent(resultId)}/download`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    let errorData: ApiError;
    try {
      errorData = await response.json();
    } catch {
      throw new Error(`Ошибка сервера: ${response.status} ${response.statusText}`);
    }
    throw new Error(errorData.error?.message || `Ошибка: ${response.status}`);
  }

  return response.blob();
}

export function getBatchDownloadUrl(resultId: string): string {
  return `${BACKEND_BASE_URL}/api/predict/batch/${encodeURIComponent(resultId)}/download`;
}

/**
 * 3.6 Waterfall для строки
 * GET /api/predict/batch/{resultId}/waterfall?rowIndex=1
 */
export async function getWaterfall(resultId: string, rowIndex: number): Promise<WaterfallResponse> {
  const response = await fetch(
    `${BACKEND_BASE_URL}/api/predict/batch/${encodeURIComponent(resultId)}/waterfall?rowIndex=${rowIndex}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    }
  );
  return handleResponse<WaterfallResponse>(response);
}

/**
 * 3.7 Единичный прогноз
 * POST /api/predict/single
 */
export async function predictSingle(data: SinglePredictRequest): Promise<SinglePredictResponse> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/predict/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return handleResponse<SinglePredictResponse>(response);
}

// ----------- Export all functions -----------

export const api = {
  getModels,
  getModelSchema,
  uploadExcel,
  runBatchPredict,
  downloadResult,
  getBatchDownloadUrl,
  getWaterfall,
  predictSingle,
};

export default api;
