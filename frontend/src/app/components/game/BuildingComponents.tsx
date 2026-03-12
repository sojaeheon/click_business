/// <reference types="@react-three/fiber" />
import React from "react";
import { Html } from "@react-three/drei";
import { EnvModel, HoverableGroup } from "./BaseComponents";
import { BLDG_S, M } from "./constants";

// ─── AreaLabel: 3D 공간의 텍스트 라벨 ──────────────
export function AreaLabel({ label, position = [0, 4, 0] }: { label: string; position?: [number, number, number] }) {
  return (
    <group position={position}>
      <Html center zIndexRange={[10, 0]}>
        <div className="px-3 py-1 bg-black/60 backdrop-blur-md border-2 border-white/20 rounded-full shadow-2xl pointer-events-none whitespace-nowrap overflow-hidden">
          <span className="text-white text-sm font-black tracking-widest uppercase" style={{ fontFamily: "inherit" }}>
            {label}
          </span>
        </div>
      </Html>
    </group>
  );
}

// ─── BuildingTile: 개별 건물 타일 ──────────────
export function BuildingTile({
  position,
  modelUrl,
  label,
  onClick,
  scale = BLDG_S,
}: {
  position: [number, number, number];
  modelUrl: string;
  label: string;
  onClick?: () => void;
  scale?: number;
}) {
  return (
    <HoverableGroup position={position} onClick={onClick}>
      <React.Suspense fallback={null}>
        <EnvModel url={modelUrl} scale={scale} />
      </React.Suspense>
      <AreaLabel label={label} />
    </HoverableGroup>
  );
}

// ─── Minigame: 미니게임 전용 타일 ──────────────
export function Minigame({
  position,
  onClick,
}: {
  position: [number, number, number];
  onClick?: () => void;
}) {
  return (
    <BuildingTile
      position={position}
      modelUrl={M.minigame}
      label="미니게임"
      onClick={onClick}
      scale={BLDG_S * 0.02}

    />
  );
}
