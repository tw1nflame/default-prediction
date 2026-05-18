'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/src/api';
import type { Model, RequestStatus } from '@/src/types/api';

interface ModelSelectorProps {
  selectedModelId: string | null;
  onModelChange: (modelId: string) => void;
  compact?: boolean;
}

export function ModelSelector({ selectedModelId, onModelChange, compact = false }: ModelSelectorProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      setStatus('loading');
      setError(null);
      try {
        const response = await api.getModels();
        setModels(response.models);
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки моделей');
        setStatus('error');
      }
    }
    loadModels();
  }, []);

  if (status === 'loading') {
    return compact ? (
      <Skeleton className="h-9 w-full" />
    ) : (
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Модель</label>
        <Skeleton className="h-9 w-full max-w-xs" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive" className={compact ? '' : 'max-w-md'}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">{error}</AlertDescription>
      </Alert>
    );
  }

  if (compact) {
    return (
      <Select value={selectedModelId ?? ''} onValueChange={onModelChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Выберите модель" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Модель прогнозирования</label>
      <Select value={selectedModelId ?? ''} onValueChange={onModelChange}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="Выберите модель" />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!selectedModelId && (
        <p className="text-xs text-muted-foreground">
          Выберите модель для начала работы
        </p>
      )}
    </div>
  );
}
