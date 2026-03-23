/// <reference types="@react-three/fiber" />
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../../store/gameStore";
import { useAlertStore } from "../../../store/useAlertStore";
import { WorkstationAPI } from "../../../api/gameApi";
import { EnvModel } from "./BaseComponents";
import { AreaLabel } from "./BuildingComponents";
import { HelpCircle, AlertTriangle } from "lucide-react";
import {
    GOLD_STACK_MODELS, MAX_TOTAL, MAX_GOLD_CAP, DEFAULT_WORKSTATION_CAP,
    BW, BELT_S, TW, TILE_S,
} from "./constants";

function getSingleStackLevel(count: number, cap: number): number {
    if (count <= 0 || cap <= 0) return 0;
    return Math.max(1, Math.ceil((count / cap) * MAX_TOTAL));
}

function ProductStack({ stackLevel, industry, count = 0 }: { stackLevel: number; industry: string; count?: number }) {
    if (stackLevel <= 0 && count <= 0) return null;

    if (industry === "GOLD_MINING" || industry === "금광업") {
        const rotations: [number, number, number][] = [[0, 0, 0], [0, Math.PI / 3, 0], [0, Math.PI / 1.5, 0], [0, Math.PI, 0]];
        return (
            <group>
                {Array.from({ length: Math.min(stackLevel, 4) }).map((_, i) => (
                    <group key={i} position={[0, i * 0.15, 0]} rotation={rotations[i % rotations.length]}>
                        <React.Suspense fallback={null}><EnvModel url="/models/props/Gold_Nuggets.gltf" scale={TILE_S * (0.8 - i * 0.05)} /></React.Suspense>
                    </group>
                ))}
            </group>
        );
    }

    if (industry === "MANUFACTURING" || industry === "제조업") {
        const displayCount = Math.min(count, 40);
        return (
            <group>
                {Array.from({ length: displayCount }).map((_, i) => {
                    const layer = Math.floor(i / 4);
                    const idxInLayer = i % 4;
                    const offsetX = (idxInLayer % 2 === 0 ? 0.35 : -0.35) * (1 - layer * 0.05);
                    const offsetZ = (Math.floor(idxInLayer / 2) === 0 ? 0.35 : -0.35) * (1 - layer * 0.05);
                    const rotationY = (Math.PI / 4) * idxInLayer + (layer * Math.PI / 6);
                    return (
                        <group key={i} position={[offsetX, layer * 0.15 + 0.1, offsetZ]} rotation={[0, rotationY, Math.PI / 2]}>
                            <React.Suspense fallback={null}><EnvModel url="/models/props/drill.glb" scale={TILE_S * 0.4} /></React.Suspense>
                        </group>
                    );
                })}
            </group>
        );
    }

    const idx = Math.max(0, Math.min(stackLevel - 1, GOLD_STACK_MODELS.length - 1));
    return (<React.Suspense fallback={null}><EnvModel url={GOLD_STACK_MODELS[idx]} scale={TILE_S * 0.5} /></React.Suspense>);
}

import { Machine1 } from "../models/Machine1";

const MACHINE_CONFIG = {
    scale: 0.6,
    position: [4, 0, -2] as [number, number, number],
    rotation: [0, 320, 0] as [number, number, number],
};

function ManufacturingMachine({ isWorking }: { isWorking: boolean }) {
    return (<group position={MACHINE_CONFIG.position}><group rotation={MACHINE_CONFIG.rotation}><Machine1 isWorking={isWorking} scale={MACHINE_CONFIG.scale} /></group></group>);
}

