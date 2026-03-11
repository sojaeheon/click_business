/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame } from "../../store/gameStore";
import { WorkstationAPI } from "../../../api/gameApi";

// ─── 분리된 모듈 imports ─────────────────────────────────────────
import {
  TILE_S, BX, BZ, BW, ROAD_STEP, ROAD_S,
  outerX, outerZ, vRoadX1, vRoadX2,
  CONFIG, M, CAR_PATHS, SHARED_STATE,
  BUILDING_AREAS, WORKSTATION_POS, buildingToPage, EMOTES,
} from "./constants";
import { EnvModel, HoverableGroup } from "./BaseComponents";
import { WorldBounds } from "./SceneHelpers";
import { AreaLabel, BuildingTile, Minigame } from "./BuildingComponents";
import { Workstation } from "./Workstation";

// ─── ConveyorBelt is only used in Workstation.tsx; no local import needed ──
// @ts-ignore
// (ConveyorBelt imported in Workstation.tsx)

// ─── 다이얼로그 타입 ────────────────────────────────────────────
interface ConfirmData {
  type: "building" | "workstation";
  label: string;
  action?: () => void;
  isWorking?: boolean;
  onStart?: (quantity: number) => void;
  onStop?: () => void;
}

// ─── GlobalDialog: Canvas 밖 DOM 디아로그 ───────────────────────
function GlobalDialog({ data, onClose }: { data: ConfirmData; onClose: () => void }) {
  const R: React.CSSProperties = { fontFamily: "'KerisKeduR', sans-serif" };
  const { state } = useGame();
  const [qty, setQty] = useState(1);
  const [isCollecting, setIsCollecting] = useState(false);
  const [particles, setParticles] = useState<{ id: number, x: number, y: number, tx: number, ty: number, delay: number }[]>([]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCollecting) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose, isCollecting]);

  if (data.type === "workstation") {
    const materialPerUnit = 3;
    const warehouseStock = state.warehouseItems.find(i => i.type === "material")?.quantity || 0;
    const totalMaterial = qty * materialPerUnit;
    const canProduce = Math.floor(warehouseStock / materialPerUnit);
    const hasEnough = warehouseStock >= totalMaterial;

    const handleCollect = (e: React.MouseEvent) => {
      setIsCollecting(true);
      const rect = (e.target as HTMLButtonElement).getBoundingClientRect();
      const newParticles = Array.from({ length: 15 }).map((_, i) => ({
        id: Date.now() + i,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        tx: (Math.random() - 0.5) * 150,
        ty: (Math.random() - 0.5) * 150 - 50,
        delay: Math.random() * 0.15
      }));
      setParticles(newParticles);

      setTimeout(() => {
        data.onStop?.();
        onClose();
      }, 1000);
    };

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm" onClick={() => !isCollecting && onClose()}>
        
        {/* Particle Styles & Elements */}
        {particles.map((p) => (
           <React.Fragment key={p.id}>
             <style dangerouslySetInnerHTML={{__html: `
               @keyframes particleFly_${p.id} {
                 0% { transform: scale(0) translate(0, 0); opacity: 0; }
                 20% { transform: scale(1.5) translate(${p.tx}px, ${p.ty}px); opacity: 1; }
                 100% { transform: scale(0.5) translate(400px, -400px); opacity: 0; }
               }
             `}} />
             <div 
               className="fixed w-8 h-8 bg-yellow-400 rounded-full shadow-[0_0_20px_rgba(250,204,21,0.8)] pointer-events-none z-[100] flex items-center justify-center text-xl"
               style={{ 
                 left: p.x, top: p.y, 
                 animation: `particleFly_${p.id} 1s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                 animationDelay: p.delay + "s"
               }}
             >
               ⭐️
             </div>
           </React.Fragment>
        ))}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}} />

        <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col gap-6 border-4 border-slate-200" style={{ ...R, minWidth: 360 }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4">
            <div className={`w-16 h-16 flex items-center justify-center rounded-2xl shadow-inner ${data.isWorking ? 'bg-orange-100 border-2 border-orange-300' : 'bg-slate-100 border-2 border-slate-300'}`}>
              <span className={`text-4xl ${data.isWorking ? 'animate-[spinSlow_4s_linear_infinite]' : ''}`}>⚙️</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-widest">작업장</h2>
              <p className={`text-sm font-bold mt-1 ${data.isWorking ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`}>
                {data.isWorking ? '🔥 기계 가동 중...' : '💤 대기 중'}
              </p>
            </div>
          </div>

          {!data.isWorking ? (
            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 border-2 border-slate-100">
              <label className="text-sm font-bold text-slate-500 uppercase tracking-widest">생산 수량 설정</label>
              <div className="flex items-center gap-4">
                <button className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-xl shadow-sm" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                <input
                  type="number" min={1} value={qty}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="flex-1 text-center text-3xl font-black border-2 border-slate-200 rounded-xl py-2 bg-white text-slate-800 focus:outline-none focus:border-indigo-400"
                />
                <button className="w-12 h-12 rounded-xl bg-white border-2 border-slate-200 font-black text-slate-700 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-xl shadow-sm" onClick={() => setQty(q => q + 1)}>+</button>
              </div>
              <div className="flex flex-col gap-2 pt-4 border-t-2 border-slate-200 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-500">필요 재료</span>
                  <span className={`${hasEnough ? 'text-slate-800' : 'text-rose-500'}`}>{totalMaterial}개</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-500">창고 재고</span>
                  <span className="text-slate-800">{warehouseStock}개</span>
                </div>
                {!hasEnough && (
                  <p className="text-xs font-bold text-rose-500 mt-2 bg-rose-50 border-2 border-rose-100 rounded-xl p-3">
                    ⚠️ 재료가 부족합니다. ({totalMaterial - warehouseStock}개 더 필요)
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 rounded-2xl p-8 flex flex-col items-center justify-center border-2 border-orange-200 gap-4">
               <div className="relative w-24 h-24 flex items-center justify-center">
                 <div className="absolute inset-0 border-8 border-orange-200 rounded-full" />
                 <div className="absolute inset-0 border-8 border-transparent border-t-orange-500 rounded-full animate-spin" />
                 <span className="text-4xl relative z-10 animate-bounce">🎁</span>
               </div>
               <span className="text-orange-600 font-black tracking-widest text-lg">생산이 완료되었습니다!</span>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            {!data.isWorking ? (
              <button
                className={`flex-1 py-4 rounded-xl font-black text-lg transition-all active:scale-95 shadow-lg ${hasEnough ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-indigo-200' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                disabled={!hasEnough}
                onClick={() => { if (hasEnough) { data.onStart?.(qty); onClose(); } }}
              >작업 시작 ▶</button>
            ) : (
              <button
                className="flex-1 py-4 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-white font-black text-lg hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                onClick={handleCollect}
              >결과물 수령</button>
            )}
            <button className="px-6 py-4 rounded-xl bg-slate-100 text-slate-500 border-2 border-slate-200 font-black hover:bg-slate-200 hover:text-slate-700 transition-colors" onClick={() => !isCollecting && onClose()}>닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-[2rem] shadow-2xl p-8 flex flex-col items-center gap-6 min-w-[280px] border-4 border-slate-200" style={R} onClick={(e) => e.stopPropagation()}>
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center border-4 border-indigo-100 shadow-inner">
          <span className="text-4xl">🏛️</span>
        </div>
        <p className="text-xl font-black text-slate-800 text-center leading-relaxed">
          <span className="text-indigo-600 text-2xl">[{data.label}]</span><br />(으)로 이동하시겠습니까?
        </p>
        <div className="flex gap-3 w-full mt-4">
          <button className="flex-1 py-4 rounded-xl bg-indigo-500 text-white font-black text-lg hover:bg-indigo-600 transition-colors shadow-lg active:scale-95" onClick={() => { data.action?.(); onClose(); }}>이동</button>
          <button className="flex-1 py-4 rounded-xl bg-slate-100 text-slate-600 border-2 border-slate-200 font-black text-lg hover:bg-slate-200 transition-colors active:scale-95" onClick={onClose}>취소</button>
        </div>
      </div>
    </div>
  );
}

// ─── PlayerCharacter: WASD + 방향키 이동 ─────────────────────────
function PlayerCharacter({
  isWorkstationWorking,
  onEnterBuilding,
  isPaused,
  onOpenWorkstationModal,
  onInWorkstation,
}: {
  isWorkstationWorking: boolean;
  onEnterBuilding: (name: string, label: string) => void;
  isPaused: boolean;
  onOpenWorkstationModal?: () => void;
  onInWorkstation?: (v: boolean) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const lastBuildingRef = useRef<string | null>(null);
  const lastInWorkstation = useRef(false);
  const isWorking_ref = useRef(isWorkstationWorking);
  const modeRef = useRef<"idle" | "walking" | "working" | "spawning">("spawning");
  const [mode, setMode] = useState<"idle" | "walking" | "working" | "spawning">("spawning");
  const [showMenu, setShowMenu] = useState(false);
  const [emotionAnim, setEmotionAnim] = useState<string | null>(null);

  const { scene: barbarianScene } = useGLTF("/models/characters/Barbarian.glb");
  const { animations: toolsAnims } = useGLTF("/models/animations/Rig_Medium_Tools.glb");
  const { animations: moveAnims } = useGLTF("/models/animations/Rig_Medium_MovementBasic.glb");
  const { animations: generalAnims } = useGLTF("/models/animations/Rig_Medium_General.glb");

  const clonedBarbarian = useMemo(() => {
    const c = SkeletonUtils.clone(barbarianScene);
    c.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });
    return c;
  }, [barbarianScene]);

  const allAnimations = useMemo(() =>
    [...toolsAnims, ...moveAnims, ...generalAnims].map(c => c.clone()),
    [toolsAnims, moveAnims, generalAnims]
  );
  const { actions } = useAnimations(allAnimations, groupRef);

  // 키보드 이벤트
  useEffect(() => {
    // 💡 핵심 버그 픽스: 모달이 팝업되면서 isPaused 상태가 되면 누르고 있던 모든 키 상태를 해제하여 유령입력 제거
    if (isPaused) {
      keysRef.current = { w: false, a: false, s: false, d: false };
      // early return을 하면 이벤트 등록이 안돼서 스페이스바/상호작용이 다 날아가므로 해제만 하고 넘어감
    }

    const setKey = (code: string, val: boolean) => {
      switch (code) {
        case 'KeyW': case 'ArrowUp': keysRef.current.w = val; break;
        case 'KeyA': case 'ArrowLeft': keysRef.current.a = val; break;
        case 'KeyS': case 'ArrowDown': keysRef.current.s = val; break;
        case 'KeyD': case 'ArrowRight': keysRef.current.d = val; break;
      }
    };
    const onDown = (e: KeyboardEvent) => {
      if (isPaused) return;
      if (e.code === 'Space' && !e.repeat) setShowMenu(true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      setKey(e.code, true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setShowMenu(false);
      setKey(e.code, false);
    };
    // 브라우저 화면 포커스 나갈 때 유령입력 제거
    const onBlur = () => { keysRef.current = { w: false, a: false, s: false, d: false }; };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isPaused]);

  // 스폰 애니메이션
  useEffect(() => {
    if (!actions) return;
    const spawnAct = actions["Spawn_Ground"] || actions["Spawn_Air"];
    if (spawnAct) {
      spawnAct.setLoop(THREE.LoopOnce, 1);
      spawnAct.clampWhenFinished = true;
      spawnAct.reset().play();
      const onFinished = () => { if (modeRef.current === "spawning") { modeRef.current = "idle"; setMode("idle"); } };
      const mixer = spawnAct.getMixer();
      mixer.addEventListener('finished', onFinished);
      return () => mixer.removeEventListener('finished', onFinished);
    } else {
      modeRef.current = "idle";
      setMode("idle");
    }
  }, [actions]);

  // 애니메이션 제어
  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach(a => a?.fadeOut(0.2));
    if (emotionAnim && actions[emotionAnim]) {
      actions[emotionAnim]!.setEffectiveTimeScale(1).reset().fadeIn(0.3).play();
      return;
    }
    if (mode === "spawning") return;
    if (mode === "working") {
      const act = actions["Work_B"] || actions["Work_A"] || actions["Pickaxing"] || Object.values(actions)[0];
      if (act) act.setEffectiveTimeScale(1.2).reset().fadeIn(0.3).play();
    } else if (mode === "walking") {
      const act = actions["Running_A"] || actions["Walking_A"] || Object.values(actions)[0];
      if (act) act.setEffectiveTimeScale(1.5).reset().fadeIn(0.3).play();
    } else {
      const act = actions["Idle_A"] || actions["Idle_B"] || null;
      if (act) act.setEffectiveTimeScale(1).reset().fadeIn(0.3).play();
    }
  }, [actions, mode, emotionAnim]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const keys = keysRef.current;
    const fwd = new THREE.Vector3(-1, 0, -1).normalize();
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const dir = new THREE.Vector3();
    if (keys.w) dir.add(fwd);
    if (keys.s) dir.sub(fwd);
    if (keys.a) dir.sub(right);
    if (keys.d) dir.add(right);

    const canMove = !isPaused && mode !== "spawning";
    const isMoving = canMove && dir.length() > 0.01;
    if (isMoving && emotionAnim) setEmotionAnim(null);
    if (isMoving) {
      dir.normalize().multiplyScalar(10 * delta);
      posRef.current.add(dir);
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -outerX + 1, outerX - 1);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -outerZ + 1, outerZ - 1);
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    }

    groupRef.current.position.set(posRef.current.x, 0.35, posRef.current.z);
    SHARED_STATE.playerPos.copy(groupRef.current.position);

    const px = posRef.current.x;
    const pz = posRef.current.z;
    const halfBW = BW / 2;
    const inWorkstation = Math.abs(px - WORKSTATION_POS[0]) < halfBW && Math.abs(pz - WORKSTATION_POS[1]) < halfBW;

    if (inWorkstation && !isWorking_ref.current && !lastInWorkstation.current) onOpenWorkstationModal?.();
    isWorking_ref.current = isWorkstationWorking;
    lastInWorkstation.current = inWorkstation;
    onInWorkstation?.(inWorkstation);

    let newMode: "idle" | "walking" | "working" = inWorkstation && isWorkstationWorking ? "working" : isMoving ? "walking" : "idle";
    if (newMode !== modeRef.current) { modeRef.current = newMode; setMode(newMode); }

    let currentBuilding: string | null = null;
    for (const b of BUILDING_AREAS) {
      if (Math.abs(px - b.pos[0]) < halfBW && Math.abs(pz - b.pos[1]) < halfBW) { currentBuilding = b.name; break; }
    }
    if (currentBuilding && currentBuilding !== lastBuildingRef.current) {
      const b = BUILDING_AREAS.find(a => a.name === currentBuilding)!;
      onEnterBuilding(b.name, b.label);
    }
    lastBuildingRef.current = currentBuilding;
  });

  return (
    <group ref={groupRef} scale={0.9}>
      <primitive object={clonedBarbarian} />
      {showMenu && !isPaused && (
        <Html position={[0, 4, 0]} center zIndexRange={[100, 0]}>
          <div className="relative w-40 h-40 flex items-center justify-center pointer-events-auto">
            {EMOTES.map((em, i) => {
              const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
              const x = Math.cos(angle) * 70;
              const y = Math.sin(angle) * 70;
              return (
                <button
                  key={em.id}
                  className="absolute w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-slate-100 hover:scale-110 transition-transform cursor-pointer border-2 border-slate-200"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  onPointerDown={(e) => { e.stopPropagation(); setEmotionAnim(em.id); setShowMenu(false); }}
                  title={em.id}
                >
                  {em.icon}
                </button>
              );
            })}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── AnimatedCar ─────────────────────────────────────────────────
function AnimatedCar({
  modelKey, path, speed = 4, initialProgress = 0,
}: {
  modelKey: keyof typeof M;
  path: [number, number][] | undefined;
  speed?: number;
  initialProgress?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(initialProgress);
  const speedRef = useRef(speed);
  const cooldownRef = useRef(0);

  const curve = useMemo(() => {
    if (!path || path.length < 2) return new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.1)]);
    const pts = path.map(p => new THREE.Vector3(p[0], 0, p[1]));
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.1);
  }, [path]);

  useFrame((_, delta) => {
    if (!groupRef.current || !path || path.length < 2) return;
    const currentPos = groupRef.current.position;
    let collision = false;
    const collisionDistance = 2.5;
    if (currentPos.distanceTo(SHARED_STATE.playerPos) < collisionDistance) collision = true;
    for (const [otherId, otherPos] of Object.entries(SHARED_STATE.cars)) {
      if (otherId !== modelKey && currentPos.distanceTo(otherPos) < collisionDistance) { collision = true; break; }
    }
    if (cooldownRef.current > 0) {
      cooldownRef.current -= delta;
    } else if (collision) {
      speedRef.current *= -1;
      cooldownRef.current = 1.0;
    }
    const len = curve.getLength();
    progressRef.current = (progressRef.current + (speedRef.current * delta) / len) % 1;
    if (progressRef.current < 0) progressRef.current += 1;
    const point = curve.getPointAt(progressRef.current);
    const tangent = curve.getTangentAt(progressRef.current);
    groupRef.current.position.set(point.x, 0.65, point.z);
    groupRef.current.rotation.y = Math.atan2(tangent.x, tangent.z) + (speedRef.current < 0 ? Math.PI : 0);
    SHARED_STATE.cars[modelKey] = groupRef.current.position.clone();
  });

  return (
    <group ref={groupRef}>
      <React.Suspense fallback={null}>
        <EnvModel url={M[modelKey]} scale={TILE_S * 2} />
      </React.Suspense>
    </group>
  );
}

// ─── MapEnvironment ───────────────────────────────────────────────
function MapEnvironment() {
  const Y = 0;
  const hLineX: number[] = [];
  for (let x = -outerX; x <= outerX + 0.01; x += ROAD_STEP) {
    if (![-BX / 2, BX / 2].some(vx => Math.abs(vx - x) < 0.01)) hLineX.push(parseFloat(x.toFixed(4)));
  }
  const vLineZ: number[] = [];
  for (let z = -outerZ; z <= outerZ + 0.01; z += ROAD_STEP) {
    const isH = Math.abs(z) < 0.01;
    const isOuter = Math.abs(Math.abs(z) - outerZ) < 0.01;
    if (!isH && !isOuter) vLineZ.push(parseFloat(z.toFixed(4)));
  }

  type RT = { x: number; z: number; rot?: number; type: keyof typeof M };
  const roads: RT[] = [
    ...[0].flatMap(z => hLineX.map(x => ({ x, z, type: "roadStraight" as const, rot: 90 }))),
    ...[-BX / 2, BX / 2].flatMap(x => vLineZ.map(z => ({ x, z, type: "roadStraight" as const, rot: 0 }))),
    ...[-BX / 2, BX / 2].map(x => ({ x, z: 0, type: "roadJunction" as const, rot: 90 })),
    ...hLineX.map(x => ({ x, z: -outerZ, type: "roadStraight" as const, rot: 90 })),
    ...hLineX.map(x => ({ x, z: outerZ, type: "roadStraight" as const, rot: 90 })),
    ...vLineZ.map(z => ({ x: -outerX, z, type: "roadStraight" as const, rot: 0 })),
    ...vLineZ.map(z => ({ x: outerX, z, type: "roadStraight" as const, rot: 0 })),
    ...[-BX / 2, BX / 2].map(x => ({ x, z: -outerZ, type: "roadTsplit" as const, rot: 270 })),
    ...[-BX / 2, BX / 2].map(x => ({ x, z: outerZ, type: "roadTsplit" as const, rot: 90 })),
    { x: -outerX, z: 0, type: "roadTsplit" as const, rot: 0 },
    { x: outerX, z: 0, type: "roadTsplit" as const, rot: 180 },
    { x: -outerX, z: -outerZ, type: "roadCornerCurved" as const, rot: 0 },
    { x: outerX, z: -outerZ, type: "roadCornerCurved" as const, rot: 270 },
    { x: -outerX, z: outerZ, type: "roadCornerCurved" as const, rot: 90 },
    { x: outerX, z: outerZ, type: "roadCornerCurved" as const, rot: 180 },
  ];

  const baseTiles: [number, number][] = [
    [-BX, -BZ], [0, -BZ], [BX, -BZ],
    [-BX, BZ], [0, BZ], [BX, BZ],
  ];

  type Deco = { x: number; z: number; type: keyof typeof M; rot?: number; s?: number };
  const decos: Deco[] = [
    { x: -BX, z: -ROAD_S, type: "streetlight", rot: 90, s: 3 },
    { x: BX, z: -ROAD_S, type: "streetlight", rot: 90, s: 3 },
    { x: -BX, z: ROAD_S, type: "streetlight", rot: -90, s: 3 },
    { x: BX, z: ROAD_S, type: "streetlight", rot: -90, s: 3 },
    { x: -(BX / 2 - ROAD_S * 0.6), z: -ROAD_S * 0.6, type: "trafficlightA", rot: 45, s: 3 },
    { x: (BX / 2 - ROAD_S * 0.6), z: -ROAD_S * 0.6, type: "trafficlightB", rot: 135, s: 3 },
    { x: -(BX + BW * 0.4), z: -(BZ + BW * 0.4), type: "bush", s: 2.5 },
    { x: (BX + BW * 0.4), z: -(BZ + BW * 0.4), type: "bush", s: 2.5 },
    { x: -(BX + BW * 0.4), z: (BZ + BW * 0.4), type: "bush", s: 2.5 },
    { x: (BX + BW * 0.4), z: (BZ + BW * 0.4), type: "bush", s: 2.5 },
    { x: -BX + 2.5, z: BZ + 2.5, type: "firehydrant", s: 5 },
    { x: BX - 2, z: -BZ * 0.5, type: "firehydrant", s: 5 },
    { x: BX + BW * 0.5, z: -(BZ + BW * 0.3), type: "boxA", s: 3 },
    { x: BX + BW * 0.5, z: -BZ + 0.5, type: "boxB", s: 3 },
    { x: BX + BW * 0.5, z: -(BZ + BW * 0.1), type: "boxA", s: 3 },
  ];

  return (
    <group>
      {baseTiles.map(([tx, tz], i) => (
        <React.Suspense key={`base-${i}`} fallback={null}>
          <EnvModel url={M.base} position={[tx, Y, tz]} scale={3} />
        </React.Suspense>
      ))}
      {roads.map((r, i) => (
        <React.Suspense key={`road-${i}`} fallback={null}>
          <EnvModel url={M[r.type]} position={[r.x, Y, r.z]} rotation={[0, ((r.rot ?? 0) * Math.PI) / 180, 0]} scale={ROAD_S} />
        </React.Suspense>
      ))}
      {decos.map((d, i) => (
        <React.Suspense key={`deco-${i}`} fallback={null}>
          <EnvModel url={M[d.type]} position={[d.x, Y + 0.5, d.z]} rotation={[0, ((d.rot ?? 0) * Math.PI) / 180, 0]} scale={(d.s ?? 1) * TILE_S} />
        </React.Suspense>
      ))}
      <React.Suspense fallback={null}>
        <AnimatedCar modelKey="carSedan" path={CAR_PATHS.outer} speed={6} initialProgress={0} />
        <AnimatedCar modelKey="carHatchback" path={CAR_PATHS.innerH} speed={5} initialProgress={0.25} />
        <AnimatedCar modelKey="carPolice" path={CAR_PATHS.innerV} speed={6} initialProgress={0.5} />
        <AnimatedCar modelKey="carTaxi" path={CAR_PATHS.outer} speed={5.5} initialProgress={0.7} />
        <AnimatedCar modelKey="carStationwagon" path={CAR_PATHS.topLoop} speed={4.5} initialProgress={0.1} />
      </React.Suspense>
    </group>
  );
}

// ─── GameScene ────────────────────────────────────────────────────
export function GameScene({
  isWorkstationWorking,
  setIsWorkstationWorking,
  onEnterBuilding,
  isPaused,
  onDialog,
}: {
  isWorkstationWorking: boolean;
  setIsWorkstationWorking: (v: boolean) => void;
  onEnterBuilding: (name: string, label: string) => void;
  isPaused: boolean;
  onDialog?: (d: ConfirmData) => void;
}) {
  const { openBuildingPage } = useGame();
  const [inWorkstation, setInWorkstation] = useState(false);

  const go = useCallback((name: string, label: string) => {
    onDialog?.({
      type: "building", label,
      action: () => { const p = buildingToPage[name]; if (p) openBuildingPage(p); }
    });
  }, [onDialog, openBuildingPage]);

  const handleWorkstationClick = useCallback(() => {
    onDialog?.({
      type: "workstation",
      label: "작업장 컨트롤",
      isWorking: isWorkstationWorking,
      onStart: async (qty) => {
        try {
          await WorkstationAPI.start({ companyId: 1, recipeId: 1, quantity: qty, workerId: 1 });
          console.log(`작업 시작: 수량 ${qty}`);
          setIsWorkstationWorking(true);
        } catch (e) {
          console.error(e);
          alert("작업 시작에 실패했습니다.");
        }
      },
      onStop: async () => {
        try {
          await WorkstationAPI.collect(1);
          console.log(`결과물 수령!`);
          setIsWorkstationWorking(false);
          alert("결과물을 성공적으로 수령하여 창고에 보관했습니다.");
        } catch (e) {
          console.error(e);
          alert("수령에 실패했습니다.");
        }
      },
    });
  }, [onDialog, isWorkstationWorking, setIsWorkstationWorking]);

  return (
    <>
      <color attach="background" args={['#b1e2f6']} />
      <fog attach="fog" args={['#b1e2f6', 40, 200]} />
      {/* 1. 배경을 부드럽게 밝혀줄 은은한 빛 */}
      <ambientLight intensity={0.9} color="#ffffff" />

      {/* 2. 메인 태양광: 강도 증가, 그림자 범위(shadow-camera)를 전체 맵(-60~60)이 덮이도록 확장 */}
      <directionalLight
        position={[20, 40, 20]}
        intensity={2.0}
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.5, 150]} />
      </directionalLight>

      {/* 3. 너무 파래보이는 원인이었던 파란 보조광 삭제 및 화이트 컬러 스포트라이트로 윤곽선 확보 */}
      <spotLight position={[0, 20, 0]} intensity={1.5} distance={150} angle={1.2} penumbra={1} color="#6bd9e8" castShadow={false} />
      <directionalLight position={[-30, 15, -30]} intensity={0.5} color="#ffffff" />


      <MapEnvironment />

      <BuildingTile position={[-BX, 0, -BZ]} modelUrl={M.hr} label="인력소" onClick={() => go("hr", "인력소")} />
      <BuildingTile position={[0, 0, -BZ]} modelUrl={M.bank} label="은행" onClick={() => go("bank", "은행")} />
      <BuildingTile position={[BX, 0, -BZ]} modelUrl={M.warehouse} label="창고" onClick={() => go("warehouse", "창고")} />
      <BuildingTile position={[BX, 0, BZ]} modelUrl={M.market} label="마켓" onClick={() => go("market", "마켓")} />

      <Minigame position={[-BX, 0, BZ]} onClick={() => go("minigame", "미니게임")} />

      <Workstation
        position={[0, 0, BZ]}
        isWorking={isWorkstationWorking}
        inWorkstation={inWorkstation}
        onOpenModal={handleWorkstationClick}
        onStoreGold={(count) => {
          console.log(`금괴 ${count}개 창고 저장 요청`);
          alert(`금괴 ${count}개를 창고에 저장했습니다!`);
        }}
      />

      <React.Suspense fallback={null}>
        <PlayerCharacter
          isWorkstationWorking={isWorkstationWorking}
          onEnterBuilding={go}
          isPaused={isPaused}
          onInWorkstation={setInWorkstation}
          onOpenWorkstationModal={!isWorkstationWorking ? handleWorkstationClick : undefined}
        />
      </React.Suspense>
    </>
  );
}

