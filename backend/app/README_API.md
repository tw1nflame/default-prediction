# FastAPI backend (банкротство / default prediction)

## Запуск

Из папки `backend/app`:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Проверка:
- `GET http://localhost:8000/health`
- Swagger: `http://localhost:8000/docs`

## Модели

Модели автоматически подхватываются из `exp/*` при наличии:
- `exp/<model_id>/models/model.cbm`
- `exp/<model_id>/meta.json` (должен содержать `train_cols`)

## Runtime

Временные файлы:
- загрузки: `runtime/uploads`
- результаты: `runtime/results`
