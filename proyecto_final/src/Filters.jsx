export default function Filters() {
  return (
    <div className="grid grid-cols-4 gap-4">
      <select className="border p-2 rounded">
        <option>Todas las zonas</option>
      </select>

      <select className="border p-2 rounded">
        <option>Todos los géneros</option>
      </select>

      <select className="border p-2 rounded">
        <option>Todas las prendas</option>
      </select>

      <select className="border p-2 rounded">
        <option>Todas las marcas</option>
      </select>
    </div>
  );
}