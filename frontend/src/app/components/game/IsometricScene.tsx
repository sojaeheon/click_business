/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls, Text, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame } from "../../store/gameStore";
import type { BuildingPage } from "../../store/gameStore";
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt";

// ─── 상수 ─────────────────────────────────────────────────────
const TILE_S = 1.5;
const BLDG_S = TILE_S * 2;   // = 3
const BX = TILE_S * 8;   // = 12
const BZ = TILE_S * 4;   // = 6
const WORKER_S = 0.6;
const BELT_S = 0.55;

const TW = TILE_S * 2;
const BW = BLDG_S * 2;  // = 6
const ROAD_GAP_W = BX - BW;     // = 6
const ROAD_S = TILE_S * (ROAD_GAP_W / TW); // = 3
const ROAD_STEP = ROAD_S * 2;  // = 6

// 폰트: 3D 라벨 → KerisKeduLine
const FONT_URL = "fonts/KERISKEDU_Line.ttf";

const outerX = BX + BW / 2 + ROAD_STEP / 2; // = 18
const outerZ = BZ + BW / 2 + ROAD_STEP / 2; // = 12
const vRoadX1 = -BX / 2; // = -6
const vRoadX2 = BX / 2; // =  6

const CONFIG = {
  CAMERA: {
    polarAngle: Math.PI / 3,
    azimuthAngle: Math.PI / 4,
    initialZoom: 80,
    distance: 60,
    minZoom: 40,
    maxZoom: 150,
    boundLimit: 15,
  },
};

const buildingToPage: Record<string, BuildingPage> = {
  hr: "hr", bank: "bank", warehouse: "warehouse", minigame: "minigame", market: "market",
};

const ENV = "/models/environments/";
const M = {
  base: `${ENV}base.gltf`,
  bank: `${ENV}bank.gltf`,
  hr: `${ENV}humanresourcecenter.gltf`,
  market: `${ENV}market.gltf`,
  warehouse: `${ENV}warehouse.gltf`,
  roadStraight: `${ENV}road_straight.gltf`,
  roadCorner: `${ENV}road_corner.gltf`,
  roadCornerCurved: `${ENV}road_corner_curved.gltf`,
  roadJunction: `${ENV}road_junction.gltf`,
  roadTsplit: `${ENV}road_tsplit.gltf`,
  streetlight: `${ENV}streetlight.gltf`,
  trafficlightA: `${ENV}trafficlight_A.gltf`,
  trafficlightB: `${ENV}trafficlight_B.gltf`,
  bush: `${ENV}bush.gltf`,
  firehydrant: `${ENV}firehydrant.gltf`,
  boxA: `${ENV}box_A.gltf`,
  boxB: `${ENV}box_B.gltf`,
  carHatchback: `${ENV}car_hatchback.gltf`,
  carPolice: `${ENV}car_police.gltf`,
  carSedan: `${ENV}car_sedan.gltf`,
  carStationwagon: `${ENV}car_stationwagon.gltf`,
  carTaxi: `${ENV}car_taxi.gltf`,
  minigame: `${ENV}minecraft_pickaxe.gltf`,
};

// ─── 자동차 경로 (중앙선 기준 - 차량 컴포넌트 내부에서 우측 동적 오프셋 적용) ─────
const CAR_PATHS = {
  // 1. 외곽 루프
  outer: [
    [-outerX, -outerZ], [outerX, -outerZ], [outerX, outerZ], [-outerX, outerZ], [-outerX, -outerZ]
  ] as [number, number][],
  // 2. 중앙 가로 루프 (내부)
  innerH: [
    [-outerX, 0], [vRoadX1, 0], [vRoadX2, 0], [outerX, 0], [vRoadX2, 0], [vRoadX1, 0], [-outerX, 0]
  ] as [number, number][],
  // 3. 왼쪽 세로 루프
  innerV: [
    [vRoadX1, -outerZ], [vRoadX1, -BZ], [vRoadX1, 0], [vRoadX1, BZ], [vRoadX1, outerZ], [vRoadX1, BZ], [vRoadX1, 0], [vRoadX1, -BZ], [vRoadX1, -outerZ]
  ] as [number, number][],
  // 4. 우측 8자 패턴
  topLoop: [
    [vRoadX2, outerZ], [vRoadX2, 0], [outerX, 0], [outerX, -outerZ], [vRoadX2, -outerZ], [vRoadX2, -BZ], [vRoadX2, 0], [vRoadX2, outerZ]
  ] as [number, number][],
};

