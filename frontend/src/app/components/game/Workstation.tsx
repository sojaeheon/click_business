/// <reference types="@react-three/fiber" />
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt";
import React, { useRef, useState, useEffect, useCallback } from "react";
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

// ─── 단일 더미의 레벨 계산 (storedCount 비율로) ────────────────
// 적재량 0이면 0, 가득이면 MAX_TOTAL(4)─레벨
function getSingleStackLevel(count: number, cap: number): number {
    if (count <= 0 || cap <= 0) return 0;
    return Math.max(1, Math.ceil((count / cap) * MAX_TOTAL));
}

// ─── 더미 단계별 모델 (산업별 분기) ─────────────────────────────
function ProductStack({ stackLevel, industry, count = 0 }: { stackLevel: number; industry: string; count?: number }) {
    if (stackLevel <= 0) return null;

    if (industry === "금광업") {
        const rotations: [number, number, number][] = [
            [0, 0, 0],
            [0, Math.PI / 3, 0],
            [0, Math.PI / 1.5, 0],
            [0, Math.PI, 0],
        ];
        return (
            <group>
                {Array.from({ length: Math.min(stackLevel, 4) }).map((_, i) => (
                    <group key={i} position={[0, (i * 0.15), 0]} rotation={rotations[i % rotations.length]}>
                        <React.Suspense fallback={null}>
                            <EnvModel url="/models/props/Gold_Nuggets.gltf" scale={TILE_S * (0.8 - i * 0.05)} />
                        </React.Suspense>
                    </group>
                ))}
            </group>
        );
    }

    if (industry === "제조업") {
        // 드릴을 실제 더미처럼 여러 개 쌓기 (count 기반, 최대 12개 3층)
        const drillCount = Math.min(count > 0 ? count : (stackLevel * 3), 12);
        return (
            <group>
                {Array.from({ length: drillCount }).map((_, i) => {
                    const layer = Math.floor(i / 4);
                    const idxInLayer = i % 4;
                    const offsetX = (idxInLayer % 2 === 0 ? 0.35 : -0.35) * (1 - layer * 0.1);
                    const offsetZ = (Math.floor(idxInLayer / 2) === 0 ? 0.35 : -0.35) * (1 - layer * 0.1);
                    const rotationY = (Math.PI / 4) * idxInLayer + (layer * Math.PI / 6);
                    return (
                        <group key={i} position={[offsetX, layer * 0.2 + 0.1, offsetZ]} rotation={[0, rotationY, Math.PI / 2]}>
                            <React.Suspense fallback={null}>
                                <EnvModel url="/models/props/drill.glb" scale={TILE_S * 0.4} />
                            </React.Suspense>
                        </group>
                    );
                })}
            </group>
        );
    }

    // 금 제련업 (기본): gold bar pile
    const idx = Math.min(stackLevel - 1, GOLD_STACK_MODELS.length - 1);
    return (
        <React.Suspense fallback={null}>
            <EnvModel url={GOLD_STACK_MODELS[idx]} scale={TILE_S * 0.5} />
        </React.Suspense>
    );
}

import { Machine1 } from "../models/Machine1";

// ─── 제조업 기계 위치/크기 ───────────────────────────────────────
const MACHINE_CONFIG = {
    scale: 0.6,
    position: [4, 0, -2] as [number, number, number],
    rotation: [0, 320, 0] as [number, number, number],
};

function ManufacturingMachine({ isWorking }: { isWorking: boolean }) {
    return (
        <group position={MACHINE_CONFIG.position}>
            <group rotation={MACHINE_CONFIG.rotation}>
                <Machine1 isWorking={isWorking} scale={MACHINE_CONFIG.scale} />
            </group>
        </group>
    );
}

// ─── FlyingProduct: 생산품이 더미로 날아가는 애니메이션 ──────────
function FlyingProduct({ startPos, endPos, onArrive, industry }: {
    startPos: [number, number, number];
    endPos: [number, number, number];
    onArrive: () => void;
    industry: string;
}) {
    const ref = useRef<THREE.Group>(null);
    const prog = useRef(0);
    const arrived = useRef(false);

    let url = "/models/props/Gold_Bar.gltf";
    let scale = 0.75;
    if (industry === "금광업") { url = "/models/props/Gold_Nugget_Medium.gltf"; scale = 2.0; }
    else if (industry === "제조업") { url = "/models/props/drill.glb"; scale = 0.3; }

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

    return (
        <group ref={ref} position={startPos}>
            <React.Suspense fallback={null}>
                <EnvModel url={url} scale={scale} />
            </React.Suspense>
        </group>
    );
}

