/// <reference types="@react-three/fiber" />
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EnvModel, HoverableGroup } from "./BaseComponents";
import { AreaLabel } from "./BuildingComponents";
import {
    GOLD_STACK_MODELS, MAX_PILES, MAX_TOTAL, MAX_GOLD_CAP,
    BW, BELT_S, TW, TILE_S,
} from "./constants";

// ─── 각 더미의 레벨 계산 ────────────────────────────────────────
function getStackLevels(totalCount: number): number[] {
    const levels: number[] = [];
    let remaining = Math.min(totalCount, MAX_TOTAL);
    for (let i = 0; i < MAX_PILES; i++) {
        const lvl = Math.min(remaining, GOLD_STACK_MODELS.length);
        levels.push(lvl);
        remaining -= lvl;
    }
    return levels;
}

// ─── GoldBarStack: 더미 단계별 모델 ────────────────────────────
function GoldBarStack({ stackLevel }: { stackLevel: number }) {
    if (stackLevel <= 0) return null;
    const idx = Math.min(stackLevel - 1, GOLD_STACK_MODELS.length - 1);
    return (
        <React.Suspense fallback={null}>
            <EnvModel url={GOLD_STACK_MODELS[idx]} scale={TILE_S * 0.5} />
        </React.Suspense>
    );
}

// ─── FlyingGoldBar: 벨트에서 더미로 날아가는 금괴 ───────────────
function FlyingGoldBar({ startPos, endPos, onArrive }: {
    startPos: [number, number, number];
    endPos: [number, number, number];
    onArrive: () => void;
}) {
    const ref = useRef<THREE.Group>(null);
    const progress = useRef(0);
    const arrived = useRef(false);

    useFrame((_, delta) => {
        if (!ref.current || arrived.current) return;
        progress.current += delta * 1.5;
        const t = Math.min(progress.current, 1);
        const x = THREE.MathUtils.lerp(startPos[0], endPos[0], t);
        const z = THREE.MathUtils.lerp(startPos[2], endPos[2], t);
        const arcY = Math.sin(t * Math.PI) * 2;
        const y = THREE.MathUtils.lerp(startPos[1], endPos[1], t) + arcY;
        ref.current.position.set(x, y, z);
        ref.current.rotation.y += delta * 5;
        if (t >= 1) { arrived.current = true; onArrive(); }
    });

    return (
        <group ref={ref} position={startPos}>
            <React.Suspense fallback={null}>
                <EnvModel url="/models/props/Gold_Bar.gltf" scale={0.75} />
            </React.Suspense>
        </group>
    );
}

// ─── Factory: 작업장 메인 컴포넌트 ─────────────────────────────
interface FactoryProps {
    position: [number, number, number];
    isWorking: boolean;
    inFactory: boolean;
    onOpenModal: () => void;
    onStoreGold?: (count: number) => void;
}