// ─── canvas 포커스 복원 헬퍼 ─────────────────────────────────────
function refocusCanvas(wrap: HTMLDivElement | null) {
  const canvas = wrap?.querySelector('canvas') as HTMLElement | null;
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
  }
}

// ─── IsometricScene ──────────────────────────────────────────────
export function IsometricScene() {
  const [dialogData, setDialogData] = useState<ConfirmData | null>(null);
  const [isWorkstationWorking, setIsWorkstationWorking] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const d = CONFIG.CAMERA.distance;
  const pA = CONFIG.CAMERA.polarAngle;
  const aA = CONFIG.CAMERA.azimuthAngle;
  const cx = d * Math.sin(pA) * Math.sin(aA);
  const cy = d * Math.cos(pA);
  const cz = d * Math.sin(pA) * Math.cos(aA);

  // 탭 전환 / 모달 닫힌 후 자동 포커스 복원
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => refocusCanvas(canvasWrapRef.current), 100);
      }
    };
    // 다른 DOM 요소에 포커스가 갔다가 canvas 영역으로 돌아올 때
    const onFocusIn = (e: FocusEvent) => {
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const target = e.target as HTMLElement;
      // 포커스가 canvas 래퍼 바깥 요소(모달 등)에서 다시 바디/wrap으로 돌아오면 복원
      if (!wrap.contains(target) && target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
        setTimeout(() => refocusCanvas(canvasWrapRef.current), 50);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  // 다이얼로그가 닫힐 때 포커스 복원
  const closeDialog = useCallback(() => {
    // 포인터 이벤트(pointerup)가 현재 렌더트리에서 무사히 끝나기를 기다린 뒤 언마운트
    setTimeout(() => {
      setDialogData(null);
      setTimeout(() => refocusCanvas(canvasWrapRef.current), 100);
    }, 0);
  }, []);

  const handleWrapperClick = useCallback(() => {
    refocusCanvas(canvasWrapRef.current);
  }, []);

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden font-sans bg-[#0a3d6b]">
      <div
        ref={canvasWrapRef}
        className="flex-1 w-full h-full relative cursor-auto"
        style={{ touchAction: "none" }}
        onClick={handleWrapperClick}
      >
        <Canvas
          flat orthographic
          camera={{ position: [cx, cy, cz], zoom: CONFIG.CAMERA.initialZoom }}
          shadows
          gl={{ antialias: true, alpha: true }}
          tabIndex={0}
          onCreated={({ gl }) => {
            gl.domElement.tabIndex = 0;
            gl.domElement.focus({ preventScroll: true });
          }}
        >
          <GameScene
            onDialog={setDialogData}
            isPaused={!!dialogData}
            isWorkstationWorking={isWorkstationWorking}
            setIsWorkstationWorking={setIsWorkstationWorking}
            onEnterBuilding={() => { }}
          />
          {/* 캐릭터 따라가는 카메라 삭제됨 -> 월드 바운드(이동 제한)만 유지 */}
          <WorldBounds />
          <MapControls
            makeDefault enableRotate={false} enableZoom enablePan
            minZoom={CONFIG.CAMERA.minZoom} maxZoom={CONFIG.CAMERA.maxZoom}
            maxPolarAngle={pA} minPolarAngle={pA}
            minAzimuthAngle={aA} maxAzimuthAngle={aA}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }}
          />
        </Canvas>
        {dialogData && <GlobalDialog data={dialogData} onClose={closeDialog} />}
        {/* 카메라 트래킹 모드 삭제됨 (UI 토글도 삭제) */}

      </div>
    </div>
  );
}

// ─── 프리로드 ─────────────────────────────────────────────────────
[
  M.base, M.bank, M.hr, M.market, M.warehouse,
  M.roadStraight, M.roadCornerCurved,
  M.roadJunction, M.roadTsplit,
  M.streetlight, M.trafficlightA, M.trafficlightB,
  M.bush, M.firehydrant, M.boxA, M.boxB,
  M.carHatchback, M.carPolice, M.carSedan, M.carStationwagon, M.carTaxi,
  M.minigame,
  "/models/props/animated_conveyer_belt.glb",
  "/models/characters/Barbarian.glb",
  "/models/animations/Rig_Medium_Tools.glb",
  "/models/animations/Rig_Medium_MovementBasic.glb",
  "/models/animations/Rig_Medium_General.glb",
  "/models/props/Gold_Bar.gltf",
  "/models/props/Gold_Bars.gltf",
  "/models/props/Gold_Bars_Stack_Small.gltf",
  "/models/props/Gold_Bars_Stack_Medium.gltf",
  "/models/props/Gold_Bars_Stack_Large.gltf",
].forEach(url => useGLTF.preload(url));