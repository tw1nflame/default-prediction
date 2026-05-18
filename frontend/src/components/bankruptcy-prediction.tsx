'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  Building2, 
  FileSpreadsheet, 
  Calculator,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ModelSelector } from '@/src/components/model-selector';
import { ExcelUploader } from '@/src/components/excel-uploader';
import { BatchPrediction } from '@/src/components/batch-prediction';
import { WaterfallChart } from '@/src/components/waterfall-chart';
import { DynamicForm } from '@/src/components/dynamic-form';
import { api } from '@/src/api';
import type { 
  RequestStatus, 
  ModelSchema, 
  UploadResponse, 
  BatchPredictResponse 
} from '@/src/types/api';

type TabType = 'excel' | 'single';

export function BankruptcyPrediction() {
  // === Navigation State ===
  const [activeTab, setActiveTab] = useState<TabType>('excel');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // === Model State ===
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [modelSchema, setModelSchema] = useState<ModelSchema | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<RequestStatus>('idle');
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // === Excel Pipeline State ===
  const [uploadedFile, setUploadedFile] = useState<UploadResponse | null>(null);
  const [predictionResult, setPredictionResult] = useState<BatchPredictResponse | null>(null);
  
  // === Waterfall State ===
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // === Load schema when model changes ===
  useEffect(() => {
    async function loadSchema() {
      if (!selectedModelId) {
        setModelSchema(null);
        setSchemaStatus('idle');
        return;
      }

      setSchemaStatus('loading');
      setSchemaError(null);

      try {
        const schema = await api.getModelSchema(selectedModelId);
        setModelSchema(schema);
        setSchemaStatus('success');
      } catch (err) {
        setSchemaError(err instanceof Error ? err.message : 'Ошибка загрузки схемы модели');
        setSchemaStatus('error');
      }
    }

    loadSchema();
  }, [selectedModelId]);

  // === Handlers ===
  const handleModelChange = useCallback((modelId: string) => {
    // Reset all state when model changes
    setSelectedModelId(modelId);
    setUploadedFile(null);
    setPredictionResult(null);
    setSelectedRowIndex(null);
  }, []);

  const handleUploadSuccess = useCallback((response: UploadResponse) => {
    setUploadedFile(response);
    setPredictionResult(null);
    setSelectedRowIndex(null);
  }, []);

  const handleUploadClear = useCallback(() => {
    setUploadedFile(null);
    setPredictionResult(null);
    setSelectedRowIndex(null);
  }, []);

  const handlePredictionComplete = useCallback((response: BatchPredictResponse) => {
    setPredictionResult(response);
    setSelectedRowIndex(null);
  }, []);

  const handleRowSelect = useCallback((rowIndex: number) => {
    setSelectedRowIndex(rowIndex);
  }, []);

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  }, []);

  const navItems = [
    { id: 'excel' as TabType, label: 'Прогноз Excel', icon: FileSpreadsheet },
    { id: 'single' as TabType, label: 'Единичный прогноз', icon: Calculator },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col transform transition-transform duration-200 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">
                Прогноз банкротства
              </h1>
              <p className="text-xs text-muted-foreground">
                ML-система анализа
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Model Selector */}
        <div className="p-4 border-b">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Модель
          </label>
          <ModelSelector
            selectedModelId={selectedModelId}
            onModelChange={handleModelChange}
            compact
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            {new Date().getFullYear()} Bankruptcy Prediction
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden border-b bg-card p-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">
                {activeTab === 'excel' ? 'Прогноз Excel' : 'Единичный прогноз'}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
            {/* Tab Content */}
            {activeTab === 'excel' ? (
              <ExcelPredictionTab
                selectedModelId={selectedModelId}
                uploadedFile={uploadedFile}
                predictionResult={predictionResult}
                selectedRowIndex={selectedRowIndex}
                onUploadSuccess={handleUploadSuccess}
                onUploadClear={handleUploadClear}
                onPredictionComplete={handlePredictionComplete}
                onRowSelect={handleRowSelect}
              />
            ) : (
              <SinglePredictionTab
                selectedModelId={selectedModelId}
                modelSchema={modelSchema}
                schemaStatus={schemaStatus}
                schemaError={schemaError}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// Excel Prediction Tab Component
interface ExcelPredictionTabProps {
  selectedModelId: string | null;
  uploadedFile: UploadResponse | null;
  predictionResult: BatchPredictResponse | null;
  selectedRowIndex: number | null;
  onUploadSuccess: (response: UploadResponse) => void;
  onUploadClear: () => void;
  onPredictionComplete: (response: BatchPredictResponse) => void;
  onRowSelect: (rowIndex: number) => void;
}

function ExcelPredictionTab({
  selectedModelId,
  uploadedFile,
  predictionResult,
  selectedRowIndex,
  onUploadSuccess,
  onUploadClear,
  onPredictionComplete,
  onRowSelect,
}: ExcelPredictionTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Пакетный прогноз (Excel)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Загрузите файл Excel с данными компаний для массового прогнозирования банкротства
        </p>
      </div>

      {/* No Model Warning */}
      {!selectedModelId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Выберите модель в боковом меню для начала работы
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upload and Prediction */}
      {selectedModelId && (
        <>
          {/* File Upload */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Загрузка файла</CardTitle>
              <CardDescription>
                Поддерживаются файлы формата .xlsx
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelUploader
                modelId={selectedModelId}
                onUploadSuccess={onUploadSuccess}
                uploadedFile={uploadedFile}
                onClear={onUploadClear}
              />
            </CardContent>
          </Card>

          {/* Prediction Results */}
          {uploadedFile && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Результаты прогноза</CardTitle>
                <CardDescription>
                  Превью первых 10 строк с предсказаниями
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BatchPrediction
                  modelId={selectedModelId}
                  uploadedFile={uploadedFile}
                  onPredictionComplete={onPredictionComplete}
                  predictionResult={predictionResult}
                  selectedRowIndex={selectedRowIndex}
                  onRowSelect={onRowSelect}
                />
              </CardContent>
            </Card>
          )}

          {/* Waterfall Chart */}
          {predictionResult && (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Waterfall-график</CardTitle>
                    <CardDescription>
                      Анализ вкладов признаков для выбранной строки
                    </CardDescription>
                  </div>
                  {predictionResult.preview.rows.length > 0 && (
                    <Select
                      value={selectedRowIndex !== null ? String(selectedRowIndex) : ''}
                      onValueChange={(value) => onRowSelect(Number(value))}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Выберите строку" />
                      </SelectTrigger>
                      <SelectContent>
                        {predictionResult.preview.rows.map((row) => (
                          <SelectItem key={row.rowIndex} value={String(row.rowIndex)}>
                            Строка #{row.rowIndex}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <WaterfallChart
                  resultId={predictionResult.resultId}
                  rowIndex={selectedRowIndex}
                  title={selectedRowIndex !== null ? `Анализ строки #${selectedRowIndex}` : undefined}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// Single Prediction Tab Component
interface SinglePredictionTabProps {
  selectedModelId: string | null;
  modelSchema: ModelSchema | null;
  schemaStatus: RequestStatus;
  schemaError: string | null;
}

function SinglePredictionTab({
  selectedModelId,
  modelSchema,
  schemaStatus,
  schemaError,
}: SinglePredictionTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Единичный прогноз</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Введите параметры компании вручную для получения индивидуального прогноза с анализом вкладов
        </p>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Параметры компании</CardTitle>
          <CardDescription>
            Заполните обязательные поля для расчёта прогноза
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DynamicForm
            modelId={selectedModelId}
            schema={modelSchema}
            schemaStatus={schemaStatus}
            schemaError={schemaError}
          />
        </CardContent>
      </Card>
    </div>
  );
}
