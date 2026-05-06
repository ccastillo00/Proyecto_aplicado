import KPICards from "./KPICards";
import Filters from "./Filters";
import PriceTable from "./PriceTable";
import SKUDetail from "./SKUDetail";

export default function App() {
  return (
    <div className="p-6 space-y-6">
      <KPICards />

      <div className="bg-white p-4 rounded-xl shadow">
        <Filters />
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <PriceTable />
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <SKUDetail />
      </div>
    </div>
  );
}