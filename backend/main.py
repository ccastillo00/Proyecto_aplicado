from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import json
import pandas as pd
import numpy as np
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

MODEL_DIR = Path(__file__).parent / "model"

app = FastAPI(title="Pricing AI Backend")

# Habilitar CORS para que React pueda consumir la API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variables globales para almacenar en memoria (caché)
data_store = {}

def load_and_prepare_data():
    print("Cargando parquets desde GitHub...")
    base_url = "https://raw.githubusercontent.com/Carlos2935/Proyecto_aplicado/master/"
    
    # 1. Cargar datos
    eventos = pd.read_parquet(base_url + 'eventos.parquet')
    productos = pd.read_parquet(base_url + 'productos.parquet')
    bodegas = pd.read_parquet(base_url + 'bodegas.parquet')
    stock = pd.read_parquet(base_url + 'stock.parquet')
    
    # 2. Filtrar ventas y agregar
    ventas = eventos[eventos['tipo_evento'] == 'venta']
    ventas_agg = ventas.groupby(['fecha', 'id_producto', 'id_bodega']).agg(
        cantidad=('cantidad', 'sum'),
        precio_promedio=('precio', 'mean')
    ).reset_index()
    
    # 3. Left Joins
    df = ventas_agg.merge(productos, on='id_producto', how='left')
    df = df.merge(bodegas, on='id_bodega', how='left')
    
    # Agregar stock actual a los SKUs
    stock_actual = stock.groupby('id_producto')['cantidad'].sum().reset_index().rename(columns={'cantidad': 'stock_actual'})
    df = df.merge(stock_actual, on='id_producto', how='left')
    df['stock_actual'].fillna(0, inplace=True)
    
    # Costo base aproximado (para cálculo de GMROI). Si no está en productos, lo inferimos como 60% del precio promedio
    if 'costo' not in df.columns:
        df['costo'] = df['precio_promedio'] * 0.6
        
    return df

def train_xgboost(df):
    print("Preparando data y entrenando XGBoost...")
    # 1. Ordenar cronológicamente
    df_ml = df.copy()
    df_ml['fecha'] = pd.to_datetime(df_ml['fecha'])
    df_ml.sort_values(by='fecha', ascending=True, inplace=True)
    
    # Seleccionar features. Asumimos las comunes
    categorical_cols = ['id_producto', 'id_bodega', 'marca', 'categoria', 'subcategoria', 'genero', 'ciudad', 'region']
    features = ['precio_promedio', 'stock_actual']
    
    for col in categorical_cols:
        if col in df_ml.columns:
            features.append(col)
            df_ml[col] = df_ml[col].astype('category')
            
    # Dropear NAs en features
    df_ml = df_ml.dropna(subset=features + ['cantidad'])
            
    # 2. Split temporal estricto (80/20) - NO train_test_split aleatorio
    split_idx = int(len(df_ml) * 0.8)
    train_df = df_ml.iloc[:split_idx]
    test_df = df_ml.iloc[split_idx:]
    
    # Separar X e Y (la columna 'fecha' no entra al modelo)
    X_train = train_df[features]
    y_train = train_df['cantidad']
    X_test = test_df[features]
    y_test = test_df['cantidad']
    
    # 3. Entrenar modelo
    modelo_xgb = xgb.XGBRegressor(
        n_estimators=100, 
        learning_rate=0.1, 
        max_depth=6, 
        enable_categorical=True, 
        tree_method='hist', 
        random_state=42
    )
    modelo_xgb.fit(X_train, y_train)
    print("Entrenamiento completado.")
    
    return modelo_xgb, features, df_ml

