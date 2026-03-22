// ─────────────────────────────────────────────────────────────────
// 👷 WorkerCard: 캐릭터(일꾼) 카드 공통 컴포넌트
// 인벤토리 모달, 인력소, 작업장 모달에서 동일한 모습으로 표시됩니다.
// ─────────────────────────────────────────────────────────────────
import React from "react";
import { getWorkerDef, WORKER_LEVEL_IMAGES } from "../../../constants/workers";

export interface WorkerItem {
  id: number | string;
  name?: string;
  item_name?: string;
  level?: number;
  locked?: boolean;
  icon?: string;
  type?: string;
}

interface WorkerCardProps {
  item: WorkerItem;
  isSelected?: boolean;
  isSmall?: boolean;      // compact 버전 (작업장 모달 등)
  onClick?: () => void;
}

/** 레벨로 캐릭터 이미지 경로 반환 */
function getWorkerImage(level: number): string {
  return WORKER_LEVEL_IMAGES[level] ?? WORKER_LEVEL_IMAGES[1];
}

/** 이름으로 아이콘 반환 (레거시 호환) */
export function getWorkerIcon(name?: string): string {
  if (!name) return "👤";
  const def = getWorkerDef(name);
  return def.icon;
}

/** 이름으로 3D 모델 경로 반환 */
export function getWorkerModelPath(name?: string): string {
  if (!name) return "/models/characters/Barbarian.glb";
  const def = getWorkerDef(name);
  return def.modelPath;
}

/** 일꾼 카드 컴포넌트 */
export function WorkerCard({ item, isSelected, isSmall, onClick }: WorkerCardProps) {
  const name = item.name || item.item_name || "";
  const level = item.level ?? 1;
  const imgSrc = getWorkerImage(level);

  if (isSmall) {
    // 작업장 모달 등 소형 버전
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 rounded-2xl border-2 p-3 transition-all cursor-pointer
          ${isSelected
            ? "bg-blue-50 border-blue-400 ring-2 ring-blue-300 ring-offset-1"
            : "bg-white border-gray-200 hover:border-amber-400 hover:shadow-md"
          }`}
      >
        <img
          src={imgSrc}
          alt={name}
          className="w-10 h-10 object-contain flex-shrink-0 drop-shadow-md"
        />
        <div className="text-left">
          <div className="text-sm font-black text-slate-800">{name}</div>
          <div className="text-xs font-bold text-amber-600">Lv. {level}</div>
        </div>
      </button>
    );
  }

  // 인벤토리 / HR 풀 사이즈 버전
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-3xl border-[3px] p-5 flex items-center gap-4 transition-all cursor-pointer group
        ${isSelected
          ? "bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400 shadow-lg ring-2 ring-blue-300 ring-offset-2"
          : "bg-white border-slate-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1"
        }`}
    >
      <img
        src={imgSrc}
        alt={name}
        className="w-14 h-14 object-contain flex-shrink-0 drop-shadow-md group-hover:scale-110 transition-transform"
      />
      <div className="text-left">
        <div className="text-lg font-black text-slate-800">{name}</div>
        <div className="text-sm font-bold text-amber-600 mt-0.5">Lv. {level}</div>
      </div>
    </button>
  );
}

/** 장착 슬롯 표시 (인벤토리 왼쪽 / HR 무대 등) */
export function WorkerEquippedDisplay({ worker }: { worker: WorkerItem | null }) {
  const name = worker?.name || worker?.item_name || "";
  const level = worker?.level ?? 1;
  const imgSrc = worker ? getWorkerImage(level) : null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full h-full relative">
      {worker ? (
        <>
          {/* 후광 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-blue-300/30 blur-3xl rounded-full" />
          <img
            src={imgSrc!}
            alt={name}
            className="w-28 h-28 object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.2)] hover:-translate-y-2 transition-transform duration-500 cursor-pointer relative z-10"
          />
          <div className="relative w-48 h-12 mt-2">
            <div className="absolute inset-0 bg-blue-400/20 rounded-[100%] border border-blue-300/40" />
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-white shadow-lg rounded-full px-5 py-1 whitespace-nowrap z-20">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Lv.{level} {name}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center opacity-40">
          <span className="text-7xl mb-3">👤</span>
          <div className="bg-white/50 border border-dashed border-gray-400 rounded-full px-5 py-1 text-gray-500 font-bold text-sm">
            장착 안됨
          </div>
        </div>
      )}
    </div>
  );
}
