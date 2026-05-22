from pathlib import Path

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st


ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"


st.set_page_config(
    page_title="Pricing AI",
    page_icon="$",
    layout="wide",
)


st.markdown(
    """
    <style>
    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    [data-testid="stMetricValue"] {
        font-size: 2rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data(show_spinner="Cargando datos...")
def load_and_prepare_data() -> pd.DataFrame:
    cols = [
        "lunes",
        "Zona",
        "Marca",
        "Genero",
        "TipoPrenda",
        "Tipo1",
        "Tipo2",
        "Tipo4",
        "Tipo6",
        "CategoriaProducto",
        "cantidad",
        "costo",
        "precio_full",
        "precio_real",
        "tiempo_en_tienda",
        "stock_modelo",
    ]
    df = pd.read_csv(DATA_DIR / "df_master_precios_dinamicos.csv", usecols=cols)
    df = df.rename(
        columns={
            "lunes": "fecha",
            "Zona": "zona",
            "Marca": "marca",
            "Genero": "genero",
            "TipoPrenda": "categoria",
            "Tipo1": "subcategoria",
            "stock_modelo": "stock_actual",
        }
    )

    numeric_cols = ["cantidad", "costo", "precio_full", "precio_real", "stock_actual"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["fecha"] = pd.to_datetime(df["fecha"], errors="coerce")
    df["precio_promedio"] = df["precio_real"].where(df["precio_real"] > 0, df["precio_full"])
    df = df[df["precio_promedio"] > 0].copy()
    df["costo"] = df["costo"].where(df["costo"] > 0, df["precio_promedio"] * 0.6)

    sku_cols = [
        "marca",
        "genero",
        "categoria",
        "subcategoria",
        "Tipo2",
        "Tipo4",
        "Tipo6",
        "CategoriaProducto",
    ]
    sku_key = df[sku_cols].fillna("-").astype(str).agg("|".join, axis=1)
    df["id_producto"] = [f"SKU_{value:05d}" for value in pd.factorize(sku_key)[0] + 1]

    df_ml = df.copy()
    df_ml.sort_values(["id_producto", "zona", "fecha"], inplace=True)

    df_ml["mes"] = df_ml["fecha"].dt.month
    df_ml["dia_semana"] = df_ml["fecha"].dt.dayofweek
    df_ml["es_fin_de_semana"] = df_ml["dia_semana"].isin([5, 6]).astype(int)
    df_ml["cantidad_lag_1"] = (
        df_ml.groupby(["id_producto", "zona"])["cantidad"].shift(1).fillna(0)
    )
    df_ml["cantidad_lag_7"] = (
        df_ml.groupby(["id_producto", "zona"])["cantidad"].shift(7).fillna(0)
    )
    df_ml["cantidad_roll_mean_7"] = (
        df_ml.groupby(["id_producto", "zona"])["cantidad"]
        .transform(lambda x: x.shift(1).rolling(window=7, min_periods=1).mean())
        .fillna(0)
    )
    df_ml.sort_values("fecha", inplace=True)
    return df_ml


def format_money(value: float) -> str:
    return f"${value:,.0f}".replace(",", ".")


def build_last_records(df_ml: pd.DataFrame) -> pd.DataFrame:
    last_records = df_ml.sort_values("fecha").groupby("id_producto").tail(1).copy()
    last_records["zona"] = last_records["zona"].astype("string").fillna("Sin zona")
    last_records["precio_sugerido"] = last_records["precio_promedio"] * 0.9
    last_records["margen_bruto"] = (
        (last_records["precio_sugerido"] - last_records["costo"])
        / last_records["precio_sugerido"].replace(0, np.nan)
    ) * 100
    return last_records.sort_values("stock_actual", ascending=False)


def simulate_sku(
    df_ml: pd.DataFrame,
    sku: str,
    price_change_pct: float,
) -> tuple[dict, pd.DataFrame]:
    sku_data = df_ml[df_ml["id_producto"].astype(str) == sku].sort_values("fecha").tail(1)
    if sku_data.empty:
        raise ValueError("SKU no encontrado")

    base_row = sku_data.iloc[0]
    precio_base = float(base_row["precio_promedio"])
    costo = float(base_row.get("costo", precio_base * 0.6))
    stock = float(base_row.get("stock_actual", 0))
    nuevo_precio = precio_base * (1 + price_change_pct / 100)

    elasticidad_teorica = -1.8
    demanda_base = max(
        0.1,
        float(
            base_row.get("cantidad_roll_mean_7", 0)
            or base_row.get("cantidad_lag_7", 0)
            or base_row.get("cantidad_lag_1", 0)
            or base_row.get("cantidad", 0)
            or 0.1
        ),
    )
    demanda_pred = max(0.1, demanda_base * ((nuevo_precio / precio_base) ** elasticidad_teorica))
    margen_unitario = nuevo_precio - costo
    margen_bruto_pct = (margen_unitario / nuevo_precio) * 100 if nuevo_precio > 0 else 0
    valor_inventario = stock * costo if stock > 0 else costo
    gmroi = (margen_unitario * max(demanda_pred, 0.01) * 52) / valor_inventario
    sell_through = min(100, (demanda_pred / stock) * 100) if stock > 0 else 0

    variations = np.arange(-30, 35, 5)
    prices = precio_base * (1 + variations / 100)

    curve = pd.DataFrame(
        {
            "variacion": variations,
            "precio": prices,
            "demanda": [
                max(0.1, demanda_base * ((price / precio_base) ** elasticidad_teorica))
                for price in prices
            ],
        }
    )

    return (
        {
            "precio_base": precio_base,
            "nuevo_precio": nuevo_precio,
            "demanda": demanda_pred,
            "gmroi": gmroi,
            "margen": margen_bruto_pct,
            "sell_through": sell_through,
        },
        curve,
    )


st.title("Pricing AI")
st.caption("Simulador de precios dinamicos basado en demanda, inventario y margen.")

df_ml = load_and_prepare_data()
last_records = build_last_records(df_ml)

with st.sidebar:
    st.header("Filtros")
    zona_options = ["Todas"] + sorted(last_records["zona"].dropna().astype(str).unique().tolist())
    marca_options = ["Todas"] + sorted(last_records.get("marca", pd.Series(dtype=str)).dropna().astype(str).unique().tolist())
    genero_options = ["Todos"] + sorted(last_records.get("genero", pd.Series(dtype=str)).dropna().astype(str).unique().tolist())
    categoria_options = ["Todas"] + sorted(last_records.get("categoria", pd.Series(dtype=str)).dropna().astype(str).unique().tolist())

    zona = st.selectbox("Zona", zona_options)
    marca = st.selectbox("Marca", marca_options)
    genero = st.selectbox("Genero", genero_options)
    categoria = st.selectbox("Categoria", categoria_options)
    price_change = st.slider("Cambio de precio", -30, 30, -10, step=5, format="%d%%")

filtered = last_records.copy()
if zona != "Todas":
    filtered = filtered[filtered["zona"].astype(str) == zona]
if marca != "Todas" and "marca" in filtered.columns:
    filtered = filtered[filtered["marca"].astype(str) == marca]
if genero != "Todos" and "genero" in filtered.columns:
    filtered = filtered[filtered["genero"].astype(str) == genero]
if categoria != "Todas" and "categoria" in filtered.columns:
    filtered = filtered[filtered["categoria"].astype(str) == categoria]

if filtered.empty:
    st.warning("No hay SKUs para los filtros seleccionados.")
    st.stop()

sku_options = filtered["id_producto"].astype(str).tolist()
selected_sku = st.selectbox("SKU", sku_options)
metrics, curve = simulate_sku(df_ml, selected_sku, price_change)

col1, col2, col3, col4 = st.columns(4)
col1.metric("GMROI", f"{metrics['gmroi']:.2f}")
col2.metric("Sell-through", f"{metrics['sell_through']:.1f}%")
col3.metric("Margen bruto", f"{metrics['margen']:.1f}%")
col4.metric("Nuevo precio", format_money(metrics["nuevo_precio"]))

chart = (
    alt.Chart(curve)
    .mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4)
    .encode(
        x=alt.X("variacion:O", title="Variacion de precio (%)"),
        y=alt.Y("demanda:Q", title="Demanda estimada"),
        color=alt.condition(
            alt.datum.variacion == price_change,
            alt.value("#1d4ed8"),
            alt.value("#93b4f0"),
        ),
        tooltip=["variacion", "precio", "demanda"],
    )
    .properties(height=280)
)
st.altair_chart(chart, use_container_width=True)

table = filtered[
    [
        "id_producto",
        "zona",
        "marca",
        "genero",
        "categoria",
        "subcategoria",
        "precio_promedio",
        "precio_sugerido",
        "stock_actual",
        "margen_bruto",
    ]
].rename(
    columns={
        "id_producto": "SKU",
        "precio_promedio": "Precio actual",
        "precio_sugerido": "Precio sugerido",
        "stock_actual": "Stock",
        "margen_bruto": "Margen bruto %",
    }
)

st.subheader("Top SKUs por inventario")
st.dataframe(table.head(50), use_container_width=True, hide_index=True)

st.download_button(
    "Descargar sugerencias CSV",
    data=table.to_csv(index=False).encode("utf-8"),
    file_name="sugerencias_precios.csv",
    mime="text/csv",
)
