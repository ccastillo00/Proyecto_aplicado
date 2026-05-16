from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import xgboost as xgb
import warnings
warnings.filterwarnings('ignore')

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
    categorical_cols = ['id_producto', 'id_bodega', 'marca', 'categoria', 'subcategoria', 'genero', 'zona', 'region']
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
    df = load_and_prepare_data()
    modelo_xgb, features, df_ml = train_xgboost(df)
    
    data_store['df_ml'] = df_ml
    data_store['modelo_xgb'] = modelo_xgb
    data_store['features'] = features
    print("Backend inicializado y listo.")

@app.get("/api/filters")
def get_filters():
    df = data_store['df_ml']
    return {
        "zonas": ["Todas las zonas"] + (df['zona'].dropna().unique().tolist() if 'zona' in df.columns else []),
        "generos": ["Todos los géneros"] + (df['genero'].dropna().unique().tolist() if 'genero' in df.columns else []),
        "marcas": ["Todas las marcas"] + (df['marca'].dropna().unique().tolist() if 'marca' in df.columns else []),
        "categorias": ["Todas las categorias"] + (df['categoria'].dropna().unique().tolist() if 'categoria' in df.columns else [])
    }

@app.get("/api/skus")
def get_skus():
    df = data_store['df_ml']
    # Extraer el último registro por SKU para poblar la tabla
    last_records = df.sort_values('fecha').groupby('id_producto').tail(1)
    
    # Mapear al formato esperado por el frontend
    skus_list = []
    for _, row in last_records.iterrows():
        sku_id = str(row['id_producto'])
        skus_list.append({
            "sku": sku_id,
            "zona": str(row.get('zona', 'N/A')),
            "marca": str(row.get('marca', 'N/A')),
            "genero": str(row.get('genero', 'N/A')),
            "prenda": str(row.get('categoria', 'N/A')),
            "subtipo": str(row.get('subcategoria', 'N/A')),
            "cat": "A",
            "tiempo": "Reciente",
            "precioAct": f"${row['precio_promedio']:,.0f}",
            "precioSug": f"${row['precio_promedio']*0.9:,.0f}", # Sugerencia basica inicial
            "precio_num": float(row['precio_promedio']),
            "stock": int(row.get('stock_actual', 0)),
            "costo_num": float(row.get('costo', 0))
        })
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
    
    # Preparar df para predict (debe coincidir con X_train)
    X_pred = sku_data[features].copy()
    X_pred['precio_promedio'] = nuevo_precio
    
    demanda_pred = float(modelo.predict(X_pred)[0])
    demanda_pred = max(0, demanda_pred) # No demanda negativa
    
    # KPIs Dinámicos
    ingresos = demanda_pred * nuevo_precio
    margen_bruto_pct = ((nuevo_precio - costo) / nuevo_precio) * 100 if nuevo_precio > 0 else 0
    # GMROI = (Margen Bruto Total) / (Costo del Inventario Promedio). Aproximación usando stock actual
    margen_bruto_total = (nuevo_precio - costo) * demanda_pred
    valor_inventario = stock * costo if stock > 0 else 1 # Evitar /0
    gmroi = margen_bruto_total / valor_inventario
    
    # 2. Generar vector de precios para la curva elástica (-30% a +30%)
    curve_data = []
    variations = np.arange(-30, 35, 5) # -30, -25, ... 30
    
    # Preparar batch para predecir todo de una vez por eficiencia
    X_batch = pd.concat([sku_data[features]] * len(variations), ignore_index=True)
    precios_simulados = precio_base * (1 + (variations / 100.0))
    X_batch['precio_promedio'] = precios_simulados
    
    demandas_batch = modelo.predict(X_batch)
    
    for var, dem, p_sim in zip(variations, demandas_batch, precios_simulados):
        curve_data.append({
            "variation": float(var),
            "precio": float(p_sim),
            "demanda": max(0, float(dem))
        })
        
    return {
        "kpis": {
            "gmroi": round(gmroi, 2),
            "margen": round(margen_bruto_pct, 1),
            "demanda_estimada": round(demanda_pred, 1),
            "nuevo_precio": round(nuevo_precio, 2)
        },
        "curve": curve_data
    }
