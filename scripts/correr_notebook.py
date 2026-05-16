# 1. Importación de Librerías
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import statsmodels.api as sm
import statsmodels.formula.api as smf
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_percentage_error
from prophet import Prophet
import scipy.stats as stats
from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.stats.outliers_influence import variance_inflation_factor
import warnings
import logging

warnings.filterwarnings("ignore")
logging.getLogger('cmdstanpy').setLevel(logging.ERROR)

# URL Base del repositorio en GitHub (Rama 'main')
base_url = "https://raw.githubusercontent.com/Carlos2935/Proyecto_aplicado/master/"

print("Descargando archivos Parquet desde GitHub...")
try:
    eventos = pd.read_parquet(base_url + 'eventos.parquet')
    productos = pd.read_parquet(base_url + 'productos.parquet')
    bodegas = pd.read_parquet(base_url + 'bodegas.parquet')
    stock = pd.read_parquet(base_url + 'stock.parquet')
    print("✅ Datos cargados correctamente.")
    print(f"Total de eventos cargados: {len(eventos):,}")
except Exception as e:
    print("⚠️ Error al descargar los archivos.")
    print("Si tu repositorio usa 'master' en vez de 'main', cambia la URL base arriba a: https://raw.githubusercontent.com/Carlos2935/Proyecto_aplicado/master/")
    print("Detalle:", e)

# Filtrar solo ventas
ventas = eventos[eventos['tipo_evento'] == 'venta'].copy()

# Agrupar a nivel de Fecha, Producto y Bodega
ventas_diarias = ventas.groupby(['fecha', 'id_producto', 'id_bodega']).agg(
    cantidad_vendida=('cantidad', 'sum'),
    ingreso_total=('precio_total', 'sum')
).reset_index()

# Calcular precio real promedio
ventas_diarias['precio_promedio'] = ventas_diarias['ingreso_total'] / ventas_diarias['cantidad_vendida']

# Uniones con Left Join
df_unificado = ventas_diarias.merge(productos, on='id_producto', how='left')
df_unificado = df_unificado.merge(bodegas, on='id_bodega', how='left')

# Unir stock
stock_clean = stock[['id_producto', 'id_bodega', 'cantidad']].rename(columns={'cantidad': 'stock_actual'})
df_unificado = df_unificado.merge(stock_clean, on=['id_producto', 'id_bodega'], how='left')
df_unificado['stock_actual'] = df_unificado['stock_actual'].fillna(0)

# Limpiar nulos menores
df_modelo = df_unificado[(df_unificado['precio_promedio'] > 0) & (df_unificado['cantidad_vendida'] > 0)].copy()

print(f"✅ Tabla maestra generada. Filas: {len(df_modelo):,}")

# Crear variables logarítmicas
df_modelo['log_cantidad'] = np.log(df_modelo['cantidad_vendida'])
df_modelo['log_precio'] = np.log(df_modelo['precio_promedio'])

# Entrenar modelo global
modelo_ols = smf.ols('log_cantidad ~ log_precio', data=df_modelo).fit()
elasticidad = modelo_ols.params['log_precio']

print(f"⭐ ELASTICIDAD PRECIO GLOBAL: {elasticidad:.4f}")

# Segmentado por muestra de categorías
df_cat = df_modelo.dropna(subset=['categoria'])
print("--- Elasticidad por Categoría (Muestra) ---")
for cat in df_cat['categoria'].unique()[:5]:
    df_temp = df_cat[df_cat['categoria'] == cat]
    if len(df_temp) > 100:
        mod = smf.ols('log_cantidad ~ log_precio', data=df_temp).fit()
        print(f"Categoría '{cat}': Elasticidad = {mod.params['log_precio']:.4f}")

