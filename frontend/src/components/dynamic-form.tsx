'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/src/api';
import { WaterfallChart } from './waterfall-chart';
import type { 
  RequestStatus, 
  ModelSchema, 
  SchemaProperty,
  SinglePredictResponse 
} from '@/src/types/api';

interface DynamicFormProps {
  modelId: string | null;
  schema: ModelSchema | null;
  schemaStatus: RequestStatus;
  schemaError: string | null;
}

type FormValues = Record<string, string | number | boolean>;
type FormErrors = Record<string, string>;

export function DynamicForm({ 
  modelId, 
  schema, 
  schemaStatus,
  schemaError 
}: DynamicFormProps) {
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitStatus, setSubmitStatus] = useState<RequestStatus>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SinglePredictResponse | null>(null);

  // Initialize form values when schema changes
  useEffect(() => {
    if (!schema) {
      setValues({});
      setErrors({});
      setTouched({});
      setResult(null);
      return;
    }

    const initialValues: FormValues = {};
    Object.entries(schema.properties).forEach(([key, prop]) => {
      if (prop.default !== undefined) {
        initialValues[key] = prop.default;
      } else if (prop.type === 'boolean') {
        initialValues[key] = false;
      } else if (prop.enum && prop.enum.length > 0) {
        initialValues[key] = '';
      } else {
        initialValues[key] = '';
      }
    });
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setResult(null);
  }, [schema]);

  // Validate a single field
  const validateField = useCallback((
    key: string, 
    value: string | number | boolean, 
    prop: SchemaProperty,
    required: boolean
  ): string | null => {
    const isEmpty = value === '' || value === undefined || value === null;

    if (required && isEmpty) {
      return 'Обязательное поле';
    }

    if (isEmpty) return null;

    if (prop.type === 'number' || prop.type === 'integer') {
      const numValue = typeof value === 'number' ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return 'Введите число';
      }
      if (prop.type === 'integer' && !Number.isInteger(numValue)) {
        return 'Введите целое число';
      }
      if (prop.minimum !== undefined && numValue < prop.minimum) {
        return `Минимум: ${prop.minimum}`;
      }
      if (prop.maximum !== undefined && numValue > prop.maximum) {
        return `Максимум: ${prop.maximum}`;
      }
    }

    if (prop.type === 'string' && prop.enum) {
      if (!prop.enum.includes(value as string)) {
        return 'Выберите значение из списка';
      }
    }

    return null;
  }, []);

  // Validate all fields
  const validateForm = useCallback((): boolean => {
    if (!schema) return false;

    const newErrors: FormErrors = {};
    let isValid = true;

    Object.entries(schema.properties).forEach(([key, prop]) => {
      const required = schema.required?.includes(key) ?? false;
      const error = validateField(key, values[key], prop, required);
      if (error) {
        newErrors[key] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [schema, values, validateField]);

  // Handle field change
  const handleChange = useCallback((key: string, value: string | number | boolean) => {
    setValues(prev => ({ ...prev, [key]: value }));
    setResult(null);
    
    // Clear error on change
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [errors]);

  // Handle field blur
  const handleBlur = useCallback((key: string) => {
    setTouched(prev => ({ ...prev, [key]: true }));
    
    if (schema?.properties[key]) {
      const required = schema.required?.includes(key) ?? false;
      const error = validateField(key, values[key], schema.properties[key], required);
      if (error) {
        setErrors(prev => ({ ...prev, [key]: error }));
      }
    }
  }, [schema, values, validateField]);

  // Handle form submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!modelId || !schema) return;

    // Mark all fields as touched
    const allTouched = Object.keys(schema.properties).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setTouched(allTouched);

    if (!validateForm()) return;

    setSubmitStatus('loading');
    setSubmitError(null);

    // Prepare features with proper types
    const features: Record<string, string | number | boolean> = {};
    Object.entries(values).forEach(([key, value]) => {
      const prop = schema.properties[key];
      if (value === '' || value === undefined) return;
      
      if (prop.type === 'number' || prop.type === 'integer') {
        features[key] = Number(value);
      } else if (prop.type === 'boolean') {
        features[key] = Boolean(value);
      } else {
        features[key] = String(value);
      }
    });

    try {
      const response = await api.predictSingle({ modelId, features });
      setResult(response);
      setSubmitStatus('success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ошибка выполнения прогноза');
      setSubmitStatus('error');
    }
  }, [modelId, schema, values, validateForm]);

  // Check if form is valid
  const isFormValid = useMemo(() => {
    if (!schema) return false;
    
    for (const key of schema.required || []) {
      const value = values[key];
      if (value === '' || value === undefined || value === null) {
        return false;
      }
    }
    
    return Object.keys(errors).length === 0;
  }, [schema, values, errors]);

  // No model selected
  if (!modelId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
        <Calculator className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          Выберите модель для отображения<br />формы единичного прогноза
        </p>
      </div>
    );
  }

  // Loading schema
  if (schemaStatus === 'loading') {
    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Schema error
  if (schemaStatus === 'error') {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{schemaError}</AlertDescription>
      </Alert>
    );
  }

  // No schema
  if (!schema) {
    return null;
  }

  const fields = Object.entries(schema.properties);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {schema.title && (
          <p className="text-sm text-muted-foreground">{schema.title}</p>
        )}

        {/* Form Fields */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([key, prop]) => {
            const required = schema.required?.includes(key) ?? false;
            const error = touched[key] ? errors[key] : null;

            return (
              <FormField
                key={key}
                name={key}
                property={prop}
                value={values[key]}
                error={error}
                required={required}
                onChange={(value) => handleChange(key, value)}
                onBlur={() => handleBlur(key)}
              />
            );
          })}
        </div>

        {/* Submit Button */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            disabled={!isFormValid || submitStatus === 'loading'}
          >
            {submitStatus === 'loading' ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Расчёт...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Рассчитать прогноз
              </>
            )}
          </Button>
        </div>

        {/* Submit Error */}
        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
      </form>

      {/* Result Section */}
      {result && (
        <div className="space-y-6 pt-6 border-t">
          {/* Prediction Result */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="text-sm text-muted-foreground space-y-1">
              <div>
                Вероятность (калибр.):{' '}
                <span className="font-mono font-medium text-foreground">{(result.probability * 100).toFixed(1)}%</span>
              </div>
              <div>
                Вероятность (сырая):{' '}
                <span className="font-mono font-medium text-foreground">
                  {typeof result.rawProbability === 'number' ? `${(result.rawProbability * 100).toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Waterfall Chart (auto-rendered) */}
          {result.waterfall && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Анализ вкладов признаков</h3>
              <WaterfallChart 
                data={result.waterfall}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual form field component
interface FormFieldProps {
  name: string;
  property: SchemaProperty;
  value: string | number | boolean;
  error: string | null;
  required: boolean;
  onChange: (value: string | number | boolean) => void;
  onBlur: () => void;
}

function FormField({ 
  name, 
  property, 
  value, 
  error, 
  required,
  onChange, 
  onBlur 
}: FormFieldProps) {
  const label = property.title || name;
  const id = `field-${name}`;

  // Boolean field
  if (property.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-md border bg-card">
        <Label htmlFor={id} className="text-sm cursor-pointer">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Switch
          id={id}
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  // Enum field (Select)
  if (property.enum && property.enum.length > 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select 
          value={String(value)} 
          onValueChange={(val) => onChange(val)}
        >
          <SelectTrigger 
            id={id}
            className={error ? 'border-destructive' : ''}
          >
            <SelectValue placeholder="Выберите значение" />
          </SelectTrigger>
          <SelectContent>
            {property.enum.map((option) => (
              <SelectItem key={String(option)} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // Number/Integer/String field (Input)
  const inputType = (property.type === 'number' || property.type === 'integer') 
    ? 'number' 
    : 'text';

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
        {(property.minimum !== undefined || property.maximum !== undefined) && (
          <span className="text-muted-foreground/70 ml-1">
            ({property.minimum !== undefined && `${property.minimum}`}
            {property.minimum !== undefined && property.maximum !== undefined && ' - '}
            {property.maximum !== undefined && `${property.maximum}`})
          </span>
        )}
      </Label>
      <Input
        id={id}
        type={inputType}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => {
          const val = e.target.value;
          if (property.type === 'number' || property.type === 'integer') {
            onChange(val === '' ? '' : val);
          } else {
            onChange(val);
          }
        }}
        onBlur={onBlur}
        placeholder={property.description || `Введите значение`}
        min={property.minimum}
        max={property.maximum}
        step={property.type === 'integer' ? 1 : 'any'}
        className={error ? 'border-destructive' : ''}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
