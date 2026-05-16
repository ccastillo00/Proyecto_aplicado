import { useState, useEffect, useMemo } from "react";
// Importar recharts para la curva de demanda (El usuario deberá instalarlo: npm install recharts)
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot
} from "recharts";

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

const API_BASE = "http://localhost:8000/api";

export default function PricingDashboard() {
  const [skusData, setSkusData] = useState([]);
  const [filtersData, setFiltersData] = useState({ zonas: [], generos: [], prendas: [], marcas: [] });
  
  const [zona, setZona] = useState("Todas las zonas");
  const [genero, setGenero] = useState("Todos los géneros");
  const [prenda, setPrenda] = useState("Todas las categorias");
  const [marca, setMarca] = useState("Todas las marcas");
  const [selectedSku, setSelectedSku] = useState(null);
  
  // Estados para simulación
  const [sliderValue, setSliderValue] = useState(0);
  const [simulationResult, setSimulationResult] = useState(null);
  const [loadingSim, setLoadingSim] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    async function loadData() {
      try {
        const [resSkus, resFilters] = await Promise.all([
          fetch(`${API_BASE}/skus`),
          fetch(`${API_BASE}/filters`)
        ]);
        const dataSkus = await resSkus.json();
        const dataFilters = await resFilters.json();
        
        setSkusData(dataSkus);
        setFiltersData({
          zonas: dataFilters.zonas || ["Todas las zonas"],
          generos: dataFilters.generos || ["Todos los géneros"],
          prendas: dataFilters.categorias || ["Todas las categorias"],
          marcas: dataFilters.marcas || ["Todas las marcas"]
        });
        
        if (dataSkus.length > 0) {
          setSelectedSku(dataSkus[0].sku);
        }
      } catch (err) {
        console.error("Error cargando backend:", err);
      }
    }
    loadData();
  }, []);

  // Simular precio cuando cambia el slider o el SKU seleccionado
  useEffect(() => {
    if (!selectedSku) return;
    
    // Debounce para evitar sobrecargar el backend mientras se mueve el slider
    const timer = setTimeout(async () => {
      setLoadingSim(true);
      try {
        const res = await fetch(`${API_BASE}/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: selectedSku, price_change_pct: sliderValue })
        });
        if (res.ok) {
          const data = await res.json();
          setSimulationResult(data);
        }
      } catch (err) {
        console.error("Error simulando:", err);
      } finally {
        setLoadingSim(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [sliderValue, selectedSku]);

  // Restablecer slider al cambiar de SKU
  useEffect(() => {
    setSliderValue(0);
  }, [selectedSku]);

  const filtered = useMemo(() => {
    return skusData.filter((row) => {
      if (zona !== "Todas las zonas" && row.zona !== zona) return false;
      if (genero !== "Todos los géneros" && row.genero !== genero) return false;
      if (prenda !== "Todas las categorias" && row.prenda !== prenda) return false;
      if (marca !== "Todas las marcas" && row.marca !== marca) return false;
      return true;
    });
  }, [skusData, zona, genero, prenda, marca]);

  const detail = skusData.find((s) => s.sku === selectedSku);

  // KPIs dinámicos
  const kpis = [
    {
      label: "GMROI",
      sub: "proyectado (en tiempo real)",
      value: simulationResult ? simulationResult.kpis.gmroi : "-",
      unit: "",
      bg: "#EFF6FF", circle: "#BFDBFE", labelColor: "#1D4ED8", valueColor: "#1E3A8A", subColor: "#3B82F6", icon: "📈",
    },
    {
      label: "Margen Bruto",
      sub: "proyectado",
      value: simulationResult ? simulationResult.kpis.margen : "-",
      unit: "%",
      bg: "#F0FDF4", circle: "#BBF7D0", labelColor: "#16A34A", valueColor: "#14532D", subColor: "#22C55E", icon: "🧾",
    },
    {
      label: "Demanda Estimada",
      sub: "unidades XGBoost",
      value: simulationResult ? simulationResult.kpis.demanda_estimada : "-",
      unit: " u",
      bg: "#FFF7ED", circle: "#FED7AA", labelColor: "#EA580C", valueColor: "#7C2D12", subColor: "#F97316", icon: "🛒",
    },
    {
      label: "Nuevo Precio",
      sub: "simulado",
      value: simulationResult ? simulationResult.kpis.nuevo_precio : "-",
      unit: "$",
      bg: "#FDF4FF", circle: "#E9D5FF", labelColor: "#9333EA", valueColor: "#581C87", subColor: "#A855F7", icon: "🏷️",
    },
  ];

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .row-hover:hover { background: #EFF6FF; }
        
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #1D4ED8;
          cursor: pointer;
          margin-top: -8px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 6px;
          cursor: pointer;
          background: #e5e7eb;
          border-radius: 3px;
        }
      `}</style>

      <div className="min-h-screen bg-[#f5f2ee] p-6 max-w-6xl mx-auto">
        <div className="mb-8" style={{ animation: "fadeUp 0.4s ease both" }}>
          <h1 className="text-2xl font-bold text-[#0f0f0f]">Panel de Precios Dinámicos (XGBoost)</h1>
          <p className="text-sm text-gray-500">Mueve el slider para recalcular la elasticidad de demanda con el modelo entrenado.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {kpis.map((k, i) => <KPICard key={k.label} {...k} index={i} />)}
        </div>

        {/* Layout principal */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Columna Izquierda: Tabla y Filtros */}
          <div className="md:col-span-2">
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 mb-4 shadow-sm" style={{ animation: "fadeUp 0.4s 0.1s ease both" }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FilterSelect value={zona}   onChange={setZona}   options={filtersData.zonas} />
                <FilterSelect value={genero} onChange={setGenero} options={filtersData.generos} />
                <FilterSelect value={prenda} onChange={setPrenda} options={filtersData.prendas} />
                <FilterSelect value={marca}  onChange={setMarca}  options={filtersData.marcas} />
              </div>
            </div>

            <div className="border border-[#e5e7eb] rounded-xl overflow-auto shadow-sm max-h-[500px]" style={{ animation: "fadeUp 0.4s 0.2s ease both" }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#1D4ED8]">
                  <tr className="text-white">
                    {["SKU","Marca","Categoría","Stock","Precio Act.","Costo Estim."].map((h) => (
                      <th key={h} className="text-[10px] font-mono uppercase tracking-widest px-3 py-3 text-left font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">Sin datos de la API (Asegúrate de tener el Backend FastAPI corriendo)</td></tr>
                  ) : (
                    filtered.map((row) => (
                      <tr
                        key={row.sku}
                        className="row-hover cursor-pointer transition-colors border-t border-[#f3f4f6]"
                        style={selectedSku === row.sku ? { background: "#EFF6FF" } : {}}
                        onClick={() => setSelectedSku(row.sku)}
                      >
                        <td className="px-3 py-2.5 font-mono font-semibold text-[#1D4ED8]">{row.sku}</td>
                        <td className="px-3 py-2.5 font-mono">{row.marca}</td>
                        <td className="px-3 py-2.5 font-mono">{row.prenda} {row.subtipo}</td>
                        <td className="px-3 py-2.5 font-mono text-red-600 font-bold">{row.stock}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-600">{row.precioAct}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500">${row.costo_num.toFixed(0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Columna Derecha: Simulación y Gráfico */}
          {detail && (
            <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 shadow-sm h-fit" style={{ animation: "fadeUp 0.4s 0.3s ease both" }}>
              <div className="mb-4">
                <h3 className="font-semibold text-lg">Simulador de Demanda</h3>
                <p className="text-xs text-gray-500 mb-6">SKU: <span className="font-mono text-[#1D4ED8]">{detail.sku}</span> | Stock: {detail.stock}</p>
                
                {/* Slider de Precio */}
                <div className="mb-8">
                  <div className="flex justify-between text-sm font-semibold text-gray-700 mb-2">
                    <span>-30%</span>
                    <span className="text-lg text-[#1D4ED8]">{sliderValue > 0 ? `+${sliderValue}%` : `${sliderValue}%`}</span>
                    <span>+30%</span>
                  </div>
                  <input 
                    type="range" 
                    min="-30" 
                    max="30" 
                    step="1" 
                    value={sliderValue} 
                    onChange={(e) => setSliderValue(Number(e.target.value))} 
                  />
                  <div className="text-center mt-2 text-xs text-gray-500">
                    Precio actual: {detail.precioAct}
                  </div>
                </div>

                {/* Gráfico Recharts */}
                <div className="mt-6">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#8a8680] mb-2 text-center">Curva Elástica de Demanda</p>
                  <div className="h-[250px] w-full relative">
                    {loadingSim && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                        <span className="text-sm font-semibold animate-pulse text-[#1D4ED8]">Simulando XGBoost...</span>
                      </div>
                    )}
                    {simulationResult && simulationResult.curve && (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={simulationResult.curve}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis dataKey="variation" tickFormatter={(val) => `${val}%`} style={{fontSize: '10px'}} />
                          <YAxis style={{fontSize: '10px'}} />
                          <Tooltip 
                            formatter={(value, name) => [Math.round(value), name === 'demanda' ? 'Demanda Proyectada' : name]} 
                            labelFormatter={(label) => `Variación: ${label}%`}
                          />
                          <Line type="monotone" dataKey="demanda" stroke="#1D4ED8" strokeWidth={3} dot={false} />
                          {/* Punto actual resaltado */}
                          <ReferenceDot x={sliderValue} y={simulationResult.kpis.demanda_estimada} r={6} fill="#EA580C" stroke="white" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