# Análisis de Supuestos para la Regresión Log-Log
import matplotlib.pyplot as plt
import seaborn as sns
import scipy.stats as stats
from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.stats.stattools import durbin_watson
import statsmodels.stats.api as sms
import pandas as pd
residuos_ols = modelo_ols.resid.dropna()
predicciones_ols = modelo_ols.fittedvalues.dropna()
# IMPORTANTE: Muestrear los datos para que las gráficas se generen rápido
# Pintar millones de puntos en matplotlib puede colapsar o demorar minutos.
df_graficas = pd.DataFrame({"predicciones": predicciones_ols, "residuos": residuos_ols})
if len(df_graficas) > 5000:
    df_graficas = df_graficas.sample(5000, random_state=42)
fig, axs = plt.subplots(2, 2, figsize=(15, 10))
# 1. Linealidad y Homocedasticidad (Residuos vs Predicciones)
sns.scatterplot(x=df_graficas["predicciones"], y=df_graficas["residuos"], ax=axs[0, 0], alpha=0.5)
axs[0, 0].axhline(y=0, color='r', linestyle='--')
axs[0, 0].set_title('Residuos vs Ajustados (Homocedasticidad) [Muestra]')
axs[0, 0].set_xlabel('Valores Ajustados')
axs[0, 0].set_ylabel('Residuos')
# 2. Normalidad de Residuos (Histograma)
sns.histplot(df_graficas["residuos"], kde=True, ax=axs[0, 1], color='coral')
axs[0, 1].set_title('Histograma de Residuos [Muestra]')
# 3. Normalidad de Residuos (Q-Q Plot)
stats.probplot(df_graficas["residuos"], dist="norm", plot=axs[1, 0])
axs[1, 0].set_title('Q-Q Plot de Residuos [Muestra]')
# 4. Independencia (Autocorrelación de Residuos)
plot_acf(df_graficas["residuos"], ax=axs[1, 1], lags=30)
axs[1, 1].set_title('ACF de Residuos [Muestra]')
plt.tight_layout()
plt.close("all")
# Pruebas Estadísticas Formales
print("--- Pruebas Estadísticas Formales ---")
from sklearn.metrics import mean_absolute_error
mae_ols = mean_absolute_error(predicciones_ols, predicciones_ols + residuos_ols)
import numpy as np
std_mae_ols = np.std(np.abs(residuos_ols))
    import numpy as np
    std_mae_ols = np.std(np.abs(residuos_ols))
print(f"MAE (Log-Log): {mae_ols:.4f} (Error Absoluto Medio en escala logarítmica)")
print(f"Desviación MAE (Log-Log): {std_mae_ols:.4f}")
# Durbin-Watson (Independencia)
dw = durbin_watson(residuos_ols)
print(f"Durbin-Watson: {dw:.4f} (Cercano a 2 indica no autocorrelación)")
# Jarque-Bera (Normalidad)
jb_test = stats.jarque_bera(residuos_ols)
print(f"Jarque-Bera p-value: {jb_test.pvalue:.4f} (<0.05 indica no normalidad)")
# Breusch-Pagan (Homocedasticidad)
exog = modelo_ols.model.exog
# Muestreamos para Breusch-Pagan si es muy grande para no trabar el test estadístico
import numpy as np
if len(residuos_ols) > 5000:
    idx = np.random.choice(len(residuos_ols), 5000, replace=False)
    residuos_sample = residuos_ols.iloc[idx]
    exog_sample = exog[idx]
    bp_test = sms.het_breuschpagan(residuos_sample, exog_sample)
else:
    bp_test = sms.het_breuschpagan(residuos_ols, exog)
print(f"Breusch-Pagan p-value: {bp_test[1]:.4f} (<0.05 indica heterocedasticidad)")


features = ['precio_promedio', 'stock_actual', 'categoria', 'marca', 'region', 'ciudad', 'tipo_y']
target = 'cantidad_vendida'

df_ml = df_modelo.dropna(subset=features + [target]).copy()

vars_categoricas = ['categoria', 'marca', 'region', 'ciudad', 'tipo_y']
for col in vars_categoricas:
    df_ml[col] = df_ml[col].astype('category')

X = df_ml[features]
y = df_ml[target]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

