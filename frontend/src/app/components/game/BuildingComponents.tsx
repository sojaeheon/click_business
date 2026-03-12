/// <reference types="@react-three/fiber" />
import React from "react";
import { Text } from "@react-three/drei";
import { EnvModel, HoverableGroup } from "./BaseComponents";
import { FONT_URL, BW, BLDG_S, M } from "./constants";

// ─── AreaLabel: 건물 이름 3D 텍스트 라벨 ────────────────────────
export function AreaLabel({ label }: { label: string }) {
    return (
        <Text
            position={[0, 0.6, BW / 2 + 0.4]}
            fontSize={0.6}
            font={FONT_URL}
            color="#222"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.07}
            outlineColor="#fff"
        >
            {label}
        </Text>
    );
}

// ─── BuildingTile: 건물 베이스 타일 ────────────────────────────
export function BuildingTile({
    position, modelUrl, label, onClick, buildingScale = BLDG_S,
}: {
    position: [number, number, number];
    modelUrl: string;
    label: string;
    onClick?: () => void;
    buildingScale?: number;
}) {
    return (
        <HoverableGroup position={position} onClick={onClick}>
            <React.Suspense fallback={
                <mesh position={[0, 1, 0]}><boxGeometry args={[BW, BW, BW]} /><meshStandardMaterial color="#aaa" wireframe /></mesh>
            }>
                <EnvModel url={modelUrl} scale={buildingScale} />
            </React.Suspense>
            <AreaLabel label={label} />
        </HoverableGroup>
    );
}

// ─── Minigame: 미니게임 타일 ────────────────────────────────────
export function Minigame({ position, onClick }: { position: [number, number, number]; onClick?: () => void }) {
    return (
        <HoverableGroup position={position} onClick={onClick}>
            <mesh position={[0, -0.04, 0]} receiveShadow>
                <boxGeometry args={[BW, 0.08, BW]} />
                <meshStandardMaterial color="#6a8f5a" />
            </mesh>
            <React.Suspense fallback={null}>
                <group position={[0.5, 0.5, 0]} rotation={[0, Math.PI * 0.9999, 0]} scale={0.05}>
                    <EnvModel url={M.minigame} />
                </group>
            </React.Suspense>
            <AreaLabel label="미니게임" />
        </HoverableGroup>
    );
}