@app.on_event("startup")
def startup_event():
    model_path    = MODEL_DIR / "xgb_model.json"
    features_path = MODEL_DIR / "features.json"
    df_path       = MODEL_DIR / "df_ml.parquet"

    if model_path.exists() and features_path.exists() and df_path.exists():
        # ── Carga rápida desde disco (< 1 segundo) ──────────────────────────
        print("⚡ Cargando modelo pre-entrenado desde disco...")

        modelo_xgb = xgb.XGBRegressor()
        modelo_xgb.load_model(str(model_path))

        with open(features_path) as f:
            features = json.load(f)

        df_ml = pd.read_parquet(str(df_path))

        # Re-aplicar tipos categóricos que XGBoost necesita
        cat_cols = [c for c in features if df_ml[c].dtype == object]
        for col in cat_cols:
            df_ml[col] = df_ml[col].astype('category')

        print(f"   Modelo cargado | {len(df_ml):,} filas | {len(features)} features")
    else:
        # ── Fallback: descarga + entrena (primera vez sin artefactos) ────────
        print("⚠️  Modelo no encontrado. Entrenando desde cero (esto tarda ~2 min)...")
        print("   Tip: ejecuta  python backend/train_and_save.py  para evitar esto.")
        df = load_and_prepare_data()
        modelo_xgb, features, df_ml = train_xgboost(df)

        # Auto-guardar para próximas arrancadas
        MODEL_DIR.mkdir(exist_ok=True)
        modelo_xgb.save_model(str(MODEL_DIR / "xgb_model.json"))
        with open(MODEL_DIR / "features.json", "w") as f:
            json.dump(features, f)
        df_save = df_ml[[c for c in df_ml.columns if c in features + [
            'fecha','cantidad','id_producto','id_bodega',
            'precio_promedio','stock_actual','costo',
            'marca','genero','categoria','subcategoria','ciudad','region'
        ]]].copy()
        for col in df_save.select_dtypes(['category']).columns:
            df_save[col] = df_save[col].astype(str)
        df_save.to_parquet(str(MODEL_DIR / "df_ml.parquet"), index=False)
        print("   ✅ Artefactos guardados en backend/model/")

    data_store['df_ml']       = df_ml
    data_store['modelo_xgb']  = modelo_xgb
    data_store['features']    = features
    print("✅ Backend listo.")

@app.get("/api/filters")
def get_filters():
    df = data_store['df_ml']
    # 'ciudad' es la columna de ubicación en bodegas (no existe 'zona')
    zona_col = 'ciudad' if 'ciudad' in df.columns else 'region'
    return {
        "zonas": ["Todas las zonas"] + sorted(df[zona_col].dropna().unique().tolist()) if zona_col in df.columns else ["Todas las zonas"],
        "generos": ["Todos los géneros"] + sorted(df['genero'].dropna().unique().tolist()) if 'genero' in df.columns else ["Todos los géneros"],
        "marcas": ["Todas las marcas"] + sorted(df['marca'].dropna().unique().tolist()) if 'marca' in df.columns else ["Todas las marcas"],
        "categorias": ["Todas las categorias"] + sorted(df['categoria'].dropna().unique().tolist()) if 'categoria' in df.columns else ["Todas las categorias"]
    }

@app.get("/api/skus")
def get_skus():
    df = data_store['df_ml']
    # Extraer el último registro por SKU para poblar la tabla
    last_records = df.sort_values('fecha').groupby('id_producto').tail(1)
    
    # 'ciudad' es la columna real de ubicación (bodegas no tiene 'zona')
    zona_col = 'ciudad' if 'ciudad' in last_records.columns else 'region'
    
    # Mapear al formato esperado por el frontend
    skus_list = []
    for _, row in last_records.iterrows():
        sku_id = str(row['id_producto'])
        zona_val = str(row[zona_col]) if zona_col in row.index and pd.notna(row[zona_col]) else 'Sin ciudad'
        skus_list.append({
            "sku": sku_id,
            "zona": zona_val,
            "marca": str(row['marca']) if pd.notna(row.get('marca')) else 'N/A',
            "genero": str(row['genero']) if pd.notna(row.get('genero')) else 'N/A',
            "prenda": str(row['categoria']) if pd.notna(row.get('categoria')) else 'N/A',
            "subtipo": str(row['subcategoria']) if pd.notna(row.get('subcategoria')) else 'N/A',
            "cat": "A",
            "tiempo": "Reciente",
            "precioAct": f"${row['precio_promedio']:,.0f}",
            "precioSug": f"${row['precio_promedio'] * 0.9:,.0f}",
            "precio_num": float(row['precio_promedio']),
            "stock": int(row.get('stock_actual', 0)),
            "costo_num": float(row.get('costo', 0))
        })
    
    # Ordenar por stock descendente (mayor inventario primero)
    skus_list.sort(key=lambda x: x['stock'], reverse=True)
    return skus_list

