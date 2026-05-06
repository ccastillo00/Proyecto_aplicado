export default function KPICards() {
  const data = [
    { title: "GMROI proyectado", value: "3.41" },
    { title: "SKUs con cambio", value: "47" },
    { title: "Sell-through", value: "68%" },
    { title: "Margen bruto", value: "52.3%" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {data.map((kpi, i) => (
        <div key={i} className="bg-white p-4 rounded-xl shadow">
          <p className="text-gray-500">{kpi.title}</p>
          <h2 className="text-3xl font-bold">{kpi.value}</h2>
        </div>
      ))}
    </div>
  );
}