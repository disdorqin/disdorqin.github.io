---
title: 特征工程与类别编码实战
description: 梳理高基数类别、周期特征与泄漏防御的常用技巧，附可直接复用的代码片段。
pubDate: 2026-04-16
category: 机器学习
tags:
  - 特征工程
  - 类别编码
  - 实战
cover: /uploads/cover-ml.jpg
draft: false
pinned: false
---

## 高基数类别：目标编码要防泄漏

对城市、设备编号这类高基数类别，独热编码会炸维度。目标编码更紧凑，但必须做**交叉验证内拟合**以防泄漏：

```python
from sklearn.model_selection import KFold
import numpy as np

def target_encode(col, target, n_splits=5, smoothing=10.0):
    out = np.full_like(col, np.nan, dtype=float)
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    global_mean = target.mean()
    for tr, va in kf.split(col):
        means = target.iloc[tr].groupby(col.iloc[tr]).mean()
        out[va] = col.iloc[va].map(means).fillna(global_mean)
    # 平滑：用全局均值拉住小样本
    return (out * n_splits + global_mean * smoothing) / (n_splits + smoothing)
```

## 周期特征：别用线性编码

小时、月份是循环的，`sin/cos` 编码能保留邻接关系：

```python
import numpy as np, pandas as pd

def cyclical(series: pd.Series, period: int):
    t = 2 * np.pi * series / period
    return np.sin(t), np.cos(t)
```

## 泄漏防御清单

- 所有基于目标的统计必须在训练折叠内计算；
- 滞后特征的时间戳必须严格早于预测时刻；
- 测试集的归一化统计量来自训练集，而非全量。

> 80% 的「线上掉点」最终都能在特征泄漏里找到原因。

## 小结

特征工程的收益往往高于换模型。先把编码与泄漏这两件事做对，再谈架构。
