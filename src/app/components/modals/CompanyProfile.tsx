import React from "react";
import { Building2, Package, Backpack, BarChart3, Pencil } from "lucide-react";
import { useGame } from "../../store/gameStore";

export function CompanyProfile() {
  const { state } = useGame();

  return (
    <div>
      <h2 className="text-xl text-gray-800 mb-4" style={{ fontWeight: 700 }}>기업 프로필</h2>

      <div className="bg-white rounded-xl border-2 border-gray-300 p-5">
        <div className="flex gap-6">
          {/* Company icon */}
          <div className="flex-shrink-0">
            <div className="w-28 h-28 bg-gray-100 rounded-xl border-2 border-gray-300 flex items-center justify-center relative">
              <Building2 className="w-16 h-16 text-gray-500" />
              <button className="absolute -bottom-2 -right-2 w-8 h-8 bg-white rounded-full border-2 border-gray-300 flex items-center justify-center hover:bg-gray-100 cursor-pointer">
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Company info */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm w-16">기업명:</span>
              <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>{state.companyName}</span>
              <span className="text-[11px] text-gray-400 ml-2">← 변경불가</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm w-28">현재보유자본:</span>
              <div className="flex-1 border-b border-gray-300 pb-1 flex items-center justify-between">
                <span className="text-gray-700">{state.capital.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">원 / $</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm w-28">부 채:</span>
              <div className="flex-1 border-b border-gray-300 pb-1 flex items-center justify-between">
                <span className="text-gray-700">{state.debt.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">원 / $</span>
              </div>
            </div>
          </div>
        </div>

        {/* Industry & Storage */}
        <div className="mt-5 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 text-sm">산업:</span>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-yellow-700" />
              </div>
              <div>
                <div className="text-gray-800" style={{ fontWeight: 600 }}>{state.industry}</div>
                <BarChart3 className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">창고 수용량:</span>
              <span className="text-gray-700">
                {state.warehouseUsed} / {state.warehouseMax}
              </span>
              <Package className="w-5 h-5 text-gray-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">인벤토리:</span>
              <span className="text-gray-700">
                {state.inventoryUsed} / {state.inventoryMax}
              </span>
              <Backpack className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
