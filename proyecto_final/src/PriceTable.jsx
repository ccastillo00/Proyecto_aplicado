export default function PriceTable() {
  const data = [
    {
      sku: "TXT-1",
      zona: "ZONA_1",
      prenda: "Blusa",
      precioActual: 89900,
      precioNuevo: 71500,
    },
  ];

  return (
    <table className="w-full text-left">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Zona</th>
          <th>Prenda</th>
          <th>Precio Actual</th>
          <th>Precio Sugerido</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-t">
            <td>{row.sku}</td>
            <td>{row.zona}</td>
            <td>{row.prenda}</td>
            <td>${row.precioActual}</td>
            <td className="text-green-600 font-bold">
              ${row.precioNuevo}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}