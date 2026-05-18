'use client';

import { useEffect, useState, useMemo } from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/src/api';
import type { RequestStatus, WaterfallResponse, WaterfallItem } from '@/src/types/api';

interface WaterfallChartProps {
  resultId?: string | null;
  rowIndex?: number | null;
  data?: WaterfallResponse | null;
  title?: string;
}

export function WaterfallChart({ resultId, rowIndex, data: externalData, title }: WaterfallChartProps) {
  const [data, setData] = useState<WaterfallResponse | null>(null);
  const [status, setStatus] = useState<RequestStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Handle external data separately
  useEffect(() => {
    if (externalData) {
      setData(externalData);
      setStatus('success');
    }
  }, [externalData]);

  // Handle API loading
  useEffect(() => {
    // Skip if we have external data
    if (externalData) return;

    // Reset if no valid params
    if (!resultId || rowIndex === null || rowIndex === undefined) {
      setData(null);
      setStatus('idle');
      return;
    }

    // Load from API
    async function loadWaterfall() {
      setStatus('loading');
      setError(null);

      try {
        const response = await api.getWaterfall(resultId!, rowIndex!);
        setData(response);
        setStatus('success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки данных графика');
        setStatus('error');
      }
    }

    loadWaterfall();
  }, [resultId, rowIndex, externalData]);

  // No data state
  if (!externalData && (!resultId || rowIndex === null || rowIndex === undefined)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          Выберите строку из таблицы для построения<br />waterfall-графика вкладов признаков
        </p>
      </div>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // No data state
  if (!data || data.items.length === 0) {
    return (
      <Alert>
        <AlertDescription>Нет данных для графика</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      )}
      <HorizontalWaterfallChart data={data} />
    </div>
  );
}

