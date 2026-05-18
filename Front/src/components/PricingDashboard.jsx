// PricingDashboard.jsx
// Requiere: React, Tailwind CSS, y las fuentes Syne + DM Mono (Google Fonts)

import { useState } from "react";

// ─── Configuración de KPIs ────────────────────────────────────────────────────
const kpis = [
  {
    label: "GMROI promedio",
    sub: "proyectado",
    value: "3.41",
    unit: "",
    bg: "#EFF6FF",
    circle: "#BFDBFE",
    labelColor: "#1D4ED8",
    valueColor: "#1E3A8A",
    subColor: "#3B82F6",
    icon: "📈",
  },
  {
    label: "SKUs modificados",
    sub: "con cambio de precio",
    value: "47",
    unit: "",
    bg: "#F0FDF4",
    circle: "#BBF7D0",
    labelColor: "#16A34A",
    valueColor: "#14532D",
    subColor: "#22C55E",
    icon: "🏷️",
  },
  {
    label: "Sell-through",
    sub: "proyectado",
    value: "68",
    unit: "%",
    bg: "#FFF7ED",
    circle: "#FED7AA",
    labelColor: "#EA580C",
    valueColor: "#7C2D12",
    subColor: "#F97316",
    icon: "🛒",
  },
  {
    label: "Margen bruto",
    sub: "proyectado",
    value: "52.3",
    unit: "%",
    bg: "#FDF4FF",
    circle: "#E9D5FF",
    labelColor: "#9333EA",
    valueColor: "#581C87",
    subColor: "#A855F7",
    icon: "🧾",
  },
];

// ─── Datos de SKUs ────────────────────────────────────────────────────────────
const skusData = [
  {
    sku: "TXT-1",
    zona: "ZONA_1",
    marca: "A",
    genero: "F",
    prenda: "BLUSA",
    subtipo: "BODY",
    cat: "A",
    tiempo: "1s",
    precioAct: "$89.900",
    precioSug: "$71.500",
    detail: {
      zona: "Zona 1 Tipo A",
      tiempo: "1 semana",
      stock: 2,
      costo: "$32.000",
      scenarios: [
        { label: "Full", pct: 72, gmroi: "2.6", bold: false },
        { label: "-10%", pct: 62, gmroi: "2.5", bold: false },
        { label: "-20%", pct: 48, gmroi: "2.3", bold: true },
      ],
    },
  },
  {
    sku: "TXT-2",
    zona: "ZONA_2",
    marca: "A",
    genero: "M",
    prenda: "PANTALÓN",
    subtipo: "JEAN",
    cat: "A",
    tiempo: "3s",
    precioAct: "$150.000",
    precioSug: "$110.000",
    detail: {
      zona: "Zona 2 Tipo A",
      tiempo: "3 semanas",
      stock: 5,
      costo: "$68.000",
      scenarios: [
        { label: "Full", pct: 80, gmroi: "3.1", bold: false },
        { label: "-10%", pct: 66, gmroi: "2.7", bold: false },
        { label: "-20%", pct: 50, gmroi: "2.1", bold: true },
      ],
    },
  },
];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, sub, value, unit, bg, circle, labelColor, valueColor, subColor, icon, index }) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: "16px",
        padding: "1.25rem",
        position: "relative",
        overflow: "hidden",
        animation: `fadeUp 0.4s ${index * 0.08}s ease both`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-10px",
          right: "-10px",
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: circle,
          opacity: 0.7,
        }}
      />
      <span style={{ fontSize: "20px" }}>{icon}</span>
      <p style={{ fontSize: "12px", color: labelColor, margin: "8px 0 4px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </p>
      <p style={{ fontSize: "32px", fontWeight: 700, color: valueColor, margin: 0, lineHeight: 1 }}>
        {value}<span style={{ fontSize: "20px" }}>{unit}</span>
      </p>
      <p style={{ fontSize: "11px", color: subColor, margin: "6px 0 0" }}>{sub}</p>
    </div>
  );
}

// ─── Filter Select ────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent border-b border-[#d4cfc9] py-2.5 pr-8 text-sm text-[#0f0f0f] cursor-pointer focus:outline-none focus:border-[#0f0f0f] transition-colors"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
      <svg className="absolute right-1 top-3.5 w-3 h-3 text-[#8a8680] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Scenario Bar ─────────────────────────────────────────────────────────────
