"""
=================
Ejecutar UNA VEZ para entrenar el modelo XGBoost con los parquets locales

Uso:
    python backend/train_and_save.py

"""

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

warnings.filterwarnings("ignore")

# ── Rutas ─────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent.parent          
MODEL_DIR = Path(__file__).parent / "model"       
MODEL_DIR.mkdir(exist_ok=True)

# ── 1. Cargar parquets locales ────────────────────────────────────────────────
print("📦 Cargando parquets locales...")
DATA_DIR = ROOT / "data"
eventos  = pd.read_parquet(DATA_DIR / "eventos.parquet")
productos = pd.read_parquet(DATA_DIR / "productos.parquet")
bodegas  = pd.read_parquet(DATA_DIR / "bodegas.parquet")
stock    = pd.read_parquet(DATA_DIR / "stock.parquet")

print(f"   eventos   : {len(eventos):,} filas")
print(f"   productos : {len(productos):,} filas")
print(f"   bodegas   : {len(bodegas):,} filas")
print(f"   stock     : {len(stock):,} filas")

# ── 2. Preparar datos ─────────────────────────────────────────────────────────
print("\n🔧 Preparando datos...")

ventas = eventos[eventos["tipo_evento"] == "venta"]
ventas_agg = ventas.groupby(["fecha", "id_producto", "id_bodega"]).agg(
    cantidad=("cantidad", "sum"),
    precio_promedio=("precio", "mean"),
).reset_index()

df = ventas_agg.merge(productos, on="id_producto", how="left")
df = df.merge(bodegas, on="id_bodega", how="left")

# Stock actual por producto
stock_actual = (
    stock.groupby("id_producto")["cantidad"]
    .sum()
    .reset_index()
    .rename(columns={"cantidad": "stock_actual"})
)
df = df.merge(stock_actual, on="id_producto", how="left")
df["stock_actual"] = df["stock_actual"].fillna(0)

# Costo estimado si no existe
if "costo" not in df.columns:
    df["costo"] = df["precio_promedio"] * 0.6

print(f"   Dataset final: {len(df):,} filas, {df.shape[1]} columnas")

# ── 3. Entrenar XGBoost ───────────────────────────────────────────────────────
print("\n🤖 Entrenando XGBoost con características optimizadas...")

df_ml = df.copy()
df_ml["fecha"] = pd.to_datetime(df_ml["fecha"])

# Ordenar por serie temporal SKU-Bodega-Fecha para generar lags correctos
print("   Generando variables de estacionalidad y lag (historial)...")
df_ml.sort_values(by=["id_producto", "id_bodega", "fecha"], ascending=True, inplace=True)

# 1. Variables de estacionalidad temporal
df_ml["mes"] = df_ml["fecha"].dt.month
df_ml["dia_semana"] = df_ml["fecha"].dt.dayofweek
df_ml["es_fin_de_semana"] = df_ml["dia_semana"].isin([5, 6]).astype(int)

# 2. Variables de retraso (Lags) y promedios móviles
df_ml["cantidad_lag_1"] = df_ml.groupby(["id_producto", "id_bodega"])["cantidad"].shift(1).fillna(0)
df_ml["cantidad_lag_7"] = df_ml.groupby(["id_producto", "id_bodega"])["cantidad"].shift(7).fillna(0)
df_ml["cantidad_roll_mean_7"] = (
    df_ml.groupby(["id_producto", "id_bodega"])["cantidad"]
    .transform(lambda x: x.shift(1).rolling(window=7, min_periods=1).mean())
    .fillna(0)
)

# Volver a ordenar cronológicamente para el split temporal estricto (80/20)
df_ml.sort_values("fecha", ascending=True, inplace=True)

# Features: 'ciudad' en lugar de 'zona' (bodegas no tiene columna zona)
categorical_cols = [
    "marca", "categoria", "subcategoria", "genero", "ciudad", "region",
]
features = [
    "precio_promedio", "stock_actual", 
    "mes", "dia_semana", "es_fin_de_semana", 
    "cantidad_lag_1", "cantidad_lag_7", "cantidad_roll_mean_7"
]

for col in categorical_cols:
    if col in df_ml.columns:
        features.append(col)
        df_ml[col] = df_ml[col].astype("category")

df_ml = df_ml.dropna(subset=features + ["cantidad"])

split_idx = int(len(df_ml) * 0.8)
X_train = df_ml.iloc[:split_idx][features]
y_train = df_ml.iloc[:split_idx]["cantidad"]
X_test  = df_ml.iloc[split_idx:][features]
y_test  = df_ml.iloc[split_idx:]["cantidad"]

print(f"   Train: {len(X_train):,} | Test: {len(X_test):,}")

# Inicializar XGBoost con hiperparámetros optimizados y regularización
modelo_xgb = xgb.XGBRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=5,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    enable_categorical=True,
    tree_method="hist",
    random_state=42,
)
modelo_xgb.fit(X_train, y_train)

# Métrica rápida
y_pred = modelo_xgb.predict(X_test)
mape = np.mean(np.abs((y_test - y_pred) / (y_test.clip(lower=1)))) * 100
print(f"   MAPE en test (Optimizado): {mape:.1f}%")

# ── 4. Guardar artefactos ─────────────────────────────────────────────────────
print("\nGuardando artefactos en backend/model/ ...")

# 4a. Modelo XGBoost en formato nativo JSON
model_path = MODEL_DIR / "xgb_model.json"
modelo_xgb.save_model(str(model_path))
print(f"   {model_path.name}  ({model_path.stat().st_size / 1024:.0f} KB)")

# 4b. Lista de features
features_path = MODEL_DIR / "features.json"
with open(features_path, "w") as f:
    json.dump(features, f)
print(f"   ✅ {features_path.name}")

# 4c. DataFrame procesado (sólo columnas necesarias para el API)
cols_to_save = list(
    set(features + ["fecha", "cantidad", "id_producto", "id_bodega",
                    "precio_promedio", "stock_actual", "costo",
                    "marca", "genero", "categoria", "subcategoria",
                    "ciudad", "region"])
    & set(df_ml.columns)
)
df_save = df_ml[cols_to_save].copy()

# Convertir categorías a string para serialización limpia
for col in df_save.select_dtypes(["category"]).columns:
    df_save[col] = df_save[col].astype(str)

df_path = MODEL_DIR / "df_ml.parquet"
df_save.to_parquet(df_path, index=False)
print(f"   {df_path.name}  ({df_path.stat().st_size / 1024 / 1024:.1f} MB)")

print("\n Listo. Ahora el backend arranca instantáneamente.")
print(f"   Artefactos en: {MODEL_DIR}")
