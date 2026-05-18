import pandas as pd
from catboost import CatBoostClassifier, Pool
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss, log_loss
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.linear_model import LogisticRegression


class LogitRecalibrator(BaseEstimator, ClassifierMixin):
    """
    Калибровка вероятностей через logistic recalibration:
        logit(p_cal) = a + b * logit(p_base)

    Где:
    - p_base = predict_proba базовой модели
    - a = intercept correction
    - b = slope correction

    Подходит, когда модель хорошо ранжирует, но занижает/завышает вероятности.
    """

    def __init__(self, base_model, eps=1e-15, C=1e6, max_iter=1000):
        self.base_model = base_model
        self.eps = eps
        self.C = C
        self.max_iter = max_iter
        self.lr_ = None

    def _clip_proba(self, p):
        return np.clip(p, self.eps, 1 - self.eps)

    def _logit(self, p):
        p = self._clip_proba(p)
        return np.log(p / (1 - p))

    def fit(self, X, y):
        # вероятности базовой модели для класса 1
        p_base = self.base_model.predict_proba(X)[:, 1]

        # переводим в logit-space
        z = self._logit(p_base).reshape(-1, 1)

        # почти без регуляризации, чтобы не мешать калибровке
        self.lr_ = LogisticRegression(
            C=self.C,
            solver="lbfgs",
            max_iter=self.max_iter
        )
        self.lr_.fit(z, y)
        return self

    def predict_proba(self, X):
        if self.lr_ is None:
            raise ValueError("Recalibrator is not fitted yet.")

        p_base = self.base_model.predict_proba(X)[:, 1]
        z = self._logit(p_base).reshape(-1, 1)

        p_cal = self.lr_.predict_proba(z)[:, 1]
        p_cal = self._clip_proba(p_cal)

        return np.column_stack([1 - p_cal, p_cal])

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)

    @property
    def intercept_(self):
        if self.lr_ is None:
            raise ValueError("Recalibrator is not fitted yet.")
        return self.lr_.intercept_[0]

    @property
    def slope_(self):
        if self.lr_ is None:
            raise ValueError("Recalibrator is not fitted yet.")
        return self.lr_.coef_[0, 0]
    
def prepare_dataset(df_path, 
                    exclude_cols=['cred_limit', 'fin_cond_index', 'tax_regime', 'reg_date', 'Unnamed: 0'], 
                    year_col='year',
                    id_col='vat_num',
                    dflt_col='dflt_year',
                    drop_fin_zeroes=True,
                    drop_ones_after_ones=True,
                    include_cols=None,
                    year_from=None):
    """
    Загружает и подготавливает датасет, возвращает DataFrame с MultiIndex (id, year)
    и колонкой target.
    
    Параметры
    ---------
    df_path: путь к файлу (.csv или .xlsx).
    exclude_cols: Список колонок, которые нужно удалить.
    year_col: Название колонки с годом.
    id_col: Название идентификатора компании
    dflt_col: Колонка с флагом дефолта -> станет target.
    drop_fin_zeroes: Удалять строки, где все фин. признаки равны 0.
    drop_ones_after_ones: Обрезать историю после первого дефолта по компании.

    Возвращает
    ----------
    pd.DataFrame
        Датасет с индексом (id_col, year_col) и колонкой target.
    """
    
    res = df_path.split('.')[-1]
    
    if res.lower() == 'csv':
        df = pd.read_csv(df_path)
    else:
        df = pd.read_excel(df_path)
    
    if exclude_cols:
        df = df.drop(columns=exclude_cols, errors='ignore')

    df = df.sort_values([id_col, year_col]).copy()
    base_cols = [year_col, id_col, dflt_col]
    fin_cols = [c for c in df.columns if c not in base_cols]
    
    # 1) сначала режем после первого дефолта
    if drop_ones_after_ones:
        df['ever_defaulted'] = df.groupby(id_col)[dflt_col].cumsum()
        df = df[df['ever_defaulted'] <= 1].copy()
        df = df.drop(columns=['ever_defaulted'])
    
    # 2) потом удаляем строки без отчетности
    if drop_fin_zeroes:
        all_zero_mask = df[fin_cols].isin([0, '0']).all(axis=1)
        df = df[~all_zero_mask].copy()

    # 3) фильтрация по году
    if year_from:
        df = df[df[year_col] >= year_from]    
    
    print(f'Длина датасета: {len(df)}')
    print('Распределение таргета:')
    print(df['dflt_year'].value_counts())

    df['target'] = df[dflt_col]
    df = df.drop(columns=[dflt_col])
    
        
    df = df.set_index([id_col, year_col])
    
    if include_cols:
        df = df.loc[:, include_cols + ['target']]
        
    return df


def data_split(
    df,
    year_col="year",
    train_year_max=2022,
    val_year=2023,
    test_year=2024,
    target_col="target",
):
    """
    df: DataFrame с MultiIndex, где один из уровней индекса = year_col
    year_col: имя уровня индекса с годом
    train_year_max: обучаем на годах <= этому
    val_year: год для валидации
    test_year: год для теста (обычно последний)
    target_col: имя целевой колонки (0/1)
    """
    X = df.drop(columns=[target_col], errors="ignore")
    y = df[target_col].astype(int)

    years = df.index.get_level_values(year_col)

    X_train, y_train = X[years <= train_year_max], y[years <= train_year_max]
    X_val, y_val     = X[years == val_year],       y[years == val_year]
    X_test, y_test   = X[years >= test_year],      y[years >= test_year]

    return X_train, y_train, X_val, y_val, X_test, y_test


