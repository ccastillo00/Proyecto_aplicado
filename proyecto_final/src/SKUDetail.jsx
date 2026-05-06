export default function SKUDetail() {
  return (
    <div>
      <h3 className="font-bold text-lg mb-4">
        Detalle TXT-1 - Blusa Body
      </h3>

      <div className="space-y-3">
        <div>
          <p>Full Price</p>
          <div className="bg-gray-200 h-4 rounded">
            <div className="bg-gray-600 h-4 w-2/3"></div>
          </div>
        </div>

        <div>
          <p>-10%</p>
          <div className="bg-gray-200 h-4 rounded">
            <div className="bg-gray-600 h-1/2"></div>
          </div>
        </div>

        <div>
          <p>-20%</p>
          <div className="bg-gray-200 h-4 rounded">
            <div className="bg-gray-600 h-1/3"></div>
          </div>
        </div>
      </div>
    </div>
  );
}