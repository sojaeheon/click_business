import { useState } from "react";
import { ArrowLeft, Plus, Minus, Package } from "lucide-react";
import { useGame } from "../../store/gameStore";

function ShelfItem({
  name,
  quantity,
  type,
  compact,
}: {
  name: string;
  quantity: number;
  type: "material" | "product";
  compact: boolean;
}) {
  const isMaterial = type === "material";

  return (
    <div className="flex flex-col items-center">
      {/* Box visual */}
      <div
        className={`relative ${compact ? "w-20 h-16" : "w-28 h-24"} border-2 border-gray-400 rounded-lg flex items-center justify-center overflow-hidden`}
        style={{
          background: isMaterial
            ? "linear-gradient(135deg, #e8dcc8 0%, #d4c4a8 50%, #c8b898 100%)"
            : "linear-gradient(135deg, #f0e8d8 0%, #e8dcc8 100%)",
        }}
      >
        {/* Diagonal lines for material boxes */}
        {isMaterial && (
          <>
            <div
              className="absolute inset-0 opacity-20"
              style={{
                background:
                  "repeating-linear-gradient(45deg, transparent, transparent 8px, #999 8px, #999 9px)",
              }}
            />
          </>
        )}
        {/* Label bubble */}
        <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-gray-300">
          <span className="text-xs text-gray-700" style={{ fontWeight: 600 }}>
            {name}
          </span>
        </div>
        {/* Wavy line for product */}
        {!isMaterial && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <svg width="40" height="8" viewBox="0 0 40 8">
              <path
                d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4"
                fill="none"
                stroke="#999"
                strokeWidth="1.5"
              />
            </svg>
          </div>
        )}
      </div>
      {/* Quantity label */}
      <div className="mt-1 bg-white border-2 border-gray-400 rounded-lg px-3 py-1 text-center">
        <span className="text-sm text-gray-800" style={{ fontWeight: 700 }}>
          {quantity}
        </span>
      </div>
    </div>
  );
}

export function WarehousePage() {
  const { state, closeBuildingPage } = useGame();
  const { warehouseItems } = state;
  const [compactView, setCompactView] = useState(false);

  const materials = warehouseItems.filter((i) => i.type === "material");
  const products = warehouseItems.filter((i) => i.type === "product");

  return (
    <div className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-gray-300">
        <div className="flex items-center gap-3">
          <button
            onClick={closeBuildingPage}
            className="w-10 h-10 rounded-full border-2 border-gray-400 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-gray-500">창고</span>
        </div>
        <h1 className="text-2xl" style={{ fontWeight: 800 }}>
          창 고
        </h1>
        <div className="w-10" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 px-6 pt-4">
        <button
          onClick={() => setCompactView(false)}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
            !compactView
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-gray-400 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCompactView(true)}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
            compactView
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-gray-400 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400 ml-2">
          {compactView ? "작게보기" : "크게보기"}
        </span>
      </div>

      {/* Shelves */}
      <div className="flex-1 p-6 flex flex-col justify-center max-w-3xl mx-auto w-full">
        {/* Shelf structure */}
        <div className="relative">
          {/* Shelf frame - vertical pillars */}
          <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#8B7355] to-[#A0896C] rounded-l" />
          <div className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-[#8B7355] to-[#A0896C] rounded-r" />

          <div className="px-8">
            {/* Top shelf - Materials */}
            <div className="border-b-4 border-[#8B7355] pb-4 pt-4">
              <div className="flex items-end justify-center gap-6">
                {materials.map((item) => (
                  <ShelfItem
                    key={item.id}
                    name={item.name}
                    quantity={item.quantity}
                    type={item.type}
                    compact={compactView}
                  />
                ))}
              </div>
            </div>

            {/* Bottom shelf - Products */}
            <div className="border-b-4 border-[#8B7355] pb-4 pt-6">
              <div className="flex items-end justify-center gap-6">
                {products.map((item) => (
                  <ShelfItem
                    key={item.id}
                    name={item.name}
                    quantity={item.quantity}
                    type={item.type}
                    compact={compactView}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Warehouse capacity */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <Package className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-600">
            수용량: {state.warehouseUsed} / {state.warehouseMax}
          </span>
          <div className="w-40 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{
                width: `${(state.warehouseUsed / state.warehouseMax) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="p-6 flex justify-center">
        <button
          onClick={closeBuildingPage}
          className="bg-gray-800 text-white px-10 py-3 rounded-full hover:bg-gray-700 transition-colors cursor-pointer active:scale-95"
          style={{ fontWeight: 700 }}
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