def train_catboost(
    X_train,
    y_train,
    X_val,
    y_val,
    iterations_num=10_000,
    eval_metric="AUC",
    learning_rate=0.01,
    random_seed=42,
    verbose=200,
    early_stopping_rounds=200,
    class_weights=None,  # можно "Balanced"
):
    """
    X_train, y_train: train-выборка
    X_val, y_val: val-выборка для early stopping
    iterations_num: максимум итераций
    eval_metric: метрика CatBoost (например 'AUC' или 'Logloss')
    learning_rate: шаг обучения
    random_seed: сид
    verbose: частота логов
    early_stopping_rounds: patience для early stopping
    class_weights: None или 'Balanced'
    """
    if len(X_val) == 0:
        raise ValueError("Validation split is empty (check val_year).")

    # зафиксируем набор фичей по train и подгоним val под него
    X_val = X_val.reindex(columns=X_train.columns)

    cat_features = list(X_train.select_dtypes(include=["object"]).columns)

    train_pool = Pool(X_train, y_train, cat_features=cat_features)
    val_pool   = Pool(X_val, y_val, cat_features=cat_features)

    model = CatBoostClassifier(
        iterations=iterations_num,
        learning_rate=learning_rate,
        eval_metric=eval_metric,
        random_seed=random_seed,
        verbose=verbose,
        early_stopping_rounds=early_stopping_rounds,
        class_weights=class_weights,
        allow_writing_files=False,
    )

    model.fit(train_pool, eval_set=val_pool, use_best_model=True)
    return model


def calculate_metrics(model, X_test, y_test):
    """
    model: обученная модель с predict_proba
    X_test, y_test: тестовые данные
    """
    p = model.predict_proba(X_test)[:, 1]

    metrics = {
        "auc": roc_auc_score(y_test, p),
        "brier": brier_score_loss(y_test, p),
        "logloss": log_loss(y_test, p),
    }

    print("AUC:", metrics["auc"])
    print("Brier:", metrics["brier"])
    print("LogLoss:", metrics["logloss"])
    return metrics


def calibrate_model(model, X_val, y_val):
    """
    model: обученная модель
    X_val, y_val - данные для калибровки модели
    """
    cal = CalibratedClassifierCV(model, method='isotonic', cv='prefit')
    cal.fit(X_val, y_val)
    
    return cal

def calibrate_model_logistic(model, X_val, y_val):
    """
    model: обученная модель
    X_val, y_val - данные для калибровки модели
    """
    cal = LogitRecalibrator(model)
    cal.fit(X_val, y_val)
    
    return cal


def get_most_important_features(catboost_model, show=20, get_feats_max=None):
    """
    catboost_model: обученная модель
    show: количество фичей на графике
    back: количество возвращаемых фичей
    """
    # получаем importance из CatBoost
    fi_df = catboost_model.get_feature_importance(prettified=True)

    # приводим к удобным названиям
    fi_df = fi_df.rename(columns={
        "Feature Id": "feature",
        "Importances": "importance"
    })

    # сортируем
    fi_df = fi_df.sort_values("importance", ascending=False).reset_index(drop=True)

    print(f"\nTop 20 features by importance:")
    print(fi_df.iloc[:20])

    # --- график топ-20 ---
    plt.figure(figsize=(10,6))
    plt.barh(fi_df["feature"].iloc[:show][::-1], fi_df["importance"].iloc[:show][::-1])
    plt.title("Top 20 Feature Importance")
    plt.xlabel("Importance")
    plt.show()
    
    return fi_df.iloc[:get_feats_max]


def make_lags_dataset(
    df: pd.DataFrame,
    lags=(1, 2, 3),
    target_col="target",
    keep_only_with_all_lags=True,
):
    """
    Добавляет несколько лагов (t-1, t-2, ...) к фичам и (опционально) фильтрует строки.

    df: DataFrame с MultiIndex (id, year) + колонка target_col
    lags: iterable лагов, например (1,2,3)
    target_col: имя таргета
    keep_only_with_all_lags:
        False -> оставлять строки, где есть ХОТЯ БЫ ОДИН лаг (по всем лаговым колонкам не все NaN)
        True  -> оставлять строки, где есть ВСЕ лаги (для каждого lag есть хотя бы одно не-NaN значение)
    """
    if not isinstance(df.index, pd.MultiIndex):
        raise ValueError("df должен иметь MultiIndex (id, year)")

    lags = sorted(set(int(l) for l in lags))
    if any(l <= 0 for l in lags):
        raise ValueError("lags должны быть положительными целыми")

    X_now = df.drop(columns=[target_col], errors="ignore")

    lag_blocks = []
    masks = []  # маски наличия каждого лага по строкам
    for lag in lags:
        X_lag = X_now.groupby(level=0).shift(lag)
        X_lag.columns = [f"{c}_lag{lag}" for c in X_lag.columns]
        lag_blocks.append(X_lag)

        # для этого lag: есть хотя бы одна не-NaN лаговая фича
        masks.append(~X_lag.isna().all(axis=1))

    df_lag = pd.concat([X_now, *lag_blocks, df[target_col]], axis=1)

    # фильтрация строк
    if keep_only_with_all_lags:
        keep_mask = pd.concat(masks, axis=1).all(axis=1)
    else:
        keep_mask = pd.concat(masks, axis=1).any(axis=1)
    
    print(f'Длина датасета после добавления лаг фичей и отчистки строк с отсутствующими лаг-значениями: {len(df_lag[keep_mask])}')
    print('Распределение таргета:')
    print(df[keep_mask]['target'].value_counts())
    
    return df_lag[keep_mask].copy()