// Horizontal Waterfall Chart Component
function HorizontalWaterfallChart({ data }: { data: WaterfallResponse }) {
  const logit = (p: number) => {
    const eps = 1e-12;
    const pp = Math.min(1 - eps, Math.max(eps, p));
    return Math.log(pp / (1 - pp));
  };

  const baseLogOdds = typeof data.baseLogOdds === 'number' ? data.baseLogOdds : logit(data.baseValue);
  const outputLogOdds = typeof data.outputLogOdds === 'number' ? data.outputLogOdds : logit(data.outputValue);

  // In the notebook, probability shown in the title comes from the calibrated model (if available).
  const displayProbability = data.calibratedOutputValue ?? data.outputValue;
  const rawProbability = data.outputValue;

  // IMPORTANT: keep backend order.
  // Backend already mirrors notebook logic: top_k features sorted by |SHAP|, then "other features" as the last bar.
  const orderedItems = useMemo(() => data.items, [data.items]);

  // Calculate cumulative values for waterfall effect
  const chartData = useMemo(() => {
    // CatBoost SHAP contributions for binary classification are in log-odds.
    // Additive path must be built in logits.
    let cumulativeLogOdds = baseLogOdds;
    return orderedItems.map(item => {
      const startLogOdds = cumulativeLogOdds;
      cumulativeLogOdds += item.contribution;
      const endLogOdds = cumulativeLogOdds;
      return {
        ...item,
        start: startLogOdds,
        end: endLogOdds,
      };
    });
  }, [orderedItems, baseLogOdds]);

  // Determine the range for the X axis
  const allValues = [baseLogOdds, outputLogOdds, ...chartData.flatMap(d => [d.start, d.end])];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue || 0.01;
  const padding = range * 0.1;
  const xMin = minValue - padding;
  const xMax = maxValue + padding;
  const xRange = xMax - xMin || 0.01;

  // Convert value to percentage position
  const toPosition = (value: number) => ((value - xMin) / xRange) * 100;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Output Value Header */}
      <div className="px-4 py-3 bg-primary/5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Итоговое значение модели</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-md text-sm font-semibold bg-muted text-foreground">
            {(displayProbability * 100).toFixed(1)}% (калибр.)
          </div>
          <div className="px-3 py-1.5 rounded-md text-sm font-semibold bg-muted text-foreground">
            {(rawProbability * 100).toFixed(1)}% (сырая)
          </div>
        </div>
      </div>

      {/* X-Axis Scale */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-36 flex-shrink-0" />
          <div className="flex-1 relative h-6">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            {/* Scale markers (log-odds) */}
            {[xMin, 0, xMax].map((v, idx) => {
              const pos = toPosition(v);
              if (pos < -5 || pos > 105) return null;
              return (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2 text-[10px] text-muted-foreground"
                  style={{ left: `${Math.max(0, Math.min(100, pos))}%`, top: '50%', transform: 'translateX(-50%) translateY(-50%)' }}
                >
                  <div className="flex flex-col items-center">
                    <span className="bg-card px-1">{v.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="w-20 flex-shrink-0" />
        </div>
      </div>

      {/* Base Value Row */}
      <div className="px-4 py-2 flex items-center gap-2 bg-muted/30 border-y">
        <div className="w-36 flex-shrink-0">
          <span className="text-xs font-medium text-muted-foreground">Базовое значение</span>
        </div>
        <div className="flex-1 relative h-7">
          {/* Base value marker */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
            style={{ left: `${toPosition(baseLogOdds)}%` }}
          />
          <div 
            className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 bg-foreground text-background text-xs font-mono px-2 py-0.5 rounded"
            style={{ left: `${toPosition(baseLogOdds)}%` }}
          >
            {baseLogOdds.toFixed(3)}
          </div>
        </div>
        <div className="w-20 flex-shrink-0" />
      </div>

      {/* Feature Bars */}
      <div className="divide-y">
        {chartData.map((item, index) => (
          <WaterfallRow 
            key={index}
            item={item}
            toPosition={toPosition}
            basePosition={toPosition(baseLogOdds)}
          />
        ))}
      </div>

      {/* Output Value Row */}
      <div className="px-4 py-3 flex items-center gap-2 bg-primary/5 border-t-2 border-primary/20">
        <div className="w-36 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground">Итого</span>
        </div>
        <div className="flex-1 relative h-8">
          {/* Connecting line from base to output */}
          <div 
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-gradient-to-r from-muted-foreground/30 to-primary/50"
            style={{ 
              left: `${Math.min(toPosition(baseLogOdds), toPosition(outputLogOdds))}%`,
              width: `${Math.abs(toPosition(outputLogOdds) - toPosition(baseLogOdds))}%`
            }}
          />
          {/* Output value marker */}
          <div 
            className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground text-sm font-mono font-semibold px-3 py-1 rounded"
            style={{ left: `${toPosition(outputLogOdds)}%` }}
          >
            {outputLogOdds.toFixed(3)}
          </div>
        </div>
        <div className="w-20 flex-shrink-0" />
      </div>
    </div>
  );
}

interface WaterfallRowProps {
  item: WaterfallItem & { start: number; end: number };
  toPosition: (value: number) => number;
  basePosition: number;
}

function WaterfallRow({ item, toPosition, basePosition }: WaterfallRowProps) {
  const isPositive = item.contribution >= 0;
  const startPos = toPosition(item.start);
  const endPos = toPosition(item.end);
  const barLeft = Math.min(startPos, endPos);
  const barWidth = Math.abs(endPos - startPos);
  
  return (
    <div className="px-4 py-2 flex items-center gap-2 hover:bg-muted/30 transition-colors">
      {/* Feature Name */}
      <div className="w-36 flex-shrink-0">
        <span className="text-xs text-foreground truncate block" title={item.feature}>
          {item.feature}
        </span>
      </div>

      {/* Bar Chart Area */}
      <div className="flex-1 relative h-6">
        {/* Vertical reference line at base value */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-border/50"
          style={{ left: `${basePosition}%` }}
        />

        {/* Contribution Bar */}
        <div 
          className={`absolute top-1 bottom-1 rounded-sm transition-all ${
            isPositive 
              ? 'bg-destructive/80' 
              : 'bg-primary/80'
          }`}
          style={{ 
            left: `${barLeft}%`,
            width: `${Math.max(barWidth, 0.5)}%`,
          }}
        />

        {/* Connection line showing cumulative */}
        <div 
          className="absolute top-1/2 h-px bg-foreground/20 -translate-y-1/2"
          style={{
            left: `${Math.min(startPos, endPos)}%`,
            width: `${barWidth}%`,
          }}
        />
      </div>

      {/* Contribution Value */}
      <div className="w-20 flex-shrink-0 text-right">
        <span className={`text-xs font-mono ${isPositive ? 'text-destructive' : 'text-primary'}`}>
          {isPositive ? '+' : ''}{item.contribution.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