// ─── Workstation 메인 컴포넌트 ───────────────────────────────────
interface WorkstationProps {
    position: [number, number, number];
    inWorkstation: boolean;
    onOpenModal: () => void;
}

export function Workstation({ position, inWorkstation, onOpenModal }: WorkstationProps) {
    const half = BW / 2;

    // ── 스토어 연결 (프론트 전역 상태) ─────────────────────────────
    const wsState = useGameStore(s => s.workstationState);
    const setWsState = useGameStore(s => s.setWorkstationState);
    const updateProduct = useGameStore(s => s.updateProduct);
    const usedSlots = useGameStore(s => s.getWarehouseUsage().usedSlots);
    const warehouseMaxSlots = useGameStore(s => s.warehouseMaxSlots);
    const industry = useGameStore(s => s.industry);

    // ── 상태 ─────────────────────────────────────────────────────
    const [maxCapacity, setMaxCapacity] = useState(DEFAULT_WORKSTATION_CAP);
    const [flyingBars, setFlyingBars] = useState<number[]>([]);
    const [gaugeHovered, setGaugeHovered] = useState(false);
    const [remainingSec, setRemainingSec] = useState<number | null>(null);

    // ── refs ──────────────────────────────────────────────────────
    const flyIdRef = useRef(0);

    // ── 파생 상태 (스토어 기반) ───────────────────────────────────
    const isWorking = wsState.isWorking;
    const progress = wsState.totalMs > 0 && isWorking ? Math.min(100, ((Date.now() - wsState.startTime) / wsState.totalMs) * 100) : (wsState.isWorking ? 0 : 0);
    const isCompleted = progress >= 100;
    const isFull = wsState.storedCount >= maxCapacity;
    const isWarehouseFull = usedSlots >= warehouseMaxSlots;
    const cannotProduce = isFull;

    // ── 알림: 생산 중단 ──────────────────────────────────────────
    useEffect(() => {
        if (isWorking && cannotProduce) {
            useGameStore.getState().addAlert({
                message: "작업 라인 중단",
                detail: "작업장 임시 보관함이 가득 찼습니다."
            });
        }
    }, [isWorking, cannotProduce]);

    // ── 3D 위치 ───────────────────────────────────────────────────
    // 생산 도구 시작위치(flying item start pos). 작업장 그룹([0,0,-1] 등) 내부 좌표 기준입니다.
    // 도구들은 <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}> 내부에 배치됩니다.
    // 회전(Math.PI)을 고려해 x는 0.75 - localX * BELT_S, z는 1 - localZ * BELT_S 로 계산합니다.
    const beltEndPos: [number, number, number] =
        industry === "제조업" ? [
            0.75 + 1.2 * BELT_S, // 머신 끝부분 (x)
            TW * 0.12 + 1.5,     // 높이
            1 - (-0.5) * BELT_S  // z
        ] :
            industry === "금광업" ? [
                0.75 - 3.5 * BELT_S, // rock.glb 의 로컬 x=3.5 
                TW * 0.12 + 1.2,
                1 - (-0.3) * BELT_S  // rock.glb 의 로컬 z=-0.3
            ] :
                [0.75 - 0.5 * BELT_S, TW * 0.12 + 0.8, 1 - 1.0 * BELT_S]; // 금제련(Machine1) кон베이어 끝


    // ── 로컬 프레임 업데이트 (생산 진행 상태 & 스택 증가) ──────────
    useFrame(() => {
        // 최신 상태를 참조하도록 getState 사용 (클로저 문제 방지 및 무한 렌더 방지)
        const currentWsState = useGameStore.getState().workstationState;
        if (currentWsState.isWorking && !cannotProduce) {
            const now = Date.now();
            let p = ((now - currentWsState.startTime) / currentWsState.totalMs) * 100;
            if (p >= 100) p = 100;

            const expectedProduced = Math.min(currentWsState.requestedQty, Math.floor(currentWsState.requestedQty * (p / 100)));
            const diff = expectedProduced - currentWsState.producedCount;

            if (diff > 0) {
                // flying bar 트리거
                const numFly = Math.min(diff, 3);
                for (let i = 0; i < numFly; i++) {
                    setTimeout(() => {
                        flyIdRef.current++;
                        setFlyingBars(fb => [...fb, flyIdRef.current]);
                    }, i * 250);
                }

                // 스토어 업데이트 (누적 쌓임)
                // 최신 상태 기준으로 저장해야 무한루프를 방지함.
                useGameStore.getState().setWorkstationState({
                    producedCount: expectedProduced,
                    storedCount: currentWsState.storedCount + diff
                });
            }

            // 완료 감지
            if (p >= 100) {
                setRemainingSec(0);
                const { product } = useGameStore.getState().getIndustryItemNames();
                useGameStore.getState().addAlert({
                    message: "작업 완료! 🎉",
                    detail: `${product} 생산이 완료되었습니다. 클릭하여 창고에 저장하세요!`
                });
                useGameStore.getState().setWorkstationState({ isWorking: false });
            }
        }
    });

    // isWorking 종료 시 UI 타이머 리셋
    useEffect(() => {
        if (!isWorking) setRemainingSec(null);
    }, [isWorking]);

    // 로컬 1초 카운트다운 (폴링 보완 및 초기화)
    useEffect(() => {
        if (!isWorking || isCompleted) return;
        // 남은 시간 1회 즉시 초기화 (null 방지)
        setRemainingSec(Math.ceil((wsState.totalMs - (Date.now() - wsState.startTime)) / 1000));

        const tick = setInterval(() => {
            setRemainingSec(prev => (prev !== null && prev > 0) ? prev - 1 : prev);
        }, 1000);
        return () => clearInterval(tick);
    }, [isWorking, isCompleted, wsState.startTime, wsState.totalMs]);

    // ── 더미 시각화: 단일 스택, 레벨만 변화 ─────────────────────
    const singleStackLevel = getSingleStackLevel(wsState.storedCount, maxCapacity);
    const stackPos: [number, number, number] = [half * 0.4, 0.3, -half * 0.4];

    const handleBarArrive = useCallback((barId: number) => {
        setFlyingBars(prev => prev.filter(id => id !== barId));
    }, []);

    const targetPile = 0; // 더미 단일화로 항상 0번 인덱스

    // ── 남은 시간 포맷 ─────────────────────────────────────────
    const fmtTime = (sec: number | null): string => {
        if (sec === null || sec < 0) return '--:--';
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    // ── HUD 표시 위치: 생산 도구 위 (산업별 조정) ─────────────
    //   금광업·금제련업 → 벨트/바위 위
    //   제조업         → machine1 위
    const toolHudPos: [number, number, number] =
        industry === "제조업"
            ? [MACHINE_CONFIG.position[0] * BELT_S, 4.5, MACHINE_CONFIG.position[2] * BELT_S]
            : [0.75 * BELT_S, 3.5, 1 * BELT_S];

    // ── 커서: canvas 상위의 body에 직접 pointer 적용 ─────────────
    useEffect(() => {
        const canvasWrapper = document.querySelector('canvas')?.parentElement as HTMLElement | null;
        const target = canvasWrapper ?? document.body;
        target.style.cursor = (gaugeHovered && wsState.storedCount > 0) ? 'pointer' : '';
        return () => { target.style.cursor = ''; };
    }, [gaugeHovered, wsState.storedCount]);

    // ═══════════════════════════════════════════
    // JSX
    // ═══════════════════════════════════════════
    return (
        <group position={position}>
            {/* 바닥판 */}
            <mesh position={[0, -0.04, 0]} receiveShadow>
                <boxGeometry args={[BW, 0.08, BW]} />
                <meshStandardMaterial color="#8b7355" />
            </mesh>

            {/* ─── 생산 도구 (산업별 모델) ─── */}
            <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}>
                <React.Suspense fallback={
                    <mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>
                }>
                    {industry === "금광업" ? (
                        <EnvModel url="/models/props/rock.glb" scale={1.8} position={[3.5, 0, -0.3]} rotation={[0, 180, 0]} />
                    ) : industry === "제조업" ? (
                        <ManufacturingMachine isWorking={isWorking && !isCompleted && !cannotProduce} />
                    ) : (
                        /* @ts-ignore */
                        <ConveyorBelt isAnimating={isWorking && !isCompleted && !cannotProduce} />
                    )}
                </React.Suspense>
            </group>

            {/* ─────────────────────────────────────────────────────
                HUD ① 생산 도구 위: 남은 시간 + 현재/목표 개수
                생산 중일 때만 표시
            ───────────────────────────────────────────────────── */}
            {isWorking && !isCompleted && (
                <group position={toolHudPos}>
                    <Html center zIndexRange={[20, 0]}>
                        <div className="flex flex-col items-center gap-1 pointer-events-none select-none">
                            {/* 남은 시간 */}
                            <div className="flex items-center gap-1.5 bg-gray-950/90 border-2 border-orange-400/80 text-orange-300 rounded-xl px-3 py-1.5 shadow-xl backdrop-blur-sm">
                                <span className="text-base animate-pulse">⏳</span>
                                <span className="text-xl font-black tracking-widest tabular-nums font-mono">
                                    {fmtTime(remainingSec)}
                                </span>
                            </div>
                            {/* 현재 생산 개수 / 요청 개수 (HUD 표기 — storedCount와 별도) */}
                            <div className="bg-gray-950/85 border border-emerald-600/50 text-emerald-300 text-xs font-black rounded-lg px-3 py-1 tracking-wider tabular-nums">
                                {wsState.producedCount}
                                <span className="text-gray-500 font-bold"> / {wsState.requestedQty > 0 ? wsState.requestedQty : '?'}</span>
                                <span className="text-gray-600 ml-1 text-[10px]">개</span>
                            </div>
                            {/* 경고 아이콘 (중단 상태) */}
                            {cannotProduce && (
                                <span className="text-xl animate-bounce">⚠️</span>
                            )}
                        </div>
                    </Html>
                </group>
            )}

            {/* ─────────────────────────────────────────────────────
                HUD ③ 상태 아이콘 (배경 없음, 텍스트 + 검은 stroke)
            ───────────────────────────────────────────────────── */}
            <group position={[toolHudPos[0], toolHudPos[1] + 1.2, toolHudPos[2]]}>
                <Html center zIndexRange={[30, 0]}>
                    <div className="flex flex-col items-center justify-center select-none">
                        <style>{`
                            .icon-stroke {
                                -webkit-text-stroke: 3px #000;
                                paint-order: stroke fill;
                                line-height: 1;
                                animation: bounce-icon 0.8s ease-in-out infinite alternate;
                            }
                            .icon-stroke-clickable {
                                -webkit-text-stroke: 3px #000;
                                paint-order: stroke fill;
                                line-height: 1;
                                animation: bounce-icon 0.8s ease-in-out infinite alternate;
                                cursor: pointer;
                                transition: transform 0.1s;
                            }
                            .icon-stroke-clickable:hover { transform: scale(1.2); }
                            @keyframes bounce-icon {
                                from { transform: translateY(0px); }
                                to   { transform: translateY(-8px); }
                            }
                        `}</style>
                        {/* 적재량 가득 → 노란 ! (클릭 가능) */}
                        {isFull && (
                            <span
                                className="icon-stroke-clickable"
                                style={{ fontSize: '64px', color: '#facc15' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    useAlertStore.getState().openAlert(
                                        `작업장 내 임시 보관함이 가득 찼습니다.(${wsState.storedCount}/${maxCapacity}개)\n더미를 클릭하여 창고에 이동하면 생산이 재개됩니다.`,
                                        '! 생산 중단 — 적재 꽉 찼'
                                    );
                                }}
                            >!</span>
                        )}
                        {/* 작동 중지 → 빨간 ? (로딩 중이 아닐 때만) */}
                        {!isWorking && !isFull && !wsState.isStarting && (
                            <span className="icon-stroke" style={{ fontSize: '64px', color: '#ef4444' }}>?</span>
                        )}
                        {/* 작업 시작 중 로딩 스피너 */}
                        {wsState.isStarting && (
                            <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900/80 border border-slate-700 backdrop-blur-md shadow-2xl mt-4">
                                <div className="w-[50px] h-[50px] border-4 border-indigo-500 border-t-indigo-100 rounded-full animate-spin"></div>
                                <span className="whitespace-nowrap text-xs font-black text-indigo-100 mt-2 tracking-widest animate-pulse">준비 중...</span>
                            </div>
                        )}
                    </div>
                </Html>
            </group>

            {/* ─────────────────────────────────────────────────────
                생산품 더미 (클릭 → 창고에 저장)
            ───────────────────────────────────────────────────── */}
            <group
                onPointerEnter={(e) => { e.stopPropagation(); setGaugeHovered(true); }}
                onPointerLeave={(e) => { e.stopPropagation(); setGaugeHovered(false); }}
                onClick={async (e) => {
                    e.stopPropagation();
                    if (wsState.storedCount > 0) {
                        try {
                            if (wsState.storedCount > 0) {
                                await WorkstationAPI.collect(useGameStore.getState().workstationId || 1);
                                await useGameStore.getState().fetchCompanyData(1);
                                
                                const added = wsState.storedCount; // 방금 수확한 개수
                                setWsState({ storedCount: 0 }); // 수령했으므로 0으로 초기화
                                
                                useGameStore.getState().addAlert({
                                    message: "수령 완료 ✅",
                                    detail: `${added}개를 창고에 저장했습니다.`
                                });
                                useAlertStore.getState().openAlert(`${added}개를 창고에 저장했습니다.`, "수령 완료 ✅");
                            }
                        } catch (err: any) {
                            console.error("수령 실패:", err);
                            useAlertStore.getState().openAlert(err?.response?.data?.message || "창고에 잔여 공간이 부족하거나 서버 에러가 났습니다.", "수령 불가");
                        }
                    }
                }}
            >
                {/* 클릭 히트박스 — 더미 모델 실제 크기에 맞춰 축소 */}
                <mesh position={[half * 0.45, 0.5, -half * 0.45]}>
                    <boxGeometry args={[half * 1.4, 1.5, half * 1.4]} />
                    <meshBasicMaterial transparent opacity={0.0} depthWrite={false} />
                </mesh>

                {/* 더미 스택 — 단일 */}
                <group position={stackPos}>
                    <ProductStack stackLevel={singleStackLevel} industry={industry} count={wsState.storedCount} />
                </group>
            </group>

            {/* ─────────────────────────────────────────────────────
                HUD ② 생산품 더미 아래: 적재량 표시
                (생산 중 여부과 관계없이, 아이템이 있으면 항상 표시)
            ───────────────────────────────────────────────────── */}
            {wsState.storedCount > 0 && (
                <group position={[half * 0.45, -0.3, -half * 0.45]}>
                    <Html center zIndexRange={[10, 0]}>
                        <div className="flex flex-col items-center gap-0.5 pointer-events-none select-none">
                            {/* 적재 수량 뱃지 */}
                            <div className={`flex items-center gap-1.5 border-2 text-xs font-black rounded-full px-3 py-1 tracking-widest shadow-lg transition-all
                                ${isWarehouseFull
                                    ? 'bg-rose-950/90 border-rose-400/60 text-rose-200'
                                    : isCompleted
                                        ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200 animate-pulse'
                                        : 'bg-gray-950/90 border-emerald-500/50 text-emerald-300'
                                }`}
                            >
                                <span>📦</span>
                                <span className="tabular-nums">{wsState.storedCount}</span>
                                <span className="text-gray-500 font-bold">/{maxCapacity}</span>
                            </div>
                            {/* 클릭 안내 */}
                            {!isWarehouseFull ? (
                                <div className="text-[9px] font-bold text-slate-400 bg-gray-900/60 border border-gray-700/50 px-2 py-0.5 rounded-full mt-0.5">
                                    {isCompleted ? "✅ 완료 — 클릭하여 창고에 저장" : "클릭하여 창고에 저장"}
                                </div>
                            ) : (
                                <div className="text-[9px] font-bold text-rose-400 bg-rose-900/60 border border-rose-700/50 px-2 py-0.5 rounded-full mt-0.5">
                                    창고 가득참
                                </div>
                            )}
                        </div>
                    </Html>
                </group>
            )}

            {/* Flying products */}
            {flyingBars.map(barId => (
                <FlyingProduct
                    key={barId}
                    startPos={beltEndPos}
                    endPos={stackPos}
                    onArrive={() => handleBarArrive(barId)}
                    industry={industry}
                />
            ))}

            <AreaLabel label="작업장" />
        </group>
    );
}