function FlyingProduct({ startPos, endPos, onArrive, industry }: {
    startPos: [number, number, number]; endPos: [number, number, number]; onArrive: () => void; industry: string;
}) {
    const ref = useRef<THREE.Group>(null);
    const prog = useRef(0);
    const arrived = useRef(false);
    let url = "/models/props/Gold_Bar.gltf"; let scale = 0.75;
    if (industry === "GOLD_MINING" || industry === "금광업") { url = "/models/props/Gold_Nugget_Medium.gltf"; scale = 2.0; }
    else if (industry === "MANUFACTURING" || industry === "제조업") { url = "/models/props/drill.glb"; scale = 0.3; }

    useFrame((_, delta) => {
        if (!ref.current || arrived.current) return;
        prog.current += delta * 1.5;
        const t = Math.min(prog.current, 1);
        const x = THREE.MathUtils.lerp(startPos[0], endPos[0], t);
        const z = THREE.MathUtils.lerp(startPos[2], endPos[2], t);
        const arcY = Math.sin(t * Math.PI) * (industry === "제조업" ? 3.5 : 2);
        const targetY = industry === "제조업" ? endPos[1] + 1.0 : endPos[1];
        const y = THREE.MathUtils.lerp(startPos[1], targetY, t) + arcY;
        ref.current.position.set(x, y, z);
        ref.current.rotation.y += delta * 5;
        if (t >= 1) { arrived.current = true; onArrive(); }
    });

    return (<group ref={ref} position={startPos}><React.Suspense fallback={null}><EnvModel url={url} scale={scale} /></React.Suspense></group>);
}

interface WorkstationProps {
    position: [number, number, number];
    inWorkstation: boolean;
    onOpenModal: () => void;
}