function ScenarioBar({ label, pct, gmroi, bold }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a8680] w-8 text-right">{label}</span>
      <div className="flex-1 h-5 bg-[#e5e7eb] rounded-sm overflow-hidden">
        <div
          className="h-full rounded-sm transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: bold ? "linear-gradient(90deg,#1D4ED8,#3B82F6)" : "linear-gradient(90deg,#93C5FD,#BFDBFE)",
          }}
        />
      </div>
      <span className={`text-[10px] font-mono w-6 text-right ${bold ? "font-bold text-[#1D4ED8]" : "text-[#8a8680]"}`}>
        {gmroi}
      </span>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function PricingDashboard() {
  const [zona, setZona] = useState("Todas las zonas");
  const [genero, setGenero] = useState("Todos los géneros");
  const [prenda, setPrenda] = useState("Todas las prendas");
  const [marca, setMarca] = useState("Todas las marcas");
  const [selectedSku, setSelectedSku] = useState("TXT-1");

  const filtered = skusData.filter((row) => {
    if (zona !== "Todas las zonas" && row.zona !== zona) return false;
    if (genero !== "Todos los géneros" && row.genero !== genero) return false;
    if (prenda !== "Todas las prendas" && row.prenda !== prenda) return false;
    if (marca !== "Todas las marcas" && row.marca !== marca) return false;
    return true;
  });

  const detail = skusData.find((s) => s.sku === selectedSku) || skusData[0];

  const zonas   = ["Todas las zonas",    ...new Set(skusData.map((s) => s.zona))];
  const generos = ["Todos los géneros",  ...new Set(skusData.map((s) => s.genero))];
  const prendas = ["Todas las prendas",  ...new Set(skusData.map((s) => s.prenda))];
  const marcas  = ["Todas las marcas",   ...new Set(skusData.map((s) => s.marca))];

  const handleExportCSV = () => {
    const headers = ["SKU","Zona","Marca","Género","Prenda","Subtipo","Cat","Tiempo Tienda","Precio Act.","Precio Sugerido"];
    const rows = filtered.map((r) =>
      [r.sku, r.zona, r.marca, r.genero, r.prenda, r.subtipo, r.cat, r.tiempo, r.precioAct, r.precioSug].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sugerencias_precio.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .row-hover:hover { background: #EFF6FF; }
      `}</style>

      <div className="min-h-screen bg-[#f5f2ee] p-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8" style={{ animation: "fadeUp 0.4s ease both" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#1D4ED8]" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#8a8680]">
              Sistema de precios
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[#0f0f0f]">Panel de Sugerencias</h1>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {kpis.map((k, i) => (
            <KPICard key={k.label} {...k} index={i} />
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 mb-4 shadow-sm" style={{ animation: "fadeUp 0.4s 0.1s ease both" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#0f0f0f] text-sm">Sugerencia de precio por SKU</h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 border border-[#d4cfc9] rounded-lg text-[#8a8680] hover:border-[#1D4ED8] hover:text-[#1D4ED8] transition-colors"
              >
                Exportar CSV
              </button>
              <button className="text-[10px] font-mono uppercase tracking-widest px-3 py-1.5 bg-[#1D4ED8] text-white rounded-lg hover:bg-[#1E40AF] transition-colors">
                Aprobar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FilterSelect value={zona}   onChange={setZona}   options={zonas} />
            <FilterSelect value={genero} onChange={setGenero} options={generos} />
            <FilterSelect value={prenda} onChange={setPrenda} options={prendas} />
            <FilterSelect value={marca}  onChange={setMarca}  options={marcas} />
          </div>
        </div>

        {/* Tabla */}
        <div className="border border-[#e5e7eb] rounded-xl overflow-hidden mb-4 shadow-sm" style={{ animation: "fadeUp 0.4s 0.2s ease both" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1D4ED8] text-white">
                {["SKU","Zona","Marca","Género","Prenda","Subtipo","Cat","Tiempo Tienda","Precio Act.","Precio Sugerido"].map((h) => (
                  <th key={h} className="text-[10px] font-mono uppercase tracking-widest px-3 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-[#8a8680] font-mono text-xs">
                    Sin resultados para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.sku}
                    className="row-hover cursor-pointer transition-colors border-t border-[#f3f4f6]"
                    style={selectedSku === row.sku ? { background: "#EFF6FF" } : {}}
                    onClick={() => setSelectedSku(row.sku)}
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#1D4ED8]">{row.sku}</td>
                    <td className="px-3 py-2.5 font-mono text-[#8a8680]">{row.zona}</td>
                    <td className="px-3 py-2.5 font-mono">{row.marca}</td>
                    <td className="px-3 py-2.5 font-mono">{row.genero}</td>
                    <td className="px-3 py-2.5">{row.prenda}</td>
                    <td className="px-3 py-2.5 font-mono text-[#8a8680]">{row.subtipo}</td>
                    <td className="px-3 py-2.5 font-mono">{row.cat}</td>
                    <td className="px-3 py-2.5 font-mono">{row.tiempo}</td>
                    <td className="px-3 py-2.5 font-mono text-[#8a8680]">{row.precioAct}</td>
                    <td className="px-3 py-2.5 font-mono font-semibold text-[#16A34A]">{row.precioSug}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Detalle */}
        <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm" style={{ animation: "fadeUp 0.4s 0.3s ease both" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />
            <h3 className="font-semibold text-[#0f0f0f] text-sm">
              Detalle_{detail.sku} — {detail.prenda} {detail.subtipo}
            </h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Escenarios */}
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#8a8680] mb-4">
                Escenarios Simulados: GMROI Proyectado
              </p>
              <div className="flex flex-col gap-3">
                {detail.detail.scenarios.map((sc) => (
                  <ScenarioBar key={sc.label} {...sc} />
                ))}
              </div>
            </div>

            {/* Razón de cambio */}
            <div style={{ background: "#1D4ED8", borderRadius: "12px", padding: "1rem 1.25rem", color: "white" }}>
              <p style={{ fontSize: "10px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)", marginBottom: "12px", margin: "0 0 12px" }}>
                Razón de cambio
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14px" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{detail.detail.zona}</p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                  Tiempo tienda: <span style={{ color: "white" }}>{detail.detail.tiempo}</span>
                </p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                  Stock disponible: <span style={{ color: "white" }}>{detail.detail.stock} unidades</span>
                </p>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                  Costo: <span style={{ color: "white", fontFamily: "monospace" }}>{detail.detail.costo}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
