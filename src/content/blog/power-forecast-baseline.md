---
title: 电力负荷预测基线模型构建
description: 从数据清洗到季节性朴素法与 LightGBM 基线的完整流程，给出一个可复现的负荷预测起点。
pubDate: 2026-03-05
updatedDate: 2026-06-25
category: 电力预测
tags:
  - 负荷预测
  - LightGBM
  - 基线
cover: /uploads/cover-power.jpg
draft: false
pinned: false
---

## 数据口径

负荷预测的输入通常包含：历史负荷、气象（温度/湿度）、日历（工作日/节假日）。先把缺失与异常点按以下规则处理：

1. 连续缺失超过 3 小时用分段线性插值；
2. 负值或超物理上限的点直接置为缺失；
3. 节假日当作独立类别而非简单剔除。

## 季节性朴素法

在建模之前，先用**同比昨日同时刻**作为朴素基线，它往往已经很强：

```python
import numpy as np
import pandas as pd

def seasonal_naive(load: pd.Series, period: int = 24 * 7) -> pd.Series:
    # 取上周同一时刻作为预测
    return load.shift(period)
```

任何复杂模型的第一个 KPI 应当是：**显著优于这个朴素基线**。

## LightGBM 基线

构造滞后特征与日历特征后，用 LightGBM 拟合：

```python
import lightgbm as lgb

features = [f"lag_{k}" for k in (1, 2, 24, 24 * 7)]
cat_feats = ["hour", "weekday", "is_holiday"]

train = lgb.Dataset(X_train, y_train, categorical_feature=cat_feats)
params = {
    "objective": "regression_l1",
    "n_estimators": 800,
    "learning_rate": 0.05,
    "num_leaves": 64,
    "device": "cpu",
}
model = lgb.train(params, train)
```

## 评估要点

- 同时报告 MAE / MAPE / 峰值误差；
- 关注**日内曲线形状**而非仅点误差；
- 保留一段最近的滚动窗口做外推测试。

构建好基线后，再考虑深度模型才有意义。