// ─── 전역 충돌 관리 상태 ─────────────────────────────────────────
// 차량 간 및 캐릭터 간 충돌을 감지하기 위한 공유 상태
export const SHARED_STATE = {
  playerPos: new THREE.Vector3(0, -100, 0),
  cars: {} as Record<string, THREE.Vector3>,
};

// ─── WorldBounds ────────────────────────────────────────────────
function WorldBounds({ autoCamera = true }: { autoCamera?: boolean }) {
  const { controls, camera } = useThree();
  useFrame(() => {
    if (controls) {
      const limit = CONFIG.CAMERA.boundLimit;
      // @ts-ignore
      const t = controls.target;
      if (t) {
        // 화면 확대 비율이 최대가 아닐 때 (zoom이 최소값+1 보다 클 때) && 자동 카메라가 켜져있을 때
        if (autoCamera && camera.zoom > CONFIG.CAMERA.minZoom + 1) {
          t.lerp(SHARED_STATE.playerPos, 0.1);
        }

        t.x = THREE.MathUtils.clamp(t.x, -limit, limit);
        t.z = THREE.MathUtils.clamp(t.z, -limit, limit);
        // @ts-ignore
        controls.update();
      }
    }
  });
  return null;
}

// ─── HoverableGroup: hover timer 제거 → 즉시 클릭 ──────────────────
function HoverableGroup({ children, onClick, ...props }: any) {
  return (
    <group
      {...props}
      onPointerOver={(e: any) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={(e: any) => { e.stopPropagation(); document.body.style.cursor = "auto"; }}
      onClick={(e: any) => { e.stopPropagation(); if (onClick) onClick(); }}
    >
      {children}
    </group>
  );
}

// ─── EnvModel ────────────────────────────────────────────────────
function EnvModel({
  url, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1,
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat?.color && mat.color.r === 1 && mat.color.g === 1 && mat.color.b === 1 && !mat.map) {
          mat.color.set("#c0a060");
        }
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

// ─── AreaLabel ────────────────────────────────────────────────────
// base 타일 앞면(+Z)에 KerisKeduLine 폰트로 라벨
function AreaLabel({ label }: { label: string }) {
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

// ─── BuildingTile ─────────────────────────────────────────────────
function BuildingTile({
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

// ─── 건물 영역 정의 (플레이어 충돌 감지용) ───────────────────
const BUILDING_AREAS = [
  { name: "hr", label: "인력소", pos: [-BX, -BZ] },
  { name: "bank", label: "은행", pos: [0, -BZ] },
  { name: "warehouse", label: "창고", pos: [BX, -BZ] },
  { name: "market", label: "마켓", pos: [BX, BZ] },
  { name: "minigame", label: "미니게임", pos: [-BX, BZ] },
];
const FACTORY_POS = [0, BZ] as const;

// ─── 이모트 목록 (스페이스바 유지) ──────────────────────────────────
const EMOTES = [
  { id: "Death_A", icon: "☠️" },
  { id: "Spawn_Air", icon: "✨" },
  { id: "Sawing", icon: "🪚" },
  { id: "Pickaxing", icon: "⛏️" },
  { id: "Digging", icon: "🪏" },
];

// ─── PlayerCharacter: WASD 이동 + Barbarian 외형 + 애니메이션 ───────
function PlayerCharacter({
  isFactoryWorking,
  onEnterBuilding,
  debugAnim,
  onAnimList,
  isPaused,
}: {
  isFactoryWorking: boolean;
  onEnterBuilding: (name: string, label: string) => void;
  debugAnim?: string | null;
  onAnimList?: (names: string[]) => void;
  isPaused: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(0, 0.35, 0));
  const keysRef = useRef({ w: false, a: false, s: false, d: false });
  const lastBuildingRef = useRef<string | null>(null);
  const modeRef = useRef<"idle" | "walking" | "working" | "spawning">("spawning");
  const [mode, setMode] = useState<"idle" | "walking" | "working" | "spawning">("spawning");

  // 모션 이모트 드롭다운 UI 가시성 및 애니메이션 상속
  const [showMenu, setShowMenu] = useState(false);
  const [emotionAnim, setEmotionAnim] = useState<string | null>(null);

  const { scene: barbarianScene } = useGLTF("/models/characters/Barbarian.glb");
  // 3개 파일에서 애니메이션 로드
  const { animations: toolsAnims } = useGLTF("/models/animations/Rig_Medium_Tools.glb");
  const { animations: moveAnims } = useGLTF("/models/animations/Rig_Medium_MovementBasic.glb");
  const { animations: generalAnims } = useGLTF("/models/animations/Rig_Medium_General.glb");

  const clonedBarbarian = useMemo(() => {
    const c = SkeletonUtils.clone(barbarianScene);
    c.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [barbarianScene]);

  // 모든 애니메이션 클립 합치기
  const allAnimations = useMemo(() => {
    return [...toolsAnims, ...moveAnims, ...generalAnims].map(c => c.clone());
  }, [toolsAnims, moveAnims, generalAnims]);
  const { actions } = useAnimations(allAnimations, groupRef);

  // 키보드 이벤트 (스페이스바 이모트 기능 포함)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) setShowMenu(true);
      const k = e.key.toLowerCase() as keyof typeof keysRef.current;
      if (k in keysRef.current) keysRef.current[k] = true;
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setShowMenu(false);
      const k = e.key.toLowerCase() as keyof typeof keysRef.current;
      if (k in keysRef.current) keysRef.current[k] = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ─── 초기 Spawn 애니메이션 (페이지 새로고침 시) ─────
  useEffect(() => {
    if (!actions) return;
    const spawnAct = actions["Spawn_Ground"] || actions["Spawn_Air"];
    if (spawnAct) {
      spawnAct.setLoop(THREE.LoopOnce, 1);
      spawnAct.clampWhenFinished = true;
      spawnAct.reset().play();

      const onFinished = () => {
        if (modeRef.current === "spawning") {
          modeRef.current = "idle";
          setMode("idle");
        }
      };

      // 애니메이션 종료 감지
      const mixer = spawnAct.getMixer();
      mixer.addEventListener('finished', onFinished);
      return () => mixer.removeEventListener('finished', onFinished);
    } else {
      modeRef.current = "idle";
      setMode("idle");
    }
  }, [actions]);

  // 애니메이션 이름 목록을 부모에 전달
  useEffect(() => {
    if (actions && onAnimList) {
      onAnimList(Object.keys(actions));
    }
  }, [actions, onAnimList]);

  // 애니메이션 제어 (debugAnim이 있으면 그것만 재생)
  useEffect(() => {
    if (!actions) return;
    // 모든 액션 정지
    Object.values(actions).forEach(a => a?.fadeOut(0.2));

    if (debugAnim && actions[debugAnim]) {
      actions[debugAnim]!.reset().fadeIn(0.3).play();
      return;
    }

    if (emotionAnim && actions[emotionAnim]) {
      const act = actions[emotionAnim]!;
      act.setEffectiveTimeScale(1);
      act.reset().fadeIn(0.3).play();
      return;
    }

    if (mode === "spawning") return; // Spawn 중에는 다른 애니메이션 대기

    if (mode === "working") {
      // Pickaxing 대신 Work_B를 최우선으로 사용
      const act = actions["Work_B"] || actions["Work_A"] || actions["Pickaxing"] || Object.values(actions)[0];
      if (act) {
        act.setEffectiveTimeScale(1.2);
        act.reset().fadeIn(0.3).play();
      }
    } else if (mode === "walking") {
      // 이동 시에는 Walking 대신 Running_A를 사용하여 속도감을 맞춤
      const act = actions["Running_A"] || actions["Walking_A"] || Object.values(actions)[0];
      if (act) {
        act.setEffectiveTimeScale(1.5); // 1.5배 빠른 발동작
        act.reset().fadeIn(0.3).play();
      }
    } else {
      // idle
      const act = actions["Idle_A"] || actions["Idle_B"] || null;
      if (act) {
        act.setEffectiveTimeScale(1);
        act.reset().fadeIn(0.3).play();
      }
    }
  }, [actions, mode, debugAnim, emotionAnim]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const speed = 10; // 이동 속도 약간 상향 (모션과 맞춤)
    const keys = keysRef.current;

    // 아이소메트릭 방향 (카메라 각도 반영)
    const fwd = new THREE.Vector3(-1, 0, -1).normalize();
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const dir = new THREE.Vector3();
    if (keys.w) dir.add(fwd);
    if (keys.s) dir.sub(fwd);
    if (keys.a) dir.sub(right);
    if (keys.d) dir.add(right);

    const canMove = !isPaused && mode !== "spawning";
    const isMoving = canMove && dir.length() > 0.01;

    // 움직이면 이모션 강제 취소
    if (isMoving && emotionAnim) {
      setEmotionAnim(null);
    }

    if (isMoving) {
      dir.normalize().multiplyScalar(speed * delta);
      posRef.current.add(dir);
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -outerX + 1, outerX - 1);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -outerZ + 1, outerZ - 1);
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    }

    groupRef.current.position.set(posRef.current.x, 0.35, posRef.current.z);

    // 차와의 충돌 감지를 위해 전역 상태에 위치 공유
    SHARED_STATE.playerPos.copy(groupRef.current.position);

    // 영역 감지
    const px = posRef.current.x;
    const pz = posRef.current.z;
    const halfBW = BW / 2;

    // 작업장 영역 검사
    const inFactory = Math.abs(px - FACTORY_POS[0]) < halfBW && Math.abs(pz - FACTORY_POS[1]) < halfBW;

    // 모드 결정
    let newMode: "idle" | "walking" | "working";
    if (inFactory && isFactoryWorking) {
      newMode = "working";
    } else if (isMoving) {
      newMode = "walking";
    } else {
      newMode = "idle";
    }
    if (newMode !== modeRef.current) {
      modeRef.current = newMode;
      setMode(newMode);
    }

    // 건물 영역 진입 감지 (작업장 제외)
    let currentBuilding: string | null = null;
    for (const b of BUILDING_AREAS) {
      if (Math.abs(px - b.pos[0]) < halfBW && Math.abs(pz - b.pos[1]) < halfBW) {
        currentBuilding = b.name;
        break;
      }
    }
    // 새로운 건물 영역에 진입하면 다이얼로그
    if (currentBuilding && currentBuilding !== lastBuildingRef.current) {
      const b = BUILDING_AREAS.find(a => a.name === currentBuilding)!;
      onEnterBuilding(b.name, b.label);
    }
    lastBuildingRef.current = currentBuilding;
  });

  return (
    <group ref={groupRef} scale={WORKER_S * 1.5}>
      <primitive object={clonedBarbarian} />
      {showMenu && (
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
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setEmotionAnim(em.id);
                    setShowMenu(false);
                  }}
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

// ─── FlyingGoldBar: 벨트 끝에서 쌓이는 위치로 날아가는 금괴 ──────────
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
    if (t >= 1) {
      arrived.current = true;
      onArrive();
    }
  });

  return (
    <group ref={ref} position={startPos}>
      <React.Suspense fallback={null}>
        <EnvModel url="/models/props/Gold_Bar.gltf" scale={0.75} />
      </React.Suspense>
    </group>
  );
}

// ─── GoldBarStack: 작업량에 따라 금괴 쌓기 (3더미) ──────────────────
const GOLD_STACK_MODELS = [
  "/models/props/Gold_Bars.gltf",
  "/models/props/Gold_Bars_Stack_Small.gltf",
  "/models/props/Gold_Bars_Stack_Medium.gltf",
  "/models/props/Gold_Bars_Stack_Large.gltf",
];
const MAX_PILES = 3;
const MAX_TOTAL = MAX_PILES * GOLD_STACK_MODELS.length; // 12

// 각 더미의 레벨 계산 (totalCount 기반)
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

function GoldBarStack({ stackLevel }: { stackLevel: number }) {
  if (stackLevel <= 0) return null;
  const idx = Math.min(stackLevel - 1, GOLD_STACK_MODELS.length - 1);
  return (
    <React.Suspense fallback={null}>
      <EnvModel url={GOLD_STACK_MODELS[idx]} scale={TILE_S * 0.5} />
    </React.Suspense>
  );
}

// ─── Factory: 작업장 (isWorking 외부 제어, 금괴 3더미 시스템) ─────────
function Factory({
  position,
  isWorking,
  onOpenModal,
}: {
  position: [number, number, number];
  isWorking: boolean;
  onOpenModal: () => void;
}) {
  const half = BW / 2;
  const [progress, setProgress] = useState(0); // 0 ~ 100 API 기반 진행도 (목업)
  const [flyingBars, setFlyingBars] = useState<number[]>([]);
  const flyIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCompleted = progress >= 100;

  const beltEndPos: [number, number, number] = [-0.75 + 2.5, 0.5, 1];
  // 3개 더미 위치 (바닥에서 Y측 위로 띄움)
  const stackPositions: [number, number, number][] = [
    [half * 0.6, 0.3, -half * 0.7],
    [half * 0.15, 0.3, -half * 0.7],
    [half * 0.6, 0.3, -half * 0.2],
  ];

  // 작업 중일 때 주기적으로 비주얼 금괴 날리기 + 목업용 진행도 상승
  useEffect(() => {
    if (isWorking && !isCompleted) {
      intervalRef.current = setInterval(() => {
        flyIdRef.current += 1;
        setFlyingBars(prev => [...prev, flyIdRef.current]);

        // 목업: 75초간 100채우기 (100%시 정지)
        setProgress(p => {
          if (p >= 98) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 100;
          }
          return p + 2;
        });
      }, 1500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isWorking, isCompleted]);

  // progress 기반으로 최대 12개 스택을 계산 (더미 3개 각 4형태씩)
  const totalGold = Math.floor((progress / 100) * MAX_TOTAL);

  // 금괴 도착 시 비행 금괴 ID만 삭제 (총계는 progress 기반 연산)
  const handleBarArrive = useCallback((barId: number) => {
    setFlyingBars(prev => prev.filter(id => id !== barId));
  }, []);

  // 현재 날아가는 금괴의 목적지 더미 결정
  const levels = getStackLevels(totalGold);
  const nextPileIdx = levels.findIndex(l => l < GOLD_STACK_MODELS.length);
  const targetPile = nextPileIdx >= 0 ? nextPileIdx : MAX_PILES - 1;

  return (
    <HoverableGroup position={position} onClick={onOpenModal}>
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[BW, 0.08, BW]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>

      {/* 컨베이어 벨트 */}
      <group scale={BELT_S} position={[0.75, TW * 0.12, 1]} rotation={[0, Math.PI, 0]}>
        <React.Suspense fallback={
          <mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>
        }>
          {/* @ts-ignore */}
          <ConveyorBelt isAnimating={isWorking && !isCompleted} />
        </React.Suspense>
      </group>

      {/* 금괴 3더미 */}
      {stackPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <GoldBarStack stackLevel={levels[i]} />
        </group>
      ))}

      {/* 날아가는 금괴들 */}
      {flyingBars.map(barId => (
        <FlyingGoldBar
          key={barId}
          startPos={beltEndPos}
          endPos={stackPositions[targetPile]}
          onArrive={() => handleBarArrive(barId)}
        />
      ))}

      <AreaLabel label="작업장" />

      {/* 진행도 도넛 차트 */}
      <group position={[0, 4, 0]}>
        <Html center zIndexRange={[10, 0]}>
          <div
            className="relative flex items-center justify-center w-28 h-28 rounded-full bg-white shadow-xl border-4 border-slate-50 flex-col pointer-events-auto"
            title={isCompleted ? "작업완료" : "작업 진행중"}
          >
            {isCompleted ? (
              <span className="text-5xl border-emerald-500 text-emerald-500 font-bold mix-blend-multiply pt-1">❗️</span>
            ) : (
              <>
                <svg className="absolute w-full h-full transform -rotate-90">
                  <circle cx="52" cy="52" r="44" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  <circle
                    cx="52" cy="52" r="44" fill="transparent" stroke="#3b82f6" strokeWidth="12"
                    strokeDasharray={`${(progress / 100) * 276.4} 276.4`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="text-[10px] font-bold text-slate-400 z-10 -mb-1 mt-1">PROGRESS</span>
                <span className="text-2xl font-black text-slate-800 z-10 tracking-tighter" style={{ fontFamily: "'KerisKeduR', sans-serif" }}>
                  {progress}%
                </span>
              </>
            )}
          </div>
        </Html>
      </group>
    </HoverableGroup >
  );
}

// ─── Minigame ─────────────────────────────────────────────────────
function Minigame({ position, onClick }: { position: [number, number, number]; onClick?: () => void }) {
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

// ─── AnimatedCar (충돌 회피 서행 및 우측 차선 교정) ───────────────
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
  const currentSpeedRef = useRef(speed);

  const curve = useMemo(() => {
    if (!path || path.length < 2) {
      return new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.1)]);
    }
    const pts = path.map(p => new THREE.Vector3(p[0], 0, p[1]));
    // catmullrom 곡선, 낮은 tension(장력)을 적용하여 코너에서 크게 바깥으로 돌아 나가지 않도록 조정
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.1);
  }, [path]);

  useFrame((_, delta) => {
    if (!groupRef.current || !path || path.length < 2) return;

    const currentPos = groupRef.current.position;
    const tangent = curve.getTangentAt(progressRef.current);
    const forwardDir = new THREE.Vector3(tangent.x, 0, tangent.z).normalize();

    // 1. 충돌 회피(양보/정지) 판정: 내 앞(시야 전방 60도)에 차량 등 장애물이 있으면 서행 및 정지
    let targetSpeed = speed;
    let collisionDistance = 3.0; // 반경 판정 거리

    // (a) 플레이어 체크
    if (currentPos.distanceTo(SHARED_STATE.playerPos) < collisionDistance) {
      const toPlayer = SHARED_STATE.playerPos.clone().sub(currentPos).normalize();
      if (toPlayer.dot(forwardDir) > 0.5) targetSpeed = 0; // 내 앞이면 정지
    }

    // (b) 다른 차량 체크
    for (const [otherId, otherPos] of Object.entries(SHARED_STATE.cars)) {
      if (otherId !== modelKey && currentPos.distanceTo(otherPos) < collisionDistance) {
        const toOther = otherPos.clone().sub(currentPos).normalize();
        if (toOther.dot(forwardDir) > 0.5) targetSpeed = 0;
      }
    }

    // 급정거 및 부드러운 가속
    currentSpeedRef.current = THREE.MathUtils.lerp(currentSpeedRef.current, targetSpeed, 0.1);

    // 2. 이동 및 위치 갱신
    const len = curve.getLength();
    progressRef.current = (progressRef.current + (currentSpeedRef.current * delta) / len) % 1;
    if (progressRef.current < 0) progressRef.current += 1;

    const point = curve.getPointAt(progressRef.current);

    // (핵심) 우측 차선 오프셋 적용. 접선(진행방향)을 90도 돌린 방향이 내 우측.
    const rightOffset = new THREE.Vector3(forwardDir.z, 0, -forwardDir.x).multiplyScalar(1.2);

    groupRef.current.position.set(point.x + rightOffset.x, 0.65, point.z + rightOffset.z);
    groupRef.current.rotation.y = Math.atan2(forwardDir.x, forwardDir.z);

    // 4. 충돌 판정용 공유 상태 갱신
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

// ─── MapEnvironment ────────────────────────────────────────────────
function MapEnvironment({ theme }: { theme: "grass" | "skyblock" | "water" }) {
  const Y = 0;

  const hLineX: number[] = [];
  for (let x = -outerX; x <= outerX + 0.01; x += ROAD_STEP) {
    if (![-BX / 2, BX / 2].some(vx => Math.abs(vx - x) < 0.01))
      hLineX.push(parseFloat(x.toFixed(4)));
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
      {/* 테마별 바닥(자연 잔디, 우주, 파도풀) 렌더링 */}
      {theme === "grass" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#c8d8a0" />
        </mesh>
      )}
      {theme === "water" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.8} />
        </mesh>
      )}
      {theme === "skyblock" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -50, 0]} receiveShadow>
          <planeGeometry args={[500, 500]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
      )}

      {baseTiles.map(([tx, tz], i) => (
        <React.Suspense key={`base-${i}`} fallback={null}>
          <EnvModel url={M.base} position={[tx, Y, tz]} scale={BLDG_S} />
        </React.Suspense>
      ))}
      {roads.map((r, i) => (
        <React.Suspense key={`road-${i}`} fallback={null}>
          <EnvModel
            url={M[r.type]}
            position={[r.x, Y, r.z]}
            rotation={[0, ((r.rot ?? 0) * Math.PI) / 180, 0]}
            scale={ROAD_S}
          />
        </React.Suspense>
      ))}
      {decos.map((d, i) => (
        <React.Suspense key={`deco-${i}`} fallback={null}>
          <EnvModel
            url={M[d.type]}
            position={[d.x, Y + 0.5, d.z]}
            rotation={[0, ((d.rot ?? 0) * Math.PI) / 180, 0]}
            scale={(d.s ?? 1) * TILE_S}
          />
        </React.Suspense>
      ))}

      {/* 자동차 (경로에 맞춰서 렌더링) */}
      <React.Suspense fallback={null}>
        <AnimatedCar modelKey="carSedan" path={CAR_PATHS.outer} speed={6} initialProgress={0} />
        <AnimatedCar modelKey="carHatchback" path={CAR_PATHS.innerH} speed={5} initialProgress={0.25} />
        <AnimatedCar modelKey="carPolice" path={CAR_PATHS.innerV} speed={6} initialProgress={0.5} />
        <AnimatedCar modelKey="carTaxi" path={CAR_PATHS.outer} speed={5.5} initialProgress={0.7} />
        <AnimatedCar modelKey="carStationwagon" path={CAR_PATHS.topLoop} speed={4.5} initialProgress={0.1} />
      </React.Suspense>

      {/* 테마 배경 변경 HTML */}
    </group>
  );
}

