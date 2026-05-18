'use client';

import { useState, useCallback } from 'react';
import { Play, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/src/api';
import type { RequestStatus, BatchPredictResponse, PredictionRow, UploadResponse } from '@/src/types/api';

interface BatchPredictionProps {
  modelId: string | null;
  uploadedFile: UploadResponse | null;
  onPredictionComplete: (response: BatchPredictResponse) => void;
  predictionResult: BatchPredictResponse | null;
  selectedRowIndex: number | null;
  onRowSelect: (rowIndex: number) => void;
}

export function BatchPrediction({
  modelId,
  uploadedFile,
  onPredictionComplete,
  predictionResult,
  selectedRowIndex,
  onRowSelect,
}: BatchPredictionProps) {
  const [predictStatus, setPredictStatus] = useState<RequestStatus>('idle');
  const [downloadStatus, setDownloadStatus] = useState<RequestStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handlePredict = useCallback(async () => {
    if (!modelId || !uploadedFile) return;

    setPredictStatus('loading');
    setError(null);

    try {
      const response = await api.runBatchPredict({
        modelId,
        fileId: uploadedFile.fileId,
      });
      onPredictionComplete(response);
      setPredictStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка выполнения прогноза');
      setPredictStatus('error');
    }
  }, [modelId, uploadedFile, onPredictionComplete]);

  const handleDownload = useCallback(async () => {
    if (!predictionResult) return;

    setDownloadStatus('loading');

    try {
      // Direct download (lets the browser handle saving to "Downloads")
      const url = api.getBatchDownloadUrl(predictionResult.resultId);
      const a = document.createElement('a');
      a.href = url;
      a.download = `predictions_${predictionResult.resultId}.xlsx`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setDownloadStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка скачивания результата');
      setDownloadStatus('error');
    }
  }, [predictionResult]);

  const canPredict = modelId && uploadedFile && predictStatus !== 'loading';
  const canDownload = predictionResult && downloadStatus !== 'loading';

  const formatProbability = (value: number) => {
    return (value * 100).toFixed(1) + '%';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Predict Button */}
        <Button
          onClick={handlePredict}
          disabled={!canPredict}
          className="w-full sm:w-auto"
        >
          {predictStatus === 'loading' ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Выполнение прогноза...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Сделать прогноз
            </>
          )}
        </Button>

        {/* Download Button */}
        {predictionResult && (
          <Button
            onClick={handleDownload}
            disabled={!canDownload}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {downloadStatus === 'loading' ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Скачивание...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Скачать результат
              </>
            )}
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Preview Table */}
      {predictionResult && predictionResult.preview.rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              Превью результатов (первые 10 строк)
            </h4>
            <p className="text-xs text-muted-foreground">
              Кликните по строке для построения waterfall-графика
            </p>
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-20">№ строки</TableHead>
                  <TableHead className="w-40">Вероятность (калибр.)</TableHead>
                  <TableHead className="w-40">Вероятность (сырая)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictionResult.preview.rows.map((row: PredictionRow) => (
                  <TableRow
                    key={row.rowIndex}
                    className={`cursor-pointer transition-colors ${
                      selectedRowIndex === row.rowIndex 
                        ? 'bg-primary/10 hover:bg-primary/15' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => onRowSelect(row.rowIndex)}
                  >
                    <TableCell className="font-mono text-sm">
                      {row.rowIndex}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatProbability(row.probability)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {typeof row.rawProbability === 'number' ? formatProbability(row.rawProbability) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* No Results State */}
      {predictionResult && predictionResult.preview.rows.length === 0 && (
        <Alert>
          <AlertDescription>
            Прогноз выполнен, но нет данных для превью.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
