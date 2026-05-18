// ===========================================
// Mock API for Development/Testing
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
} from '@/src/types/api';

// Имитация задержки сети
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ----------- Mock Data -----------

const mockModels: ModelsResponse = {
  models: [
    { id: 'small_df_no_lags', name: 'Small no lags' },
    { id: 'medium_df_with_lags', name: 'Medium with lags' },
    { id: 'full_model_v2', name: 'Full Model v2' },
  ],
};

const mockSchemas: Record<string, ModelSchema> = {
  small_df_no_lags: {
    type: 'object',
    title: 'Small Model Parameters',
    required: ['revenue', 'debt_ratio', 'current_ratio'],
    properties: {
      revenue: {
        type: 'number',
        title: 'Выручка (млн руб.)',
        minimum: 0,
        default: 100,
      },
      debt_ratio: {
        type: 'number',
        title: 'Коэффициент долга',
        minimum: 0,
        maximum: 1,
        default: 0.5,
      },
      current_ratio: {
        type: 'number',
        title: 'Коэффициент текущей ликвидности',
        minimum: 0,
        default: 1.5,
      },
      industry: {
        type: 'string',
        title: 'Отрасль',
        enum: ['manufacturing', 'retail', 'services', 'it'],
      },
      has_audit: {
        type: 'boolean',
        title: 'Наличие аудита',
        default: false,
      },
    },
  },
  medium_df_with_lags: {
    type: 'object',
    title: 'Medium Model Parameters',
    required: ['revenue', 'net_income', 'total_assets', 'debt_ratio'],
    properties: {
      revenue: {
        type: 'number',
        title: 'Выручка (млн руб.)',
        minimum: 0,
      },
      net_income: {
        type: 'number',
        title: 'Чистая прибыль (млн руб.)',
      },
      total_assets: {
        type: 'number',
        title: 'Всего активов (млн руб.)',
        minimum: 0,
      },
      debt_ratio: {
        type: 'number',
        title: 'Коэффициент долга',
        minimum: 0,
        maximum: 1,
      },
      revenue_lag1: {
        type: 'number',
        title: 'Выручка (год -1)',
        minimum: 0,
      },
      revenue_lag2: {
        type: 'number',
        title: 'Выручка (год -2)',
        minimum: 0,
      },
    },
  },
  full_model_v2: {
    type: 'object',
    title: 'Full Model v2 Parameters',
    required: ['revenue', 'net_income', 'ebitda', 'total_assets', 'current_assets', 'total_debt'],
    properties: {
      revenue: {
        type: 'number',
        title: 'Выручка',
        minimum: 0,
      },
      net_income: {
        type: 'number',
        title: 'Чистая прибыль',
      },
      ebitda: {
        type: 'number',
        title: 'EBITDA',
      },
      total_assets: {
        type: 'number',
        title: 'Всего активов',
        minimum: 0,
      },
      current_assets: {
        type: 'number',
        title: 'Оборотные активы',
        minimum: 0,
      },
      total_debt: {
        type: 'number',
        title: 'Общий долг',
        minimum: 0,
      },
      region: {
        type: 'string',
        title: 'Регион',
        enum: ['moscow', 'spb', 'other'],
      },
      company_age: {
        type: 'integer',
        title: 'Возраст компании (лет)',
        minimum: 0,
        maximum: 100,
      },
    },
  },
};

// ----------- Mock API Functions -----------

export async function mockGetModels(): Promise<ModelsResponse> {
  await delay(300);
  return mockModels;
}

export async function mockGetModelSchema(modelId: string): Promise<ModelSchema> {
  await delay(200);
  const schema = mockSchemas[modelId];
  if (!schema) {
    throw new Error(`Модель "${modelId}" не найдена`);
  }
  return schema;
}

export async function mockUploadExcel(_file: File, _modelId: string): Promise<UploadResponse> {
  await delay(500);
  return {
    fileId: `file_${Date.now()}`,
    filename: _file.name,
  };
}