// ─── 6 이동확인 + 작업장 컨트롤 다이얼로그 (Canvas 밖 DOM) ──────────
// HTML 요소라서 KerisKeduR 폰트 적용
interface ConfirmData {
  type: "building" | "factory";
  label: string;
  action?: () => void;
  isWorking?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}

function GlobalDialog({ data, onClose }: { data: ConfirmData; onClose: () => void }) {
  const R: React.CSSProperties = { fontFamily: "'KerisKeduR', sans-serif" };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (data.type === "factory") {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 border border-slate-200" style={{ ...R, minWidth: 260 }} onClick={(e) => e.stopPropagation()}>
          <div className="text-4xl text-yellow-500">⛏️</div>
          <h2 className="text-xl font-bold text-red-500">[작업장]</h2>
          <p className="text-sm text-slate-500">현재 상태: {data.isWorking ? "가동 중 🟢" : "대기 중 ⚪"}</p>
          <div className="flex gap-3 w-full">
            {!data.isWorking ? (
              <button
                className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition-colors shadow"
                onClick={() => { data.onStart?.(); onClose(); }}
              >작업 시작 ▶</button>
            ) : (
              <button
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors shadow"
                onClick={() => { data.onStop?.(); onClose(); }}
              >작업 중단 🛑</button>
            )}
            <button
              className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300 transition-colors"
              onClick={onClose}
            >닫기</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 min-w-[240px] border border-slate-200"
        style={R}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl">🏛️</div>
        <p className="text-lg font-bold text-slate-800 text-center">
          <span className="text-indigo-600">[{data.label}]</span><br />으로 이동하시겠습니까?
        </p>
        <div className="flex gap-3 w-full mt-2">
          <button
            className="flex-1 py-3 rounded-xl bg-indigo-500 text-white font-bold text-sm hover:bg-indigo-600 transition-colors shadow"
            onClick={() => { data.action?.(); onClose(); }}
          >이동</button>
          <button
            className="flex-1 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-300 transition-colors"
            onClick={onClose}
          >취소</button>
        </div>
      </div>
    </div>
  );
}