export function Factory({ position, isWorking, inFactory, onOpenModal, onStoreGold }: FactoryProps) {
    const half = BW / 2;
    const [progress, setProgress] = useState(0);
    const [storedCount, setStoredCount] = useState(0);
    const [flyingBars, setFlyingBars] = useState<number[]>([]);
    const [gaugeHovered, setGaugeHovered] = useState(false);
    const flyIdRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isCompleted = progress >= 100;
    const isFull = storedCount >= MAX_GOLD_CAP;

    const beltEndPos: [number, number, number] = [-0.75 + 2.5, 0.5, 1];
    const stackPositions: [number, number, number][] = [
        [half * 0.6, 0.3, -half * 0.7],
        [half * 0.15, 0.3, -half * 0.7],
        [half * 0.6, 0.3, -half * 0.2],
    ];

    useEffect(() => {
        if (isWorking && !isCompleted && !isFull) {
            intervalRef.current = setInterval(() => {
                flyIdRef.current += 1;
                setFlyingBars(prev => [...prev, flyIdRef.current]);
                setStoredCount(prev => Math.min(prev + 1, MAX_GOLD_CAP));
                setProgress(p => {
                    if (p >= 98) { if (intervalRef.current) clearInterval(intervalRef.current); return 100; }
                    return p + 2;
                });
            }, 1500);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isWorking, isCompleted, isFull]);

    // 금괴 더미: 총 적재 용량(500) 기준으로 시각화
    const totalGold = Math.floor((storedCount / MAX_GOLD_CAP) * MAX_TOTAL);
    const handleBarArrive = useCallback((barId: number) => {
        setFlyingBars(prev => prev.filter(id => id !== barId));
    }, []);
    const levels = getStackLevels(totalGold);
    const nextPileIdx = levels.findIndex(l => l < GOLD_STACK_MODELS.length);
    const targetPile = nextPileIdx >= 0 ? nextPileIdx : MAX_PILES - 1;

    const handleStore = useCallback(() => {
        if (storedCount > 0) { onStoreGold?.(storedCount); setStoredCount(0); setProgress(0); }
    }, [storedCount, onStoreGold]);

    const showProgressGauge = isWorking && !isCompleted && !isFull;
    const showFullGauge = showProgressGauge && (inFactory || gaugeHovered);

    return (
        <HoverableGroup position={position} onClick={onOpenModal}>
            <mesh position={[0, -0.04, 0]} receiveShadow>
                <boxGeometry args={[BW, 0.08, BW]} />
                <meshStandardMaterial color="#8b7355" />
            </mesh>

            <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}>
                <React.Suspense fallback={<mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>}>
                    {/* @ts-ignore */}
                    <ConveyorBelt isAnimating={isWorking && !isCompleted && !isFull} />
                </React.Suspense>
            </group>

            {stackPositions.map((pos, i) => (
                <group key={i} position={pos}><GoldBarStack stackLevel={levels[i]} /></group>
            ))}

            {/* 금괴 더미 위 카운터 */}
            <group position={[0, 1.8, -half * 0.7]}>
                <Html center zIndexRange={[10, 0]}>
                    <div className="flex flex-col items-center gap-1">
                        {isFull && <span className="text-2xl animate-bounce">⚠️</span>}
                        <div className="bg-black/70 text-white text-xs font-mono rounded px-2 py-0.5 tracking-widest">
                            {String(storedCount).padStart(3, '0')}/{MAX_GOLD_CAP}
                        </div>
                        {storedCount > 0 && (
                            <button
                                className="mt-1 px-2 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded shadow"
                                onClick={(e) => { e.stopPropagation(); handleStore(); }}
                            >📦 창고에 저장</button>
                        )}
                    </div>
                </Html>
            </group>

            {flyingBars.map(barId => (
                <FlyingGoldBar key={barId} startPos={beltEndPos} endPos={stackPositions[targetPile]} onArrive={() => handleBarArrive(barId)} />
            ))}

            <AreaLabel label="작업장" />

            {/* 진행도 UI */}
            <group position={[0, 4, 0]}>
                <Html center zIndexRange={[10, 0]}>
                    {(isCompleted || isFull) ? (
                        <span className="text-6xl text-red-500 font-bold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>❗️</span>
                    ) : !isWorking ? (
                        <span className="text-6xl text-yellow-500 font-bold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>❓</span>
                    ) : showFullGauge ? (
                        <div
                            className="relative flex items-center justify-center w-28 h-28 rounded-full flex-col bg-white shadow-xl border-4 border-slate-50 cursor-pointer"
                            onMouseLeave={() => setGaugeHovered(false)}
                        >
                            <svg className="absolute w-full h-full transform -rotate-90">
                                <circle cx="52" cy="52" r="44" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                                <circle cx="52" cy="52" r="44" fill="transparent" stroke="#3b82f6" strokeWidth="12"
                                    strokeDasharray={`${(progress / 100) * 276.4} 276.4`} strokeLinecap="round"
                                    className="transition-all duration-700 ease-out" />
                            </svg>
                            <span className="text-[10px] font-bold text-slate-400 z-10 -mb-1 mt-1">PROGRESS</span>
                            <span className="text-2xl font-black text-slate-800 z-10 tracking-tighter">{progress}%</span>
                        </div>
                    ) : (
                        <div className="cursor-pointer" onMouseEnter={() => setGaugeHovered(true)}>
                            <div className="w-20 h-3 bg-slate-200/60 rounded-full overflow-hidden shadow">
                                <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="text-center text-[9px] text-white/90 font-bold mt-0.5 drop-shadow">{progress}%</div>
                        </div>
                    )}
                </Html>
            </group>
        </HoverableGroup>
    );
}