modelo_xgb = xgb.XGBRegressor(
    n_estimators=100, learning_rate=0.1, max_depth=6, 
    enable_categorical=True, tree_method='hist', random_state=42
)
modelo_xgb.fit(X_train, y_train)
print(f"✅ XGBoost Entrenado. R2 Score (Test): {modelo_xgb.score(X_test, y_test):.4f}")

# Simulador
escenario_base = X_test.iloc[[100]].copy()
precio_actual = escenario_base['precio_promedio'].values[0]
demanda_base = modelo_xgb.predict(escenario_base)[0]

escenario_sim = escenario_base.copy()
escenario_sim['precio_promedio'] = precio_actual * 1.10
demanda_sim = modelo_xgb.predict(escenario_sim)[0]

elast_sim = ((demanda_sim - demanda_base)/demanda_base) / 0.10
print(f"ELASTICIDAD XGBOOST SIMULADA (Caso Local): {elast_sim:.2f}")

from sklearn.model_selection import ParameterGrid
from sklearn.metrics import r2_score
import time

# 1. Definir el espacio de búsqueda (Hyperparameter Grid)
param_grid = {
    'max_depth': [6, 8],             # Profundidad del árbol: 8 capta más detalles pero puede sobreajustar
    'learning_rate': [0.05, 0.1],    # Qué tan rápido aprende el modelo
    'n_estimators': [50, 100]        # Cantidad de árboles en el bosque
}

grid = list(ParameterGrid(param_grid))
resultados_grid = []

print(f"Iniciando búsqueda iterativa sobre {len(grid)} combinaciones posibles...\n")

mejor_score = -float('inf')
mejor_modelo = None
mejor_params = None

# 2. Ciclo iterativo de entrenamiento y evaluación
for idx, params in enumerate(grid):
    start_time = time.time()
    
    # Instanciar el modelo temporal con los parámetros de esta iteración
    modelo_prueba = xgb.XGBRegressor(
        **params,
        enable_categorical=True,
        tree_method='hist',   # Algoritmo de alta velocidad para data grande
        random_state=42
    )
    
    # Entrenar
    modelo_prueba.fit(X_train, y_train)
    
    # Predecir en datos no vistos (Validación cruzada simple)
    preds = modelo_prueba.predict(X_test)
    score = r2_score(y_test, preds)
    
    tiempo = time.time() - start_time
    print(f"Iteración {idx+1}/{len(grid)} | Parámetros: {params} | R2 Score: {score:.4f} | Tiempo: {tiempo:.1f}s")
    
    resultados_grid.append({'Params': str(params), 'R2_Score': score})
    
    # 3. Guardar el mejor modelo
    if score > mejor_score:
        mejor_score = score
        mejor_modelo = modelo_prueba
        mejor_params = params

print("\n" + "="*60)
print(f"⭐ MEJOR MODELO SELECCIONADO ESTADÍSTICAMENTE:")
print(f"Parámetros: {mejor_params}")
print(f"R2 Score (Varianza explicada): {mejor_score:.4f}")
print("="*60)

# Actualizamos la variable 'modelo_xgb' con el ganador para que los cálculos de elasticidad y feature importance posteriores lo usen.
modelo_xgb = mejor_modelo

