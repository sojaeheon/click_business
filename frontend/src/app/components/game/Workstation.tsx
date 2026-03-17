/// <reference types="@react-three/fiber" />
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt";
import React, { useRef, useState, useEffect, useCallback } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../store/gameStore";
import { WorkstationAPI } from "../../../api/gameApi";
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

// ─── 더미 단계별 모델 (산업별 분기) ────────────────────────────
function ProductStack({ stackLevel, industry }: { stackLevel: number, industry: string }) {
    if (stackLevel <= 0) return null;

    let url = "";
    if (industry === "금광업") {
        url = "/models/props/Gold_Nuggets.gltf";
    } else if (industry === "제조업") {
        return (
            <group>
                {Array.from({ length: stackLevel }).map((_, i) => (
                    // drill을 위로 쌓아두기 위한 임의의 Y offset 및 회전
                    <group key={i} position={[0, i * 0.4, 0]} rotation={[0, Math.random() * Math.PI, 0]}>
                        <React.Suspense fallback={null}>
                            <EnvModel url="/models/props/drill.glb" scale={TILE_S * 0.4} />
                        </React.Suspense>
                    </group>
                ))}
            </group>
        );
    } else {
        const idx = Math.min(stackLevel - 1, GOLD_STACK_MODELS.length - 1);
        url = GOLD_STACK_MODELS[idx];
    }

    return (
        <React.Suspense fallback={null}>
            <EnvModel url={url} scale={TILE_S * 0.5} />
        </React.Suspense>
    );
}

function ManufacturingMachine({ isWorking }: { isWorking: boolean }) {
    const drillRef = useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (isWorking && drillRef.current) {
            drillRef.current.rotation.y -= delta * 3;
        }
    });
    return (
        <group position={[0, 0, 0]}>
            <EnvModel url="/models/props/drill_structure.gltf" scale={0.7} position={[-0.8, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
            <group ref={drillRef} position={[1.5, 0, 0]}>
                <EnvModel url="/models/props/machine1.glb" scale={1.2} />
            </group>
        </group>
    );
}

// ─── FlyingProduct: 벨트에서 더미로 날아가는 생산품 ───────────────
function FlyingProduct({ startPos, endPos, onArrive, industry }: {
    startPos: [number, number, number];
    endPos: [number, number, number];
    onArrive: () => void;
    industry: string;
}) {
    const ref = useRef<THREE.Group>(null);
    const progress = useRef(0);
    const arrived = useRef(false);

    let url = "/models/props/Gold_Bar.gltf";
    let scale = 0.75;
    if (industry === "금광업") {
        url = "/models/props/Gold_Nugget_Medium.gltf";
    } else if (industry === "제조업") {
        url = "/models/props/drill.glb";
        scale = 1.0;
    }

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
                <EnvModel url={url} scale={scale} />
            </React.Suspense>
        </group>
    );
}

// ─── Workstation: 작업장 메인 컴포넌트 ─────────────────────────────
interface WorkstationProps {
    position: [number, number, number];
    isWorking: boolean;
    inWorkstation: boolean;
    onOpenModal: () => void;
    onStoreGold?: (count: number) => void;
    onWorkChange?: (working: boolean) => void;
}