// ─── GameScene ─────────────────────────────────────────────────────
export function GameScene({
  isFactoryWorking,
  setIsFactoryWorking,
  onEnterBuilding,
  debugAnim,
  onAnimList,
  isPaused,
  onDialog,
}: {
  isFactoryWorking: boolean;
  setIsFactoryWorking: (v: boolean) => void;
  onEnterBuilding: (name: string, label: string) => void;
  debugAnim?: string | null;
  onAnimList?: (names: string[]) => void;
  isPaused: boolean;
  onDialog?: (d: ConfirmData) => void;
}) {
  const { openBuildingPage } = useGame();
  const [theme, setTheme] = useState<"grass" | "skyblock" | "water">("grass");

  const go = useCallback((name: string, label: string) => {
    onDialog?.({
      type: "building", label,
      action: () => { const p = buildingToPage[name]; if (p) openBuildingPage(p); }
    });
  }, [onDialog, openBuildingPage]);

  const handleFactoryClick = useCallback(() => {
    onDialog?.({
      type: "factory",
      label: "작업장 컨트롤",
      isWorking: isFactoryWorking,
      onStart: () => setIsFactoryWorking(true),
      onStop: () => setIsFactoryWorking(false),
    });
  }, [onDialog, isFactoryWorking, setIsFactoryWorking]);

  return (
    <>
      <color attach="background" args={[theme === "skyblock" ? "#1a202c" : "#e0e5ec"]} />
      {theme === "skyblock" && <fog attach="fog" args={["#1a202c", 20, 150]} />}

      <ambientLight intensity={0.6} />
      <directionalLight position={[20, 30, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-10, 20, -10]} intensity={0.5} color="#abcdef" />

      <MapEnvironment theme={theme} />

      <BuildingTile position={[-BX, 0, -BZ]} modelUrl={M.hr} label="인력소" onClick={() => go("hr", "인력소")} />
      <BuildingTile position={[0, 0, -BZ]} modelUrl={M.bank} label="은행" onClick={() => go("bank", "은행")} />
      <BuildingTile position={[BX, 0, -BZ]} modelUrl={M.warehouse} label="창고" onClick={() => go("warehouse", "창고")} />
      <BuildingTile position={[BX, 0, BZ]} modelUrl={M.market} label="마켓" onClick={() => go("market", "마켓")} />

      <Minigame position={[-BX, 0, BZ]} onClick={() => go("minigame", "미니게임")} />

      <Factory
        position={[0, 0, BZ]}
        isWorking={isFactoryWorking}
        onOpenModal={handleFactoryClick}
      />

      {/* WASD 플레이어 캐릭터 */}
      <React.Suspense fallback={null}>
        <PlayerCharacter
          isFactoryWorking={isFactoryWorking}
          onEnterBuilding={go}
          debugAnim={debugAnim}
          onAnimList={onAnimList}
          isPaused={isPaused}
        />
      </React.Suspense>

      {/* 테마 배경 변경 HTML */}
      <Html position={[-outerX, 10, -outerZ]} center zIndexRange={[10, 0]}>
        <div className="absolute top-0 right-0 m-4 flex gap-2 bg-white/80 backdrop-blur rounded-full p-1 shadow">
          {(["grass", "water", "skyblock"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${theme === t ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-200"}`}
            >
              {t === "grass" ? "🌳 숲" : t === "water" ? "💧 바다" : "☁️ 공중"}
            </button>
          ))}
        </div>
      </Html>
    </>
  );
}

// ─── IsometricScene ────────────────────────────────────────────────
export function IsometricScene() {
  const [dialogData, setDialogData] = useState<ConfirmData | null>(null);
  const [debugAnim, setDebugAnim] = useState<string | null>(null);
  const [animNames, setAnimNames] = useState<string[]>([]);
  const [isFactoryWorking, setIsFactoryWorking] = useState(false);
  const [autoCamera, setAutoCamera] = useState(true);

  const d = CONFIG.CAMERA.distance;
  const pA = CONFIG.CAMERA.polarAngle;
  const aA = CONFIG.CAMERA.azimuthAngle;
  const cx = d * Math.sin(pA) * Math.sin(aA);
  const cy = d * Math.cos(pA);
  const cz = d * Math.sin(pA) * Math.cos(aA);

  return (
    <div className="relative w-full h-screen bg-slate-100 flex overflow-hidden font-sans">
      <div className="flex-1 w-full h-full relative cursor-auto" style={{ fontFamily: "'KerisKeduR', sans-serif" }}>
        {/* 카메라 자동 활성화 버튼 */}
        {!autoCamera && (
          <button
            onClick={() => setAutoCamera(true)}
            className="absolute top-4 left-4 z-10 px-4 py-2 bg-blue-500 text-white rounded-full shadow-lg font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2"
          >
            🎯 내 캐릭터 포커스
          </button>
        )}

        <Canvas
          flat
          orthographic
          camera={{ position: [cx, cy, cz], zoom: CONFIG.CAMERA.initialZoom }}
          shadows
          gl={{ antialias: true, alpha: true }}
          onCreated={({ scene }) => { scene.background = new THREE.Color("#d6e8c0"); }}
        >
          <GameScene
            onDialog={setDialogData}
            debugAnim={debugAnim}
            onAnimList={setAnimNames}
            isPaused={!!dialogData}
            isFactoryWorking={isFactoryWorking}
            setIsFactoryWorking={setIsFactoryWorking}
            onEnterBuilding={() => { }}
          />
          <WorldBounds autoCamera={autoCamera} />
          <MapControls
            makeDefault
            enableRotate={false}
            enableZoom={true}
            enablePan={true}
            minZoom={CONFIG.CAMERA.minZoom}
            maxZoom={CONFIG.CAMERA.maxZoom}
            maxPolarAngle={pA}
            minPolarAngle={pA}
            minAzimuthAngle={aA}
            maxAzimuthAngle={aA}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }}
            onStart={() => setAutoCamera(false)}
          />
        </Canvas>

        {dialogData && (
          <GlobalDialog data={dialogData} onClose={() => setDialogData(null)} />
        )}

        {/* 🔧 애니메이션 디버그 패널 (임시) */}
        <div className="absolute top-4 right-4 z-50 bg-white/90 rounded-xl shadow-lg p-3 flex flex-col gap-2 border border-slate-300" style={{ minWidth: 200 }}>
          <p className="text-xs font-bold text-slate-600">🎬 애니메이션 테스트</p>
          <select
            className="text-sm border rounded-lg p-2 bg-white"
            value={debugAnim || ""}
            onChange={(e) => setDebugAnim(e.target.value || null)}
          >
            <option value="">자동 (WASD 모드)</option>
            {animNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400">선택하면 해당 애니메이션 재생</p>
        </div>
      </div>
    </div>
  );
}

// ─── 프리로드 ────────────────────────────────────────────────────────
[
  M.base, M.bank, M.hr, M.market, M.warehouse,
  M.roadStraight, M.roadCorner, M.roadCornerCurved,
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