# Análisis de Supuestos y Métricas para XGBoost
from sklearn.metrics import r2_score, mean_absolute_percentage_error, mean_absolute_error
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import scipy.stats as stats
from statsmodels.graphics.tsaplots import plot_acf
from statsmodels.stats.stattools import durbin_watson
# 1. Predicciones y cálculo de residuos
y_pred_xgb = modelo_xgb.predict(X_test)
residuos_xgb = y_test - y_pred_xgb
# 2. Métricas Globales
r2_xgb = r2_score(y_test, y_pred_xgb)
mape_xgb = mean_absolute_percentage_error(y_test, y_pred_xgb)
mae_xgb = mean_absolute_error(y_test, y_pred_xgb)
import numpy as np
std_mae_xgb = np.std(np.abs(y_test - y_pred_xgb))
mask_xgb = y_test > 0
std_mape_xgb = np.std(np.abs((y_test[mask_xgb] - y_pred_xgb[mask_xgb]) / y_test[mask_xgb]))
print("--- Métricas de Desempeño (XGBoost) ---")
print(f"R2 Score: {r2_xgb:.4f} (El modelo explica el {r2_xgb*100:.1f}% de la varianza)")
print(f"MAPE: {mape_xgb*100:.2f}% (Error porcentual absoluto medio)")
print(f"Desviación MAPE: {std_mape_xgb*100:.2f}%")
print(f"MAE: {mae_xgb:.2f} (Error absoluto promedio en unidades de demanda)")
print(f"Desviación MAE: {std_mae_xgb:.2f}")
print("-" * 45)
# 3. Muestreo para visualización rápida de gráficos
df_graficas_xgb = pd.DataFrame({'predicciones': y_pred_xgb, 'residuos': residuos_xgb}).dropna()
if len(df_graficas_xgb) > 5000:
    df_graficas_xgb = df_graficas_xgb.sample(5000, random_state=42)
# 4. Gráficas de Diagnóstico de Residuos
fig, axs = plt.subplots(2, 2, figsize=(15, 10))
sns.scatterplot(x=df_graficas_xgb['predicciones'], y=df_graficas_xgb['residuos'], ax=axs[0, 0], alpha=0.5)
axs[0, 0].axhline(y=0, color='r', linestyle='--')
axs[0, 0].set_title('Residuos vs Ajustados XGBoost [Muestra]')
axs[0, 0].set_xlabel('Predicciones')
axs[0, 0].set_ylabel('Residuos')
sns.histplot(df_graficas_xgb['residuos'], kde=True, ax=axs[0, 1], color='coral')
axs[0, 1].set_title('Histograma de Residuos XGBoost [Muestra]')
stats.probplot(df_graficas_xgb['residuos'], dist="norm", plot=axs[1, 0])
axs[1, 0].set_title('Q-Q Plot de Residuos XGBoost [Muestra]')
plot_acf(df_graficas_xgb['residuos'], ax=axs[1, 1], lags=30)
axs[1, 1].set_title('ACF de Residuos XGBoost [Muestra]')
plt.tight_layout()
plt.close("all")
# 5. Pruebas Estadísticas Formales
print("--- Pruebas Estadísticas Formales (XGBoost) ---")
dw_xgb = durbin_watson(residuos_xgb.dropna())
print(f"Durbin-Watson: {dw_xgb:.4f} (Cercano a 2 indica no autocorrelación)")
jb_test_xgb = stats.jarque_bera(residuos_xgb.dropna())
print(f"Jarque-Bera p-value: {jb_test_xgb.pvalue:.4f} (<0.05 indica no normalidad)")
print("Nota: Test Breusch-Pagan no se aplica aquí dado que XGBoost no asume linealidad estructural.")


rentabilidad_prod = ventas.groupby('id_producto').agg(
    ingresos_totales=('precio_total', 'sum'), costo_total_vendido=('costo', 'sum'), unidades_vendidas=('cantidad', 'sum')
).reset_index()
rentabilidad_prod['margen_bruto'] = rentabilidad_prod['ingresos_totales'] - rentabilidad_prod['costo_total_vendido']

costo_unitario = ventas.groupby('id_producto')['costo'].mean().reset_index()
stock_total = stock.groupby('id_producto')['cantidad'].sum().reset_index()

inv_actual = stock_total.merge(costo_unitario, on='id_producto', how='inner')
inv_actual['valor_inventario'] = inv_actual['cantidad'] * inv_actual['costo']

gmroi_df = rentabilidad_prod.merge(inv_actual[['id_producto', 'valor_inventario']], on='id_producto', how='inner')
gmroi_df = gmroi_df[gmroi_df['valor_inventario'] > 0].copy()
gmroi_df['GMROI'] = gmroi_df['margen_bruto'] / gmroi_df['valor_inventario']

