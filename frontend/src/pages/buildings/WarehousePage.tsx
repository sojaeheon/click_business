import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Minus, Package } from "lucide-react";
import { useGame } from "../../app/store/gameStore";
import { inventoryApi } from "../../api/services";
import type { InventorySlot } from "../../api/types";

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
    <div className="flex flex-col items-center group cursor-pointer">
      {/* Box visual - Glassmorphism & Soft gradients */}
      <div
        className={`relative ${compact ? "w-24 h-20" : "w-32 h-28"} rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] shadow-lg ring-1 ring-white/40`}
        style={{
          background: isMaterial
            ? "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.25) 100%)"
            : "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.25) 100%)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />

        <Package 
          className={`w-1/2 h-1/2 drop-shadow-md transition-transform group-hover:scale-110 ${isMaterial ? "text-yellow-600" : "text-blue-500"}`}
        />

        {/* Label bubble */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/50 shadow-sm z-10">
          <span className="text-[10px] text-gray-800 font-bold mix-blend-multiply">
            {name}
          </span>
        </div>
      </div>
      
      {/* Quantity label */}
      <div className="mt-3 bg-white/90 backdrop-blur border border-white/50 shadow-md rounded-xl px-4 py-1.5 text-center transform transition-all group-hover:scale-105">
        <span className="text-sm text-gray-800 font-black tracking-wide">
          {quantity.toLocaleString()} 개
        </span>
      </div>
    </div>
  );
}

export function WarehousePage() {
  const { state, closeBuildingPage } = useGame();
  const [compactView, setCompactView] = useState(false);
  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi.getSlots()
      .then((res) => {
        setSlots(res.data.data.filter((s) => s.itemId !== null));
      })
      .catch((err) => {
      })
      .finally(() => setLoading(false));
  }, []);

  const materials = slots.filter((s) => s.itemType === "MATERIAL");
  const products  = slots.filter((s) => s.itemType === "PRODUCT");
  const used = slots.reduce((sum, s) => sum + s.quantity, 0);

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
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${!compactView
              ? "border-gray-800 bg-gray-800 text-white"
              : "border-gray-400 text-gray-500 hover:bg-gray-200"
            }`}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCompactView(true)}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${compactView
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
      <div className="flex-1 p-6 flex flex-col justify-center max-w-4xl mx-auto w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f5f0e8]/80 z-50">
          <div className="w-10 h-10 border-4 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
        </div>
      )}
        {/* Shelf structure - Modern Glass/wood mix */}
        <div className="relative bg-white/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/50 shadow-2xl">
          <div className="px-4">
            {/* Top shelf - Materials */}
            <div className="mb-8">
              <h3 className="text-gray-500 font-bold mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500"></div> 원자재</h3>
              <div className="flex flex-wrap items-end justify-start gap-8">
                {materials.map((slot) => (
                  <ShelfItem
                    key={slot.slotIndex}
                    name={slot.itemName!}
                    quantity={slot.quantity}
                    type="material"
                    compact={compactView}
                  />
                ))}
              </div>
            </div>

            {/* Bottom shelf - Products */}
            <div className="pt-4 border-t border-gray-300/50">
              <h3 className="text-gray-500 font-bold mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> 생산품</h3>
              <div className="flex flex-wrap items-end justify-start gap-8">
                {products.map((slot) => (
                  <ShelfItem
                    key={slot.slotIndex}
                    name={slot.itemName!}
                    quantity={slot.quantity}
                    type="product"
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
            수용량: {used} / {state.warehouseMax}
          </span>
          <div className="w-40 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{
                width: `${(used / state.warehouseMax) * 100}%`,
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
