'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/src/api';
import type { RequestStatus, UploadResponse } from '@/src/types/api';

interface ExcelUploaderProps {
  modelId: string | null;
  onUploadSuccess: (response: UploadResponse) => void;
  uploadedFile: UploadResponse | null;
  onClear: () => void;
}

export function ExcelUploader({
  modelId,
  onUploadSuccess,
  uploadedFile,
  onClear,
}: ExcelUploaderProps) {
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация типа файла
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Пожалуйста, выберите файл Excel (.xlsx или .xls)');
      return;
    }

    setSelectedFile(file);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !modelId) return;

    setStatus('loading');
    setError(null);

    try {
      const response = await api.uploadExcel(selectedFile, modelId);
      onUploadSuccess(response);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки файла');
      setStatus('error');
    }
  }, [selectedFile, modelId, onUploadSuccess]);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    setStatus('idle');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClear();
  }, [onClear]);

  const isDisabled = !modelId;
  const canUpload = selectedFile && modelId && status !== 'loading';

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">Загрузка Excel-файла</label>
      
      {/* File Input Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-colors mt-1
          ${isDisabled ? 'border-muted bg-muted/30 cursor-not-allowed' : 'border-border hover:border-primary/50 cursor-pointer'}
          ${uploadedFile ? 'border-primary/30 bg-primary/5' : ''}
        `}
        onClick={() => !isDisabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          disabled={isDisabled}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 text-center">
          {uploadedFile ? (
            <>
              <File className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">{uploadedFile.filename}</p>
                <p className="text-xs text-muted-foreground">Файл загружен</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="mt-2"
              >
                <X className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </>
          ) : selectedFile ? (
            <>
              <File className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {isDisabled
                    ? 'Сначала выберите модель'
                    : 'Нажмите или перетащите файл Excel (.xlsx)'}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload Button */}
      {selectedFile && !uploadedFile && (
        <Button
          onClick={handleUpload}
          disabled={!canUpload}
          className="w-full sm:w-auto"
        >
          {status === 'loading' ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Загрузка...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Загрузить файл
            </>
          )}
        </Button>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