export async function mockRunBatchPredict(data: BatchPredictRequest): Promise<BatchPredictResponse> {
  await delay(1000);
  
  // Генерируем 10 строк превью
  const rows = Array.from({ length: 10 }, (_, i) => ({
    rowIndex: i + 1,
    probability: Math.round(Math.random() * 100) / 100,
    rawProbability: Math.round(Math.random() * 100) / 100,
    prediction: Math.random() > 0.5 ? 1 : 0,
  }));

  return {
    resultId: `result_${data.fileId}_${Date.now()}`,
    preview: {
      columns: ['rowIndex', 'probability', 'rawProbability', 'prediction'],
      rows,
    },
  };
}

export async function mockDownloadResult(_resultId: string): Promise<Blob> {
  await delay(500);
  // Возвращаем пустой blob как заглушку
  const content = 'rowIndex,probability,prediction\n1,0.73,1\n2,0.25,0\n3,0.89,1';
  return new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function mockGetBatchDownloadUrl(resultId: string): string {
  return `mock://download/${encodeURIComponent(resultId)}`;
}

export async function mockGetWaterfall(_resultId: string, rowIndex: number): Promise<WaterfallResponse> {
  await delay(400);
  
  const features = [
    { feature: 'revenue', value: 150.5, contribution: 0.15 },
    { feature: 'debt_ratio', value: 0.65, contribution: 0.25 },
    { feature: 'current_ratio', value: 0.8, contribution: -0.12 },
    { feature: 'net_income', value: -20, contribution: 0.18 },
    { feature: 'total_assets', value: 500, contribution: -0.08 },
    { feature: 'industry=retail', value: 'retail', contribution: 0.05 },
    { feature: 'company_age', value: 3, contribution: 0.07 },
  ];

  const baseValue = 0.12;
  const totalContribution = features.reduce((sum, f) => sum + f.contribution, 0);

  return {
    baseValue,
    outputValue: baseValue + totalContribution,
    items: features.map(f => ({
      ...f,
      contribution: f.contribution * (1 + (rowIndex % 5) * 0.1 - 0.2), // Немного варьируем по строкам
    })),
  };
}

export async function mockPredictSingle(data: SinglePredictRequest): Promise<SinglePredictResponse> {
  await delay(600);
  const probability = Math.round(Math.random() * 100) / 100;
  const rawProbability = Math.round(Math.random() * 100) / 100;
  
  // Generate waterfall data for single prediction
  const features = Object.keys(data.features).map((key, index) => {
    const value = data.features[key];
    const contribution = (Math.random() - 0.5) * 0.4; // Random contribution between -0.2 and 0.2
    return {
      feature: key,
      value: typeof value === 'number' ? value : String(value),
      contribution,
    };
  });

  // Add some extra features for demo
  const extraFeatures = [
    { feature: 'market_risk', value: 0.35, contribution: 0.08 },
    { feature: 'credit_score', value: 650, contribution: -0.12 },
    { feature: 'liquidity_index', value: 1.2, contribution: -0.05 },
  ];

  const allFeatures = [...features, ...extraFeatures];
  const baseValue = 0.15;
  const totalContribution = allFeatures.reduce((sum, f) => sum + f.contribution, 0);
  const outputValue = Math.max(0, Math.min(1, baseValue + totalContribution));

  return {
    probability: outputValue,
    rawProbability,
    prediction: outputValue > 0.5 ? 1 : 0,
    waterfall: {
      baseValue,
      outputValue,
      calibratedOutputValue: outputValue,
      items: allFeatures,
    },
  };
}

// ----------- Export -----------

export const mockApi = {
  getModels: mockGetModels,
  getModelSchema: mockGetModelSchema,
  uploadExcel: mockUploadExcel,
  runBatchPredict: mockRunBatchPredict,
  downloadResult: mockDownloadResult,
  getBatchDownloadUrl: mockGetBatchDownloadUrl,
  getWaterfall: mockGetWaterfall,
  predictSingle: mockPredictSingle,
};

export default mockApi;