class SimulationRequest(BaseModel):
    sku: str
    price_change_pct: float  # Ej: -10 para -10%, 15 para +15%

@app.post("/api/simulate")
def simulate_price(req: SimulationRequest):
    df = data_store['df_ml']
    modelo = data_store['modelo_xgb']
    features = data_store['features']
    
    # Obtener el último registro de este SKU
    sku_data = df[df['id_producto'].astype(str) == req.sku].sort_values('fecha').tail(1)
    if sku_data.empty:
        raise HTTPException(status_code=404, detail="SKU no encontrado")
        
    base_row = sku_data.iloc[0].copy()
    precio_base = float(base_row['precio_promedio'])
    costo = float(base_row.get('costo', precio_base * 0.6))
    stock = float(base_row.get('stock_actual', 0))
    
    # 1. Simular punto exacto solicitado
    nuevo_precio = precio_base * (1 + (req.price_change_pct / 100.0))
    
    # Preparar df para predict
    X_pred = sku_data[features].copy()
    X_pred['precio_promedio'] = nuevo_precio
    
    demanda_base = float(modelo.predict(X_pred)[0])
    
    # Aplicar factor de elasticidad forzada si el modelo es muy rígido
    # Elasticidad típica en retail: -1.5 a -2.5
    elasticidad_teorica = -1.8
    variacion_precio_ratio = nuevo_precio / precio_base
    factor_elasticidad = (variacion_precio_ratio ** elasticidad_teorica)
    
    demanda_pred = demanda_base * factor_elasticidad
    demanda_pred = max(0.1, demanda_pred) 
    
    # KPIs Dinámicos
    ingresos = demanda_pred * nuevo_precio
    margen_unitario = nuevo_precio - costo
    margen_bruto_pct = (margen_unitario / nuevo_precio) * 100 if nuevo_precio > 0 else 0
    
    # GMROI Anualizado: (Margen Total Semanal * 52 semanas) / Valor Inventario
    # Si la demanda es muy baja, usamos un mínimo de 0.1 para que el KPI sea sensible
    demanda_kpi = max(demanda_pred, 0.01)
    margen_bruto_anual = margen_unitario * demanda_kpi * 52
    valor_inventario = stock * costo if stock > 0 else costo # Evitar /0
    
    gmroi = margen_bruto_anual / valor_inventario
    
    # 2. Generar vector de precios para la curva elástica (-30% a +30%)
    curve_data = []
    variations = np.arange(-30, 35, 5) # -30, -25, ... 30
    
    # Preparar batch para predecir todo de una vez por eficiencia
    X_batch = pd.concat([sku_data[features]] * len(variations), ignore_index=True)
    precios_simulados = precio_base * (1 + (variations / 100.0))
    X_batch['precio_promedio'] = precios_simulados
    
    demandas_batch = modelo.predict(X_batch)
    
    for var, dem, p_sim in zip(variations, demandas_batch, precios_simulados):
        # Aplicar misma elasticidad teórica a la curva
        ratio_p = p_sim / precio_base
        dem_adj = float(dem) * (ratio_p ** elasticidad_teorica)
        
        curve_data.append({
            "variation": float(var),
            "precio": float(p_sim),
            "demanda": max(0.1, dem_adj)
        })
        
    return {
        "kpis": {
            "gmroi": round(gmroi, 2),
            "margen": round(margen_bruto_pct, 1),
            "demanda_estimada": round(demanda_pred, 2),
            "nuevo_precio": round(nuevo_precio, 2)
        },
        "curve": curve_data
    }
