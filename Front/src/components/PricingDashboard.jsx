import { useState, useEffect, useMemo } from "react";

// ─── Inline styles ─────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    background: #edeae4;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .anim { animation: fadeUp 0.4s ease both; }
  .anim-1 { animation: fadeUp 0.4s 0.05s ease both; }
  .anim-2 { animation: fadeUp 0.4s 0.10s ease both; }
  .anim-3 { animation: fadeUp 0.4s 0.15s ease both; }
  .anim-4 { animation: fadeUp 0.4s 0.20s ease both; }
  .anim-5 { animation: fadeUp 0.4s 0.25s ease both; }

  select {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: #1a1a1a;
    cursor: pointer;
    outline: none;
    width: 100%;
  }

  .tr-row { transition: background 0.15s; }
  .tr-row:hover { background: #eff6ff; }
`;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KPI_CARDS = [
  {
    label: "GMROI PROMEDIO",
    valueKey: "gmroi",
    defaultVal: "3.41",
    unit: "",
    sub: "proyectado",
    bg: "#e8eeff",
    circle: "#b8c8f8",
    labelColor: "#2255cc",
    valueColor: "#1a3a99",
    subColor: "#4a7aee",
    icon: (
      <svg width="20" height="20" fill="none" stroke="#2255cc" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M3 3v18h18M7 16l4-4 4 4 4-6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "SKUS MODIFICADOS",
    valueKey: "skusModificados",
    defaultVal: "47",
    unit: "",
    sub: "con cambio de precio",
    bg: "#e6faf0",
    circle: "#a8ecc8",
    labelColor: "#1a8a44",
    valueColor: "#0f5c2d",
    subColor: "#28b060",
    icon: (
      <svg width="20" height="20" fill="none" stroke="#1a8a44" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M7 7H4a1 1 0 00-1 1v10a1 1 0 001 1h16a1 1 0 001-1V8a1 1 0 00-1-1h-3M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M9 12h6M9 16h4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "SELL-THROUGH",
    valueKey: "sellThrough",
    defaultVal: "68",
    unit: "%",
    sub: "proyectado",
    bg: "#fff4e6",
    circle: "#ffd199",
    labelColor: "#cc5500",
    valueColor: "#8a3300",
    subColor: "#ee7722",
    icon: (
      <svg width="20" height="20" fill="none" stroke="#cc5500" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "MARGEN BRUTO",
    valueKey: "margen",
    defaultVal: "52.3",
    unit: "%",
    sub: "proyectado",
    bg: "#f5eeff",
    circle: "#d8b8f8",
    labelColor: "#7722cc",
    valueColor: "#4a1188",
    subColor: "#9944ee",
    icon: (
      <svg width="20" height="20" fill="none" stroke="#7722cc" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

function KPICard({ card, value, animClass }) {
  const displayVal = value !== undefined && value !== null ? value : card.defaultVal;
  return (
    <div
      className={animClass}
      style={{
        background: card.bg,
        borderRadius: "16px",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
        minHeight: "130px",
      }}
    >
      {/* Decorative circle */}
      <div style={{
        position: "absolute",
        top: "-12px",
        right: "-12px",
        width: "72px",
        height: "72px",
        borderRadius: "50%",
        background: card.circle,
        opacity: 0.85,
      }} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: "8px" }}>{card.icon}</div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: card.labelColor, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: "6px" }}>
          {card.label}
        </p>
        <p style={{ fontSize: "36px", fontWeight: 800, color: card.valueColor, lineHeight: 1, marginBottom: "6px" }}>
          {displayVal}<span style={{ fontSize: "22px" }}>{card.unit}</span>
        </p>
        <p style={{ fontSize: "11px", color: card.subColor, fontWeight: 500 }}>{card.sub}</p>
      </div>
    </div>
  );
}

// ─── Filter Select ─────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options, placeholder }) {
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: "100%",
          appearance: "none",
          background: "transparent",
          border: "none",
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          color: "#1a1a1a",
          cursor: "pointer",
          outline: "none",
          paddingRight: "20px",
        }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <svg style={{ position: "absolute", right: "0", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", width: "14px", height: "14px", color: "#666" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────
function ScenarioBar({ label, value, maxValue, isHighlighted }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
      <span style={{ fontSize: "11px", color: "#888", fontWeight: 600, width: "32px", textAlign: "right", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, background: "#e8eeff", borderRadius: "4px", height: "18px", overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: isHighlighted ? "#1d4ed8" : "#93b4f0",
          borderRadius: "4px",
          transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{
        fontSize: "13px",
        fontWeight: isHighlighted ? 800 : 600,
        color: isHighlighted ? "#1d4ed8" : "#555",
        width: "30px",
        textAlign: "right",
        flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── API ───────────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000/api";

// ─── MOCK DATA (usado si el backend no responde) ───────────────────────────────
const MOCK_SKUS = [
  { sku: "TXT-1", zona: "ZONA_1", marca: "A", genero: "F", prenda: "BLUSA",    subtipo: "BODY", cat: "A", tiempo: "1s", precioAct: "$89.900",  precioSug: "$71.500",  precio_num: 89900, costo_num: 32000, stock: 2 },
  { sku: "TXT-2", zona: "ZONA_2", marca: "A", genero: "M", prenda: "PANTALÓN", subtipo: "JEAN", cat: "A", tiempo: "3s", precioAct: "$150.000", precioSug: "$110.000", precio_num: 150000, costo_num: 60000, stock: 5 },
];
const MOCK_FILTERS = {
  zonas:   ["Todas las zonas",    "ZONA_1", "ZONA_2"],
  generos: ["Todos los géneros",  "F", "M"],
  prendas: ["Todas las prendas",  "BLUSA", "PANTALÓN"],
  marcas:  ["Todas las marcas",   "A", "B"],
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function PricingDashboard() {
  const [skusData,    setSkusData]    = useState(MOCK_SKUS);
  const [filtersData, setFiltersData] = useState(MOCK_FILTERS);
  const [zona,   setZona]   = useState("Todas las zonas");
  const [genero, setGenero] = useState("Todos los géneros");
  const [prenda, setPrenda] = useState("Todas las prendas");
  const [marca,  setMarca]  = useState("Todas las marcas");
  const [selectedSku, setSelectedSku] = useState(MOCK_SKUS[0].sku);
  const [simResult,   setSimResult]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [backendUp,   setBackendUp]   = useState(false);

  // Intentar cargar desde el backend
  useEffect(() => {
    async function loadData() {
      try {
        const [resSkus, resFilters] = await Promise.all([
          fetch(`${API_BASE}/skus`),
          fetch(`${API_BASE}/filters`),
        ]);
        if (!resSkus.ok || !resFilters.ok) return;
        const dataSkus    = await resSkus.json();
        const dataFilters = await resFilters.json();
        setSkusData(dataSkus);
        setFiltersData({
          zonas:   dataFilters.zonas    || MOCK_FILTERS.zonas,
          generos: dataFilters.generos  || MOCK_FILTERS.generos,
          prendas: dataFilters.categorias || MOCK_FILTERS.prendas,
          marcas:  dataFilters.marcas   || MOCK_FILTERS.marcas,
        });
        if (dataSkus.length > 0) setSelectedSku(dataSkus[0].sku);
        setBackendUp(true);
      } catch { /* backend offline, usar mock */ }
    }
    loadData();
  }, []);

  // Simular cuando cambia el SKU seleccionado
  useEffect(() => {
    if (!selectedSku || !backendUp) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku: selectedSku, price_change_pct: -20 }),
        });
        if (res.ok) setSimResult(await res.json());
      } catch {}
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedSku, backendUp]);

  const noFiltersActive = useMemo(() => {
    const defaultZona   = filtersData.zonas[0]   || "Todas las zonas";
    const defaultGenero = filtersData.generos[0] || "Todos los géneros";
    const defaultPrenda = filtersData.prendas[0] || "Todas las prendas";
    const defaultMarca  = filtersData.marcas[0]  || "Todas las marcas";
    return zona === defaultZona && genero === defaultGenero && prenda === defaultPrenda && marca === defaultMarca;
  }, [zona, genero, prenda, marca, filtersData]);

  const filtered = useMemo(() => {
    const defaultZona   = filtersData.zonas[0]   || "Todas las zonas";
    const defaultGenero = filtersData.generos[0] || "Todos los géneros";
    const defaultPrenda = filtersData.prendas[0] || "Todas las prendas";
    const defaultMarca  = filtersData.marcas[0]  || "Todas las marcas";

    const result = skusData.filter(r => {
      if (zona   !== defaultZona   && r.zona   !== zona)   return false;
      if (genero !== defaultGenero && r.genero !== genero) return false;
      if (prenda !== defaultPrenda && r.prenda !== prenda) return false;
      if (marca  !== defaultMarca  && r.marca  !== marca)  return false;
      return true;
    });

    // Sin filtros → top 20 por inventario (backend ya los envía ordenados desc)
    if (noFiltersActive) return result.slice(0, 20);
    return result;
  }, [skusData, zona, genero, prenda, marca, filtersData, noFiltersActive]);

  const detail = skusData.find(s => s.sku === selectedSku);


  // KPI global dinámico
  const gmroiRaw = simResult ? simResult.kpis.gmroi : null;
  // Sell-through: demanda_estimada / stock * 100, capped at 100
  const sellThroughCalc = (simResult && detail && detail.stock > 0)
    ? Math.min(100, Math.round((simResult.kpis.demanda_estimada / detail.stock) * 100))
    : null;
  const kpiValues = {
    gmroi:           gmroiRaw !== null ? parseFloat(gmroiRaw.toFixed(2)) : 3.41,
    skusModificados: filtered.length,
    sellThrough:     sellThroughCalc !== null ? sellThroughCalc : 68,
    margen:          simResult ? parseFloat(simResult.kpis.margen.toFixed(1)) : 52.3,
  };

  // Escenarios del panel de detalle
  const detailScenarios = [
    { label: "FULL",  value: simResult ? parseFloat((simResult.kpis.gmroi * 1.13).toFixed(1)) : 2.6 },
    { label: "-10%",  value: simResult ? parseFloat((simResult.kpis.gmroi * 1.09).toFixed(1)) : 2.5 },
    { label: "-20%",  value: simResult ? simResult.kpis.gmroi : 2.3, highlighted: true },
  ];
  const maxScenVal = Math.max(...detailScenarios.map(s => s.value));

  const handleExportCSV = () => {
    const header = "SKU,ZONA,MARCA,GÉNERO,PRENDA,SUBTIPO,CAT,TIEMPO,PRECIO ACT.,PRECIO SUGERIDO\n";
    const rows = filtered.map(r =>
      `${r.sku},${r.zona},${r.marca},${r.genero},${r.prenda},${r.subtipo},${r.cat},${r.tiempo},${r.precioAct},${r.precioSug}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "precios_sugeridos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div style={{ minHeight: "100vh", background: "#edeae4", padding: "32px 24px", maxWidth: "1100px", margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="anim" style={{ marginBottom: "28px" }}>
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#2255cc", letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2255cc", display: "inline-block" }} />
            Sistema de Precios
          </p>
          <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#111", letterSpacing: "-0.02em" }}>
            Panel de Sugerencias
          </h1>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "24px" }}>
          {KPI_CARDS.map((card, i) => (
            <KPICard
              key={card.label}
              card={card}
              value={kpiValues[card.valueKey]}
              animClass={`anim-${i + 1}`}
            />
          ))}
        </div>

        {/* ── SKU Table Card ─────────────────────────────────────────────────── */}
        <div className="anim-3" style={{ background: "#fff", borderRadius: "16px", padding: "20px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          
          {/* Table header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>Sugerencia de precio por SKU</span>
              {noFiltersActive && (
                <span style={{
                  fontSize: "10px", fontWeight: 700, color: "#1d4ed8",
                  background: "#e8eeff", borderRadius: "20px",
                  padding: "3px 10px", letterSpacing: "0.04em",
                }}>
                  ↑ Top 20 · Mayor inventario
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={handleExportCSV}
                style={{
                  padding: "7px 16px", fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  border: "1.5px solid #ccc", borderRadius: "8px",
                  background: "#fff", color: "#444", cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#1d4ed8"; e.currentTarget.style.color = "#1d4ed8"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#ccc";    e.currentTarget.style.color = "#444"; }}
              >
                Exportar CSV
              </button>
              <button
                style={{
                  padding: "7px 20px", fontSize: "11px", fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  border: "none", borderRadius: "8px",
                  background: "#1d4ed8", color: "#fff", cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#1639a8"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#1d4ed8"; }}
              >
                Aprobar
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #eee", paddingBottom: "14px", marginBottom: "16px" }}>
            {[
              { value: zona,   onChange: setZona,   options: filtersData.zonas },
              { value: genero, onChange: setGenero, options: filtersData.generos },
              { value: prenda, onChange: setPrenda, options: filtersData.prendas },
              { value: marca,  onChange: setMarca,  options: filtersData.marcas },
            ].map((f, i) => (
              <div key={i} style={{
                flex: 1,
                padding: "0 16px",
                borderRight: i < 3 ? "1px solid #eee" : "none",
              }}>
                <FilterSelect {...f} />
              </div>
            ))}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto", maxHeight: "340px", overflowY: "auto", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: "#1d4ed8" }}>
                  {["SKU","ZONA","MARCA","GÉNERO","PRENDA","SUBTIPO","CAT","TIEMPO TIENDA","PRECIO ACT.","PRECIO SUGERIDO"].map(h => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: "left",
                      fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
                      color: "#fff", whiteSpace: "nowrap",
                      background: "#1d4ed8",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "24px", textAlign: "center", color: "#999", fontSize: "13px" }}>
                      Sin datos disponibles
                    </td>
                  </tr>
                ) : filtered.map((row, idx) => {
                  const isSelected = selectedSku === row.sku;
                  return (
                    <tr
                      key={row.sku}
                      className="tr-row"
                      onClick={() => setSelectedSku(row.sku)}
                      style={{
                        background: isSelected ? "#eff6ff" : idx % 2 === 0 ? "#fff" : "#fafafa",
                        borderTop: "1px solid #f0f0f0",
                        cursor: "pointer",
                      }}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: "#1d4ed8", fontSize: "12px" }}>{row.sku}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px" }}>{row.zona}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px" }}>{row.marca}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px" }}>{row.genero}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px", fontWeight: 600 }}>{row.prenda}</td>
                      <td style={{ padding: "10px 12px", color: "#666", fontSize: "12px" }}>{row.subtipo}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px" }}>{row.cat}</td>
                      <td style={{ padding: "10px 12px", color: "#444", fontSize: "12px" }}>{row.tiempo}</td>
                      <td style={{ padding: "10px 12px", color: "#555", fontSize: "12px" }}>{row.precioAct}</td>
                      <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 700, fontSize: "12px" }}>{row.precioSug}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Detail Section ─────────────────────────────────────────────────── */}
        {detail && (
          <div className="anim-4" style={{ background: "#fff", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {/* Detail header */}
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "15px", fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1d4ed8", display: "inline-block", flexShrink: 0 }} />
                Detalle_{detail.sku} — {detail.prenda} {detail.subtipo}
              </p>
              <p style={{ fontSize: "10px", fontWeight: 600, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "6px" }}>
                Escenarios simulados: GMROI proyectado
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "24px", alignItems: "start" }}>
              {/* Bar chart */}
              <div style={{ paddingTop: "4px" }}>
                {detailScenarios.map(s => (
                  <ScenarioBar
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    maxValue={maxScenVal}
                    isHighlighted={!!s.highlighted}
                  />
                ))}
              </div>

              {/* Razón de cambio card */}
              <div style={{
                background: "#1d4ed8",
                borderRadius: "14px",
                padding: "18px 22px",
                color: "#fff",
                minWidth: "220px",
              }}>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a8c4ff", marginBottom: "10px" }}>
                  Razón de Cambio
                </p>
                <p style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px" }}>
                  {detail.zona} Tipo {detail.cat}
                </p>
                <div style={{ fontSize: "13px", lineHeight: 1.8 }}>
                  <p>Tiempo tienda: <strong>{detail.tiempo === "1s" ? "1 semana" : detail.tiempo === "3s" ? "3 semanas" : detail.tiempo}</strong></p>
                  <p>Stock disponible: <strong>{detail.stock} unidades</strong></p>
                  <p>Costo: <strong>${detail.costo_num.toLocaleString("es-CL")}</strong></p>
                </div>
              </div>
            </div>

            {loading && (
              <p style={{ textAlign: "center", color: "#1d4ed8", fontSize: "12px", marginTop: "12px", fontWeight: 600 }}>
                Simulando con XGBoost…
              </p>
            )}
          </div>
        )}

      </div>
    </>
  );
}
