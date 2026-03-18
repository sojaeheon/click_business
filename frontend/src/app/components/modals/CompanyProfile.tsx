import { useState, useEffect } from "react";
import { Building2, Package, Backpack, BarChart3, Factory } from "lucide-react";
import { useGame, useGameStore } from "../../../store/gameStore";
import { InventoryAPI } from "../../../api/gameApi";

export function CompanyProfile() {
  const { state } = useGame();
  const usedSlots = useGameStore(s => s.getWarehouseUsage().usedSlots);
  const maxSlots = useGameStore(s => s.warehouseMaxSlots);

  const [inventoryUsed, setInventoryUsed] = useState(0);
  const [inventoryUnlocked, setInventoryUnlocked] = useState(state.inventoryMax);

  // 이자가 포함된 총 부채 계산
  const totalDebt = Math.floor(state.bankData.currentLoan * (1 + state.bankData.loanRate / 100));

  useEffect(() => {
    InventoryAPI.getInventory(1)
      .then((res) => {
        const slots = res.data;
        const used = slots.filter((s: any) => s.name).length;
        const unlocked = slots.filter((s: any) => !s.locked).length;
        setInventoryUsed(used);
        setInventoryUnlocked(unlocked);
      })
      .catch((err) => {
        console.error("인벤토리 오류:", err);
      });
  }, []);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl text-gray-800 mb-6" style={{ fontWeight: 700 }}>기업 프로필</h2>

      <div className="bg-white rounded-2xl border-2 border-gray-300 p-8 flex-1 flex flex-col">
        <div className="flex gap-10">
          {/* Company icon */}
          <div className="flex-shrink-0">
            <div className="w-36 h-36 bg-gray-100 rounded-2xl border-2 border-gray-300 flex items-center justify-center relative shadow-sm">
              <Building2 className="w-20 h-20 text-gray-500" />
            </div>
          </div>

          {/* Company info */}
          <div className="flex-1 space-y-6 flex flex-col justify-center">
            {/* 1. 기업명 */}
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm w-24">기 업 명 :</span>
              <span className="text-lg text-gray-800" style={{ fontWeight: 700 }}>{state.companyName}</span>
            </div>

            {/* 2. 현재보유자본(보유 돈 연동) */}
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm w-24">보유 돈 :</span>
              <div className="flex-1 border-b-2 border-gray-300 pb-1 flex items-center justify-between">
                <span className="text-lg text-gray-700">{state.money.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">원</span>
              </div>
            </div>

            {/* 3. 부채(은행 부채 연동 + 이자) */}
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm w-24">부 채 :</span>
              <div className="flex-1 border-b-2 border-gray-300 pb-1 flex items-center justify-between">
                <span className="text-lg text-gray-700">{totalDebt.toLocaleString()}</span>
                <span className="text-gray-500 text-sm">원</span>
              </div>
            </div>
          </div>
        </div>

        {/* Industry & Storage */}
        <div className="mt-auto pt-8 border-t-2 border-gray-200 grid grid-cols-2 gap-8">
          {/* 산업 */}
          <div className="flex items-center gap-4">
            <span className="text-gray-500 text-sm">산업 :</span>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center shadow-sm">
                <BarChart3 className="w-6 h-6 text-yellow-700" />
              </div>
              <div>
                <div className="text-gray-800 mb-0.5" style={{ fontWeight: 600 }}>{state.industry}</div>
              </div>
            </div>
          </div>

          {/* 창고 & 인벤토리 */}
          <div className="space-y-5 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm w-28">창고 슬롯 사용량 :</span>
              <span className="text-gray-700 font-bold">{usedSlots} / {maxSlots}</span>
              <Package className="w-5 h-5 text-gray-400 ml-auto" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500 text-sm w-28">인벤토리 :</span>
              <span className="text-gray-700">{inventoryUsed} / {inventoryUnlocked}</span>
              <Backpack className="w-5 h-5 text-gray-400 ml-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
