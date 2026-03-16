/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame } from "../../../store/gameStore";
import { WorkstationAPI } from "../../../api/gameApi";

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

// ✨ 잘 분리해둔 모달을 불러옵니다!
import { GlobalDialog, ConfirmData } from "../modals/GlobalDialog";
import { useAlertStore } from "../../../store/useAlertStore";

// ─────────────────────────────────────────────────────────────────
// 🌊 수정된 바다(Ocean) 컴포넌트
// ─────────────────────────────────────────────────────────────────
function Ocean() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(M.ocean);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // 1. 애니메이션 강제 실행
    if (actions && actions["AnimCtrlAction"]) {
      actions["AnimCtrlAction"].play();
    }

    // 2. 복제(Clone)하지 않고 원본 씬에 직접 파란색 바다 재질을 덮어씌웁니다.
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = new THREE.MeshStandardMaterial({ 
          color: "#0a4b7f", // 짙은 바다색
          roughness: 0.2,   // 살짝 반짝거리게
          metalness: 0.1,
          side: THREE.DoubleSide // 양면 렌더링
        });
        mesh.receiveShadow = true; // 그림자도 받게 설정
      }
    });
  }, [scene, actions]);

  return (
    <group ref={group} position={[0, -0.5, 0]} scale={40}>
      <primitive object={scene} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// 캐릭터 컴포넌트
// ─────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (isPaused) {
      keysRef.current = { w: false, a: false, s: false, d: false };
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
      
      const buffer = 0.2; 
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -outerX + buffer, outerX - buffer);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -outerZ + buffer, outerZ - buffer);
      
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

// ─────────────────────────────────────────────────────────────────
// 환경 및 기타 컴포넌트
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// 게임 씬 메인 (조명, 객체 배치)
// ─────────────────────────────────────────────────────────────────
export function GameScene({
  isWorkstationWorking,
  setIsWorkstationWorking,
  isPaused,
  onDialog,
  isLoginMode,
}: {
  isWorkstationWorking: boolean;
  setIsWorkstationWorking: (v: boolean) => void;
  isPaused: boolean;
  onDialog?: (d: ConfirmData) => void;
  isLoginMode?: boolean;
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
          setIsWorkstationWorking(true);
        } catch (e) {
          console.error(e);
          useAlertStore.getState().openAlert("작업 시작에 실패했습니다.", "경고");
        }
      },
      onStop: async () => {
        try {
          await WorkstationAPI.collect(1);
          setIsWorkstationWorking(false);
          useAlertStore.getState().openAlert("결과물을 성공적으로 수령하여 창고에 보관했습니다.", "수령 완료");
        } catch (e) {
          console.error(e);
          useAlertStore.getState().openAlert("수령에 실패했습니다.", "경고");
        }
      },
    });
  }, [onDialog, isWorkstationWorking, setIsWorkstationWorking]);

  return (
    <>
      <color attach="background" args={['#a5e1f9']} />
      <fog attach="fog" args={['#a5e1f9', 300, 1000]} />
      <ambientLight intensity={0.8} color="#ffffff" />

      {/* ✨ 바다 컴포넌트 추가 */}
      <React.Suspense fallback={null}>
        <Ocean />
      </React.Suspense>

      <directionalLight
        position={[20, 40, 20]}
        intensity={2.0}
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize={[2048, 2048]}
      >
        <orthographicCamera attach="shadow-camera" args={[-80, 80, 80, -80, 0.5, 150]} />
      </directionalLight>

      <spotLight position={[0, 20, 0]} intensity={1.5} distance={150} angle={1.2} penumbra={1} color="#6bd9e8" castShadow={false} />
      <directionalLight position={[-30, 15, -30]} intensity={0.5} color="#ffffff" />

      <MapEnvironment />

      <BuildingTile position={[-BX, 0, -BZ]} modelUrl={M.hr} label="인력소" />
      <BuildingTile position={[0, 0, -BZ]} modelUrl={M.bank} label="은행" />
      <BuildingTile position={[BX, 0, -BZ]} modelUrl={M.warehouse} label="창고" />
      <BuildingTile position={[BX, 0, BZ]} modelUrl={M.market} label="마켓" />

      <Minigame position={[-BX, 0, BZ]} />

      <Workstation
        position={[0, 0, BZ]}
        isWorking={isWorkstationWorking}
        inWorkstation={inWorkstation}
        onOpenModal={handleWorkstationClick}
        onStoreGold={(count) => {
          console.log(`금괴 ${count}개 창고 저장 요청`);
          useAlertStore.getState().openAlert(`금괴 ${count}개를 창고에 저장했습니다!`, "아이템 획득");
        }}
      />

      {!isLoginMode && (
        <React.Suspense fallback={null}>
          <PlayerCharacter
            isWorkstationWorking={isWorkstationWorking}
            onEnterBuilding={go}
            isPaused={isPaused}
            onInWorkstation={setInWorkstation}
            onOpenWorkstationModal={!isWorkstationWorking ? handleWorkstationClick : undefined}
          />
        </React.Suspense>
      )}
    </>
  );
}