export function Workstation({ position, isWorking, inWorkstation, onOpenModal, onStoreGold, onWorkChange }: WorkstationProps) {
    const half = BW / 2;
    const [progress, setProgress] = useState(0);
    const [storedCount, setStoredCount] = useState(0);
    const [flyingBars, setFlyingBars] = useState<number[]>([]);
    const [gaugeHovered, setGaugeHovered] = useState(false);
    const updateProduct = useGameStore(state => state.updateProduct);
    const usedSlots = useGameStore(state => state.getWarehouseUsage().usedSlots);
    const warehouseMaxSlots = useGameStore(state => state.warehouseMaxSlots);

    const flyIdRef = useRef(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [totalQuantity, setTotalQuantity] = useState(0);

    const isCompleted = progress >= 100;
    const isFull = storedCount >= MAX_GOLD_CAP;
    const isWarehouseFull = usedSlots >= warehouseMaxSlots;

    const cannotProduce = isFull || isWarehouseFull; // 둘 중 하나라도 꽉차면 생산 중단

    // 알림: 생산 중단 시
    useEffect(() => {
        if (isWorking && cannotProduce) {
            useGameStore.getState().addAlert({
                message: "작업 라인 중단",
                detail: isFull ? "작업장 임시 보관함이 가득 찼습니다." : "창고 공간이 부족합니다."
            });
        }
    }, [isWorking, cannotProduce, isFull]);

    const beltEndPos: [number, number, number] = [-0.75 + 2.5, 0.5, 1];
    const stackPositions: [number, number, number][] = [
        [half * 0.6, 0.3, -half * 0.7],
        [half * 0.15, 0.3, -half * 0.7],
        [half * 0.6, 0.3, -half * 0.2],
    ];

    useEffect(() => {
        let isCancelled = false;
        if (isWorking && !cannotProduce) {
            // 초기 1회 실행
            WorkstationAPI.getStatus(1).then(res => {
                if (!isCancelled && res.data) {
                    const pct: number = res.data.progress ?? 0;
                    const qty: number = (res.data as any).producedQuantity ?? 0;
                    const total: number = (res.data as any).totalQuantity ?? qty;
                    const backendWorking = res.data.isWorking;
                    setProgress(pct);
                    setStoredCount(qty);
                    setTotalQuantity(total);

                    if (!backendWorking) onWorkChange?.(false);
                }
            }).catch(() => { });

            intervalRef.current = setInterval(async () => {
                try {
                    const res = await WorkstationAPI.getStatus(1);
                    if (!isCancelled && res.data) {
                        const pct: number = res.data.progress ?? 0;
                        const qty: number = (res.data as any).producedQuantity ?? 0;
                        const total: number = (res.data as any).totalQuantity ?? qty;
                        const backendWorking = res.data.isWorking;

                        setProgress(pct);
                        setTotalQuantity(total);

                        // 100% 달성 시 또는 백엔드에서 작업 중단 시
                        if (!backendWorking || (pct >= 100 && intervalRef.current)) {
                            if (intervalRef.current) {
                                clearInterval(intervalRef.current);
                                intervalRef.current = null;
                            }
                            if (pct >= 100) {
                                useGameStore.getState().addAlert({ message: "작업 완료! 🎉", detail: "금괴를 클릭해서 창고로 가져가세요." });
                            }
                            onWorkChange?.(false);
                        }

                        // 개수 증가 시 flying bar 발사
                        setStoredCount(prev => {
                            const diff = qty - prev;
                            if (diff > 0) {
                                const count = Math.min(diff, 3);
                                for (let i = 0; i < count; i++) {
                                    setTimeout(() => {
                                        flyIdRef.current += 1;
                                        setFlyingBars(fb => [...fb, flyIdRef.current]);
                                    }, i * 250);
                                }
                            }
                            return qty;
                        });
                    }
                } catch (e) {
                    console.error("작업장 상태 조회 오류:", e);
                }
            }, 3000);
        } else {


            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { isCancelled = true; if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isWorking, cannotProduce]);

    // 금괴 더미: 총 적재 용량(500) 기준으로 시각화 (최소 1개 적재시 1단계 모델 바로 노출)
    let totalGold = 0;
    if (storedCount > 0) {
        // 최대 12단계(MAX_TOTAL), 적어도 1단계 노출, 비율에 따라 단계 점진적 상승
        totalGold = Math.max(1, Math.floor((storedCount / MAX_GOLD_CAP) * MAX_TOTAL));
    }

    const handleBarArrive = useCallback((barId: number) => {
        setFlyingBars(prev => prev.filter(id => id !== barId));
    }, []);
    const levels = getStackLevels(totalGold);
    const nextPileIdx = levels.findIndex(l => l < GOLD_STACK_MODELS.length);
    const targetPile = nextPileIdx >= 0 ? nextPileIdx : MAX_PILES - 1;

    const showProgressGauge = isWorking && !isCompleted && !isFull;
    const showFullGauge = showProgressGauge && (inWorkstation || gaugeHovered);

    const industry = useGameStore(state => state.industry);

    return (
        <group position={position}>
            <mesh position={[0, -0.04, 0]} receiveShadow>
                <boxGeometry args={[BW, 0.08, BW]} />
                <meshStandardMaterial color="#8b7355" />
            </mesh>

            <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}>
                <React.Suspense fallback={<mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>}>
                    {industry === "금광업" ? (
                        <EnvModel url="/models/props/rocks_B.gltf" scale={2.0} />
                    ) : industry === "제조업" ? (
                        <ManufacturingMachine isWorking={isWorking && !isCompleted && !cannotProduce} />
                    ) : (
                        /* @ts-ignore */
                        <ConveyorBelt isAnimating={isWorking && !isCompleted && !cannotProduce} />
                    )}
                </React.Suspense>
            </group>

            <group
                onPointerEnter={(e) => { e.stopPropagation(); if (storedCount > 0) document.body.style.cursor = 'pointer'; setGaugeHovered(true); }}
                onPointerLeave={(e) => { e.stopPropagation(); document.body.style.cursor = 'auto'; setGaugeHovered(false); }}
                onClick={async (e) => {
                    e.stopPropagation();
                    if (storedCount > 0 && !isWarehouseFull) {
                        try {
                            const added = updateProduct(storedCount);
                            if (added > 0) {
                                await WorkstationAPI.collect(1);
                                setStoredCount(0);
                                onStoreGold?.(added);
                                // 중간 수령 시 진행도 리셋 방지: setProgress(0) 제거
                            }
                        } catch (err) {
                            console.error("수령 실패:", err);
                        }
                    } else if (isWarehouseFull) {
                        useGameStore.getState().addAlert({ message: "수령 불가", detail: "창고가 가득 찼습니다." });
                    }
                }}
            >
                {/* 클릭 판정을 위한 투명 히트박스 */}
                <mesh position={[half * 0.45, 0.5, -half * 0.45]}>
                    <boxGeometry args={[half * 1.5, 1, half * 1.5]} />
                    <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
                </mesh>

                {stackPositions.map((pos, i) => (
                    <group key={i} position={pos}><ProductStack stackLevel={levels[i]} industry={industry} /></group>
                ))}
            </group>

            {/* 작업장 진행 게이지 (progressbar) */}
            {isWorking && !cannotProduce && (
                <group position={[0, 2.7, 0]}>
                    <Html center zIndexRange={[20, 0]}>
                        <div className="flex flex-col items-center gap-1 pointer-events-none transition-opacity duration-300 w-32" style={{ opacity: showFullGauge ? 1 : 0.8 }}>
                            <div className="bg-gray-900/80 rounded border border-gray-700 w-full overflow-hidden shadow-lg h-3 relative">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                                <div className="absolute inset-0 bg-white/20 opacity-50 animate-[pulse_1s_ease-in-out_infinite]" />
                            </div>
                            <div className="text-[10px] font-bold text-emerald-300 tracking-wider bg-gray-900/80 px-2 py-0.5 rounded-full border border-gray-800">
                                생산 중 ({storedCount}/{totalQuantity}개) {Math.floor(progress)}%
                            </div>
                        </div>
                    </Html>
                </group>
            )}

            {/* 금괴 더미 위 카운터 */}
            {storedCount > 0 && (
                <group position={[0, 1.8, -half * 0.7]}>
                    <Html center zIndexRange={[10, 0]}>
                        <div
                            className="flex flex-col items-center gap-1 transition-transform pointer-events-none"
                        >
                            {cannotProduce && <span className="text-3xl animate-bounce drop-shadow-md cursor-help mb-1">⚠️</span>}
                            <div className={`border-2 text-xs font-black rounded-lg px-2.5 py-1 tracking-widest shadow-[0_0_10px_rgba(52,211,153,0.3)] select-none transition-colors 
                                ${isWarehouseFull
                                    ? 'bg-rose-900/80 border-rose-400/50 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                                    : 'bg-gray-900/80 border-emerald-400/50 text-emerald-300 group-hover:bg-gray-800'
                                }`}
                            >
                                {String(storedCount).padStart(3, '0')}<span className="text-gray-400 font-bold">/{MAX_GOLD_CAP}</span>
                            </div>
                        </div>
                    </Html>
                </group>
            )}

            {flyingBars.map(barId => (
                <FlyingProduct key={barId} startPos={beltEndPos} endPos={stackPositions[targetPile]} onArrive={() => handleBarArrive(barId)} industry={industry} />
            ))}

            <AreaLabel label="작업장" />

            {/* 임시 산업 변경 토글 */}
            <group position={[0, -0.5, 2]}>
                <Html center>
                    <div className="flex bg-white/80 backdrop-blur-md rounded-full shadow-lg p-1 gap-1 border border-slate-200" onClick={e => e.stopPropagation()}>
                        {["금광업", "금 제련업", "제조업"].map((ind) => (
                            <button
                                key={ind}
                                onClick={() => useGameStore.getState().setCompanyInfo(useGameStore.getState().companyName, ind)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${industry === ind
                                    ? "bg-indigo-500 text-white shadow"
                                    : "text-slate-500 hover:bg-slate-100"
                                    }`}
                            >
                                {ind}
                            </button>
                        ))}
                    </div>
                </Html>
            </group>
        </group>
    );
}