gmroi_final = gmroi_df.merge(productos[['id_producto', 'categoria']], on='id_producto', how='left')
print("--- TOP 5 PRODUCTOS POR GMROI (>100 ventas) ---")
print(gmroi_final[gmroi_final['unidades_vendidas'] > 100].sort_values(by='GMROI', ascending=False)[['id_producto', 'GMROI']].head(5))

# 7.1 Modelo Prophet para Validación
print("Entrenando Prophet...")
df_prophet = df_unificado.groupby('fecha').agg(y=('cantidad_vendida', 'sum'), precio_promedio=('precio_promedio', 'mean')).reset_index()
df_prophet.rename(columns={'fecha': 'ds'}, inplace=True)
df_prophet['ds'] = pd.to_datetime(df_prophet['ds'])
m_prophet = Prophet(yearly_seasonality=True, weekly_seasonality=True)
m_prophet.add_regressor('precio_promedio')
m_prophet.fit(df_prophet)
forecast = m_prophet.predict(df_prophet)
df_prophet['prediccion'] = forecast['yhat']
df_prophet['residuos'] = df_prophet['y'] - df_prophet['prediccion']
# 7.2 Verificación de Supuestos (ACF, Q-Q, VIF)
fig, axs = plt.subplots(1, 3, figsize=(18, 5))
plot_acf(df_prophet['residuos'].dropna(), ax=axs[0], lags=30)
axs[0].set_title('ACF Residuos')
sns.histplot(df_prophet['residuos'], kde=True, ax=axs[1], color='coral')
axs[1].set_title('Hist Residuos')
stats.probplot(df_prophet['residuos'].dropna(), dist="norm", plot=axs[2])
axs[2].set_title('Q-Q Plot')
plt.tight_layout()
plt.close("all")
# VIF
exogenas = df_unificado[['precio_promedio', 'stock_actual']].dropna()
vif = [variance_inflation_factor(exogenas.values, i) for i in range(len(exogenas.columns))]
print(f"VIF Variables Exógenas: {dict(zip(exogenas.columns, vif))}")
print("Mitigación: Si VIF > 10 o el Q-Q Plot no es normal, XGBoost (arriba) absorbe esta no linealidad.")
# 7.3 Sensibilidad (MAPE)
print("--- Sensibilidad al hiperparámetro (changepoint_prior_scale) ---")
for cps in [0.01, 0.05, 0.5]:
    m = Prophet(changepoint_prior_scale=cps).add_regressor('precio_promedio').fit(df_prophet)
    pred = m.predict(df_prophet)
    mask = df_prophet['y'] > 0
    from sklearn.metrics import mean_absolute_error
    mape = mean_absolute_percentage_error(df_prophet.loc[mask, 'y'], pred.loc[mask, 'yhat'])
    mae = mean_absolute_error(df_prophet.loc[mask, 'y'], pred.loc[mask, 'yhat'])
    std_mae = np.std(np.abs(df_prophet.loc[mask, 'y'] - pred.loc[mask, 'yhat']))
    std_mape = np.std(np.abs((df_prophet.loc[mask, 'y'] - pred.loc[mask, 'yhat']) / df_prophet.loc[mask, 'y']))
    print(f"Flexibilidad {cps} -> MAPE: {mape*100:.2f}% (Std: {std_mape*100:.2f}%) | MAE: {mae:.2f} (Std: {std_mae:.2f})")
# 7.4 Interpretabilidad
print("\--- Feature Importance XGBoost ---")
imp_dict = dict(zip(features, modelo_xgb.feature_importances_))
for k, v in sorted(imp_dict.items(), key=lambda item: item[1], reverse=True):
    print(f"{k}: {v:.4f}")
# 7.5 Insumo GMROI Histórico
inventario_promedio_historico = stock.groupby('id_producto')['cantidad'].mean().reset_index()
print("Módulo de Insumo de Inventario cargado en memoria para proyectar GMROI.")




