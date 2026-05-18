import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def decile_analysis(calibrated_model, X_test, y_test, splits=10):
    p_test_cal = calibrated_model.predict_proba(X_test)[:, 1]
    df_lift = pd.DataFrame({
    "y_true": y_test,
    "score": p_test_cal
    })

    # сортируем по убыванию риска
    df_lift = df_lift.sort_values("score", ascending=False).reset_index(drop=True)

    df_lift["decile"] = pd.qcut(df_lift.index, q=splits, labels=False)

    lift_table = df_lift.groupby("decile").agg(
        avg_pd=("score", "mean"),
        actual_default_rate=("y_true", "mean"),
        count=("y_true", "size"),
        defaults=("y_true", "sum")
    ).reset_index()

    print("Lift / deciles table (0 = highest risk):")
    print(lift_table)

    n = len(df_lift)

    top10 = df_lift.iloc[:int(0.1 * n)]
    top20 = df_lift.iloc[:int(0.2 * n)]

    print("Top 10% default rate:", top10["y_true"].mean())
    print("Top 20% default rate:", top20["y_true"].mean())

    print("Overall default rate:", df_lift["y_true"].mean())



def calibration_curve(calibrated_model, X_test, y_test):
    y_true = np.array(y_test)
    y_pred = np.array(calibrated_model.predict_proba(X_test)[:, 1])

    n_bins = 10

    df_cal = pd.DataFrame({
        "y_true": y_true,
        "y_pred": y_pred
    })

    # бинируем по предсказанной вероятности
    df_cal["bin"] = pd.qcut(df_cal["y_pred"], q=n_bins, duplicates="drop")

    cal_table = df_cal.groupby("bin").agg(
        avg_pred_pd=("y_pred", "mean"),
        actual_default_rate=("y_true", "mean"),
        count=("y_true", "size")
    ).reset_index()

    print("Calibration table:")
    print(cal_table)

    # --- график reliability diagram ---
    plt.figure(figsize=(6,6))
    plt.plot(cal_table["avg_pred_pd"], cal_table["actual_default_rate"], marker="o")
    plt.plot([0, cal_table["avg_pred_pd"].max()], [0, cal_table["avg_pred_pd"].max()], linestyle="--")
    plt.xlabel("Средняя предсказанная PD")
    plt.ylabel("Фактическая дефолтность")
    plt.title("Calibration curve (test)")
    plt.grid(True)
    plt.show()

    
def year_distribution(df_final, year_col='year', target_col='target'):
    y_year = df_final.index.get_level_values(year_col).to_numpy()
    t = df_final[target_col].to_numpy()

    res = (pd.DataFrame({'year': y_year, 'target': t})
           .groupby('year', as_index=True)['target']
           .agg(total='size', ones='sum'))

    res['zeros'] = res['total'] - res['ones']
    res['target_1_pct'] = (100 * res['ones'] / res['total']).round(2)
    res['target_0_pct'] = (100 * res['zeros'] / res['total']).round(2)

    print(res[['zeros', 'ones', 'target_0_pct', 'target_1_pct']])