function refocusCanvas(wrap: HTMLDivElement | null) {
  const canvas = wrap?.querySelector('canvas') as HTMLElement | null;
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.focus({ preventScroll: true });
  }
}

// ─────────────────────────────────────────────────────────────────
// 최상위 캔버스 컴포넌트 (App에서 호출됨)
// ─────────────────────────────────────────────────────────────────
export function IsometricScene({ isLoginMode = false }: {isLoginMode?: boolean}={}) {
  const { state, openModal, closeModal } = useGame();
  const [dialogData, setDialogData] = useState<ConfirmData | null>(null);
  const [isWorkstationWorking, setIsWorkstationWorking] = useState(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const isGlobalPaused = isLoginMode || !!dialogData || !!state.activeModal || !!state.activeBuildingPage;
  
  // ────────────────────────────────────────────────────────────
  // ⌨️ UI 모달 전용 단축키 (자유로운 스위칭 & 토글 기능 탑재!)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleHotkeys = (e: KeyboardEvent) => {
      // 1. 채팅이나 인풋창 타이핑 중이면 단축키 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      // 2. 🚨 완전 차단 (Hard Block): 건물 입장 창, 작업장 모달, 로그인 화면이 떠있을 때는 단축키 안 먹힘!
      // (기존의 isGlobalPaused 대신, HUD 모달이 켜진 경우는 차단 조건에서 제외했습니다)
      if (isLoginMode || !!dialogData || !!state.activeBuildingPage) return;

      // 💡 핵심 기능: 현재 열린 창을 또 누르면 '닫기', 다른 창을 누르면 '바로 전환' 해주는 스마트 함수!
      const toggleModal = (targetModal: "profile" | "news" | "ranking" | "inventory" | "alert" | "settings") => {
        e.preventDefault();
        if (state.activeModal === targetModal) {
          closeModal(); // 열려있는 창의 단축키를 또 누르면 닫힘
        } else {
          openModal(targetModal); // 다른 창 단축키를 누르면 바로 그 창으로 덮어씌움(전환)
        }
      };

      // 3. 키보드 입력 매핑
      switch (e.key.toLowerCase()) {
        // 🎒 인벤토리
        case 'e':
        case 'i': toggleModal("inventory"); break;
        
        // 🏆 명예의 전당
        case 'r': toggleModal("ranking"); break;
          
        // 📰 뉴스
        case 'n': toggleModal("news"); break;

        // 👤 기업 프로필
        case 'p': toggleModal("profile"); break;

        // ⚙️ 설정
        case 'o': toggleModal("settings"); break;

        // 🔔 알림 (Alert / Notification)
        // ⚠️ 'A' 키는 캐릭터 왼쪽 이동과 겹치므로 'L' 키를 사용합니다!
        case 'l': toggleModal("alert"); break;
      }
    };

    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, [isLoginMode, dialogData, state.activeBuildingPage, state.activeModal, openModal, closeModal]);
  // ────────────────────────────────────────────────────────────

  const d = CONFIG.CAMERA.distance;
  const pA = CONFIG.CAMERA.polarAngle;
  const aA = CONFIG.CAMERA.azimuthAngle;
  const cx = d * Math.sin(pA) * Math.sin(aA);
  const cy = d * Math.cos(pA);
  const cz = d * Math.sin(pA) * Math.cos(aA);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => refocusCanvas(canvasWrapRef.current), 100);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const wrap = canvasWrapRef.current;
      if (!wrap) return;
      const target = e.target as HTMLElement;
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

  const closeDialog = useCallback(() => {
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
          camera={{ position: [cx, cy, cz], zoom: isLoginMode ? 40 : CONFIG.CAMERA.initialZoom }}
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
            isPaused={isGlobalPaused}
            isWorkstationWorking={isWorkstationWorking}
            setIsWorkstationWorking={setIsWorkstationWorking}
            isLoginMode={isLoginMode}
          />
          <WorldBounds />
          <MapControls
            makeDefault enabled={!isLoginMode} enableRotate={false} enableZoom enablePan
            minZoom={CONFIG.CAMERA.minZoom} maxZoom={CONFIG.CAMERA.maxZoom}
            maxPolarAngle={pA} minPolarAngle={pA}
            minAzimuthAngle={aA} maxAzimuthAngle={aA}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }}
          />
        </Canvas>
        {/* ✨ 불러온 GlobalDialog를 여기에 렌더링합니다! */}
        {dialogData && <GlobalDialog data={dialogData} onClose={closeDialog} />}
      </div>
    </div>
  );
}

// ✨ 프리로드 목록
[
  M.base, M.bank, M.hr, M.market, M.warehouse,
  M.roadStraight, M.roadCornerCurved,
  M.roadJunction, M.roadTsplit,
  M.streetlight, M.trafficlightA, M.trafficlightB,
  M.bush, M.firehydrant, M.boxA, M.boxB,
  M.carHatchback, M.carPolice, M.carSedan, M.carStationwagon, M.carTaxi,
  M.minigame, M.ocean,
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