export function Workstation({ position, inWorkstation, onOpenModal }: WorkstationProps) {
    const half = BW / 2;

    const wsState = useGameStore(s => s.workstationState);
    const setWsState = useGameStore(s => s.setWorkstationState);
    const usedSlots = useGameStore(s => s.getWarehouseUsage().usedSlots);
    const warehouseMaxSlots = useGameStore(s => s.warehouseMaxSlots);
    const industry = useGameStore(s => s.industry);

    const [maxCapacity, setMaxCapacity] = useState(DEFAULT_WORKSTATION_CAP);
    const [flyingBars, setFlyingBars] = useState<number[]>([]);
    const [gaugeHovered, setGaugeHovered] = useState(false);
    const [remainingSec, setRemainingSec] = useState<number | null>(null);

    const flyIdRef = useRef(0);
    const prevProducedRef = useRef(0);
    const isWorking = wsState.isWorking;

    // ★ endTime: startTime+totalMs 우선, 없으면 백엔드 endTime
    const effectiveEndTime = (wsState.startTime && wsState.totalMs)
        ? wsState.startTime + wsState.totalMs
        : wsState.endTime ?? 0;

    // ★ HUD 카운터용 보간 (시각적 부드러움 — 생산 중 X/Y 표시에만 사용)
    const localProducedCount = useMemo(() => {
        if (!isWorking || wsState.requestedQty <= 0) return 0;
        const startTime = wsState.startTime;
        const totalMs = wsState.totalMs;
        if (!startTime || !totalMs || totalMs <= 0) return 0;
        const elapsed = Date.now() - startTime;
        const ratio = Math.min(1, Math.max(0, elapsed / totalMs));
        return Math.floor(ratio * wsState.requestedQty);
    }, [isWorking, wsState.startTime, wsState.totalMs, wsState.requestedQty, remainingSec]);

    // ★ 더미(pile) 수량
    //   생산 중: 보간값 - 수령 완료분 + 이전 세션 잔여분 (1개씩 쌓이는 시각적 효과)
    //   완료 후: uncollectedPile vs storedCount 중 큰 값 (async gap 보호)
    const localStoredCount = isWorking
        ? Math.max(0, localProducedCount - (wsState.collectedTotal ?? 0)) + (wsState.uncollectedPile ?? 0)
        : Math.max(wsState.uncollectedPile ?? 0, wsState.storedCount ?? 0);

    // ★ 날아가는 애니메이션: localStoredCount(보간 포함) 변화 시 트리거
    useEffect(() => {
        if (!isWorking) {
            prevProducedRef.current = localStoredCount;
            return;
        }
        const diff = localStoredCount - prevProducedRef.current;
        if (diff > 0) {
            const count = Math.min(diff, 3);
            const newBars: number[] = [];
            for (let i = 0; i < count; i++) {
                newBars.push(flyIdRef.current++);
            }
            setFlyingBars(prev => [...prev, ...newBars]);
            prevProducedRef.current = localStoredCount;
        }
    }, [localStoredCount, isWorking]);

    const isFull = localStoredCount >= maxCapacity;
    const isWarehouseFull = usedSlots >= warehouseMaxSlots;
    const cannotProduce = isFull;

    const beltEndPos: [number, number, number] =
        (industry === "MANUFACTURING" || industry === "제조업") ? [0.75 + 1.2 * BELT_S, TW * 0.12 + 1.5, 1 - (-0.5) * BELT_S]
            : (industry === "GOLD_MINING" || industry === "금광업") ? [0.75 - 3.5 * BELT_S, TW * 0.12 + 1.2, 1 - (-0.3) * BELT_S]
                : [0.75 - 0.5 * BELT_S, TW * 0.12 + 0.8, 1 - 1.0 * BELT_S];

    // 폴링
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isWorking) {
            interval = setInterval(() => { useGameStore.getState().fetchCompanyData(1); }, 5000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isWorking]);

    useEffect(() => { if (!isWorking) setRemainingSec(null); }, [isWorking]);

    // ★ 1초 카운트다운 + 시간 만료 시 자동 완료
    useEffect(() => {
        if (!isWorking || effectiveEndTime <= 0) return;

        const calc = () => Math.max(0, Math.ceil((effectiveEndTime - Date.now()) / 1000));
        setRemainingSec(calc());

        const tick = setInterval(() => {
            const remaining = calc();
            setRemainingSec(remaining);

            // ★ 시간 0이면 자동 완료
            if (remaining <= 0) {
                clearInterval(tick);
                // startTime을 유지하여 fetchCompanyData의 locallyCompleted 가드가 작동하도록 함
                // (startTime > 0 && isWorking === false → 백엔드 폴링이 덮어쓰지 않음)
                const ws = useGameStore.getState().workstationState;
                useGameStore.getState().setWorkstationState({
                    isWorking: false,
                    totalMs: 0,
                    endTime: null,
                    uncollectedPile: Math.max(ws.uncollectedPile ?? 0, ws.storedCount ?? 0),
                });
                // 백엔드에도 가동 중지 요청 후 상태 동기화 (비동기, 논블로킹)
                WorkstationAPI.stop()
                    .then(() => useGameStore.getState().fetchCompanyData(1))
                    .catch(() => {});
            }
        }, 1000);

        return () => clearInterval(tick);
    }, [isWorking, effectiveEndTime]);

    const singleStackLevel = getSingleStackLevel(localStoredCount, maxCapacity);
    const stackPos: [number, number, number] = [half * 0.4, 0.3, -half * 0.4];

    const handleBarArrive = useCallback((barId: number) => {
        setFlyingBars(prev => prev.filter(id => id !== barId));
    }, []);

    const fmtTime = (sec: number | null): string => {
        if (sec === null || sec < 0) return '--:--';
        const m = Math.floor(sec / 60); const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const toolHudPos: [number, number, number] =
        (industry === "MANUFACTURING" || industry === "제조업")
            ? [MACHINE_CONFIG.position[0] * BELT_S, 4.5, MACHINE_CONFIG.position[2] * BELT_S]
            : [0.75 * BELT_S, 3.5, 1 * BELT_S];

    useEffect(() => {
        const canvasWrapper = document.querySelector('canvas')?.parentElement as HTMLElement | null;
        const target = canvasWrapper ?? document.body;
        target.style.cursor = (gaugeHovered && localStoredCount > 0) ? 'pointer' : '';
        return () => { target.style.cursor = ''; };
    }, [gaugeHovered, localStoredCount]);

    return (
        <group position={position}>
            <mesh position={[0, -0.04, 0]} receiveShadow>
                <boxGeometry args={[BW, 0.08, BW]} />
                <meshStandardMaterial color="#8b7355" />
            </mesh>

            <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}>
                <React.Suspense fallback={<mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>}>
                    {(industry === "GOLD_MINING" || industry === "금광업") ? (
                        <EnvModel url="/models/props/rock.glb" scale={1.8} position={[3.5, 0, -0.3]} rotation={[0, 180, 0]} />
                    ) : (industry === "MANUFACTURING" || industry === "제조업") ? (
                        <ManufacturingMachine isWorking={isWorking && !cannotProduce} />
                    ) : (
                        /* @ts-ignore */
                        <ConveyorBelt isAnimating={isWorking && !cannotProduce} />
                    )}
                </React.Suspense>
            </group>

            {/* ★ HUD 타이머: 작업 중일 때만 (완료 시 isWorking=false → 자동 사라짐) */}
            {isWorking && (
                <group position={toolHudPos}>
                    <Html center zIndexRange={[20, 0]}>
                        <div className="flex flex-col items-center gap-1 pointer-events-none select-none" style={{ whiteSpace: 'nowrap', minWidth: '120px' }}>
                            <div className="flex items-center gap-1.5 bg-gray-950/90 border-2 border-orange-400/80 text-orange-300 rounded-xl px-4 py-2 shadow-xl backdrop-blur-sm whitespace-nowrap">
                                <span className="animate-pulse text-base">⏳</span>
                                <span className="text-2xl font-black tracking-widest tabular-nums font-mono whitespace-nowrap">
                                    {fmtTime(remainingSec)}
                                </span>
                            </div>
                            {wsState.requestedQty > 0 && (
                                <div className="bg-gray-950/85 border border-emerald-600/50 text-emerald-300 text-xs font-black rounded-lg px-3 py-1 tracking-wider tabular-nums whitespace-nowrap">
                                    {localProducedCount} / {wsState.requestedQty}
                                </div>
                            )}
                            {cannotProduce && (
                                <div className="mt-1 px-3 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full animate-bounce shadow-lg border border-rose-300 whitespace-nowrap">
                                    ⚠️ 가득 참!
                                </div>
                            )}
                        </div>
                    </Html>
                </group>
            )}

            {/* 상태 아이콘 */}
            <group position={[toolHudPos[0], toolHudPos[1] + 1.2, toolHudPos[2]]}>
                <Html center zIndexRange={[30, 0]}>
                    <div className="flex flex-col items-center justify-center select-none">
                        <style>{`
                            .icon-stroke { -webkit-text-stroke: 3px #000; paint-order: stroke fill; line-height: 1; animation: bounce-icon 0.8s ease-in-out infinite alternate; }
                            .icon-stroke-clickable { -webkit-text-stroke: 3px #000; paint-order: stroke fill; line-height: 1; animation: bounce-icon 0.8s ease-in-out infinite alternate; cursor: pointer; transition: transform 0.1s; }
                            .icon-stroke-clickable:hover { transform: scale(1.2); }
                            @keyframes bounce-icon { from { transform: translateY(0px); } to { transform: translateY(-8px); } }
                        `}</style>
                        {isFull && (
                            <span className="icon-stroke-clickable" style={{ fontSize: '64px', color: '#facc15' }}
                                onClick={(e) => { e.stopPropagation(); useAlertStore.getState().openAlert(`임시 보관함이 가득 찼습니다.(${localStoredCount}/${maxCapacity}개)\n더미를 클릭하여 창고에 이동하세요.`, '⚠️ 적재 꽉 참'); }}
                            >!</span>
                        )}
                        {!isWorking && !isFull && !wsState.isStarting && localStoredCount <= 0 && (
                            <span className="icon-stroke" style={{ fontSize: '64px', color: '#ef4444' }}>?</span>
                        )}
                        {wsState.isStarting && (
                            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-700 backdrop-blur-md shadow-2xl mt-4">
                                <div className="w-[50px] h-[50px] border-4 border-indigo-500 border-t-indigo-100 rounded-full animate-spin" />
                                <span className="whitespace-nowrap text-xs font-black text-indigo-100 mt-2 tracking-widest animate-pulse">준비 중...</span>
                            </div>
                        )}
                    </div>
                </Html>
            </group>

            {/* ★ 생산품 더미 (언제든 클릭 → 수령 가능, 생산 중에도 OK) */}
            <group
                onPointerEnter={(e) => { e.stopPropagation(); setGaugeHovered(true); }}
                onPointerLeave={(e) => { e.stopPropagation(); setGaugeHovered(false); }}
                onClick={async (e) => {
                    e.stopPropagation();
                    if (localStoredCount > 0) {
                        // ★ 백엔드 실제 생산량 확인 (보간값이 아닌 확정값)
                        const backendCount = useGameStore.getState().workstationState.storedCount ?? 0;
                        if (backendCount <= 0) {
                            useAlertStore.getState().openAlert("아직 완성된 제품이 없습니다. 잠시 후 다시 시도하세요.", "수령 불가");
                            return;
                        }
                        try {
                            await WorkstationAPI.collect();
                            const currentWs = useGameStore.getState().workstationState;
                            if (currentWs.isWorking) {
                                // 생산 중 부분 수령: 타이머/진행 상태 유지, 수령량만 추적
                                useGameStore.getState().setWorkstationState({
                                    collectedTotal: (currentWs.collectedTotal ?? 0) + backendCount,
                                    uncollectedPile: 0,
                                    storedCount: 0,
                                });
                            } else {
                                // 생산 완료 후 수령: 전체 상태 초기화
                                useGameStore.getState().setWorkstationState({
                                    startTime: 0, totalMs: 0, endTime: null,
                                    producedCount: 0, storedCount: 0, requestedQty: 0,
                                    collectedTotal: 0,
                                    uncollectedPile: 0,
                                });
                            }
                            await useGameStore.getState().fetchCompanyData(1);
                            useAlertStore.getState().openAlert(`${backendCount}개를 창고에 저장했습니다.`, "✅ 수령 완료");
                        } catch (err: any) {
                            const msg = err?.response?.data?.message || "수령할 수 없습니다.";
                            useAlertStore.getState().openAlert(msg, "수령 실패");
                        }
                    }
                }}
            >
                <mesh position={[half * 0.4, 0.5, -half * 0.4]}>
                    <boxGeometry args={[half * 0.8, 1.5, half * 0.8]} />
                    <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
                </mesh>
                <group position={stackPos}>
                    <ProductStack stackLevel={singleStackLevel} industry={industry} count={localStoredCount} />
                </group>
            </group>

            {/* ★ 적재량 HUD: 가득참=빨강, 생산중=노랑, 수령가능=초록 */}
            {localStoredCount > 0 && (
                <group position={[half * 0.4, -0.3, -half * 0.4]}>
                    <Html center zIndexRange={[10, 0]}>
                        <div className="pointer-events-none select-none" style={{ whiteSpace: 'nowrap' }}>
                            <div className={`inline-flex items-center gap-1 border-2 text-xs font-black rounded-full px-2.5 py-0.5 shadow-lg tabular-nums font-mono whitespace-nowrap
                                ${isFull
                                    ? 'bg-rose-950/90 border-rose-400 text-rose-200'
                                    : isWorking
                                        ? 'bg-gray-950/90 border-yellow-400 text-yellow-300'
                                        : 'bg-gray-950/90 border-emerald-400 text-emerald-300 animate-pulse'
                                }`}>
                                {localStoredCount}/{maxCapacity}
                            </div>
                        </div>
                    </Html>
                </group>
            )}

            {flyingBars.map(barId => (
                <FlyingProduct key={barId} startPos={beltEndPos} endPos={stackPos} onArrive={() => handleBarArrive(barId)} industry={industry} />
            ))}

            <AreaLabel label="작업장" />
        </group>
    );
}