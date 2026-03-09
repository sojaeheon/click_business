/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls, Text, useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame } from "../../store/gameStore.js";
import type { BuildingPage } from "../../store/gameStore.js";
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt.jsx";

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

// ─── 자동차 경로 (5대 독립 루프 - CatmullRom 부드러운 코너링) ─────
const CAR_PATHS = {
  // 1. 외곽 시계방향
  outer: [
    [-outerX, -outerZ], [0, -outerZ], [outerX, -outerZ],
    [outerX, 0], [outerX, outerZ],
    [0, outerZ], [-outerX, outerZ], [-outerX, 0],
  ] as [number, number][],
  // 2. 중앙 가로 왕복 (z=0)
  innerH: [
    [-outerX, 0], [vRoadX1, 0], [vRoadX2, 0], [outerX, 0],
    [vRoadX2, 0], [vRoadX1, 0],
  ] as [number, number][],
  // 3. 왼쪽 세로 왕복 (x=-6)
  innerV: [
    [vRoadX1, -outerZ], [vRoadX1, -BZ], [vRoadX1, 0],
    [vRoadX1, BZ], [vRoadX1, outerZ],
    [vRoadX1, BZ], [vRoadX1, 0], [vRoadX1, -BZ],
  ] as [number, number][],
  // 4. 외곽 반시계방향 (outerCCW: 반대편 출발)
  outerCCW: [
    [outerX, outerZ], [0, outerZ], [-outerX, outerZ],
    [-outerX, 0], [-outerX, -outerZ],
    [0, -outerZ], [outerX, -outerZ], [outerX, 0],
  ] as [number, number][],
  // 5. 오른쪽 세로 왕복 (x=+6)
  topLoop: [
    [vRoadX2, outerZ], [vRoadX2, BZ], [vRoadX2, 0],
    [vRoadX2, -BZ], [vRoadX2, -outerZ],
    [vRoadX2, -BZ], [vRoadX2, 0], [vRoadX2, BZ],
  ] as [number, number][],
};

// ─── WorldBounds ────────────────────────────────────────────────
function WorldBounds() {
  const { controls } = useThree();
  useFrame(() => {
    if (controls) {
      const limit = CONFIG.CAMERA.boundLimit;
      // @ts-ignore
      const t = controls.target;
      if (t) {
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

// ─── Worker: Rig_Medium_Tools.glb 애니메이션 사용 ───────────────────
// SkeletonUtils.clone()으로 Bone 구조 안전 복제 → useAnimations 연결
function Worker({ isWorking }: { isWorking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/models/animations/Rig_Medium_Tools.glb");

  // SkeletonUtils.clone으로 bone 구조까지 정상 복제
  const clonedScene = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  const { actions } = useAnimations(animations, groupRef);

  useEffect(() => {
    if (!actions) return;
    const names = Object.keys(actions);
    // "tool"로 끝나는 액션 찾기
    const toolAction =
      names.find(n => n.toLowerCase().endsWith("tool")) ||
      names.find(n => n.toLowerCase().includes("pickaxing")) ||
      names.find(n => n.toLowerCase().includes("working"));

    if (isWorking) {
      if (toolAction && actions[toolAction]) {
        actions[toolAction].reset().fadeIn(0.5).play();
      } else if (names[0] && actions[names[0]]) {
        actions[names[0]]!.reset().fadeIn(0.5).play();
      }
    } else {
      // 모든 액션 정지
      names.forEach(n => { if (actions[n]) actions[n]!.fadeOut(0.3); });
    }
  }, [actions, isWorking]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (isWorking) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 5) * 0.03;
    } else {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} />
    </group>
  );
}

// ─── Factory: 작업장 (작업 시작/중단 모달 포함) ─────────────────────
function Factory({
  position,
  onOpenModal,
}: {
  position: [number, number, number];
  onOpenModal: (d: any) => void;
}) {
  const half = BW / 2;
  const [isWorking, setIsWorking] = useState(false);

  const handleClick = () => {
    onOpenModal({
      label: "작업장 컨트롤",
      isWorking,
      onStart: () => setIsWorking(true),
      onStop: () => setIsWorking(false),
    });
  };

  return (
    <HoverableGroup position={position} onClick={handleClick}>
      {/* 흙바닥 */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[BW, 0.08, BW]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>

      {/* 컨베이어 벨트: Y=π/2 (화면 기준 수직), isAnimating으로 가동 연동 */}
      <group scale={BELT_S} position={[0, TW * 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
        <React.Suspense fallback={
          <mesh><boxGeometry args={[BW, TW * 0.3, TW * 0.5]} /><meshStandardMaterial color="#555" wireframe /></mesh>
        }>
          {/* @ts-ignore */}
          <ConveyorBelt isAnimating={isWorking} />
        </React.Suspense>
      </group>

      {/* Worker: 컨베이어 바라봄, clone() 없는 원본 Scene */}
      <group position={[half * 0.55, 0, -half * 0.1]} rotation={[0, -Math.PI / 2, 0]} scale={WORKER_S}>
        <React.Suspense fallback={null}>
          <Worker isWorking={isWorking} />
        </React.Suspense>
      </group>

      {/* 금광석 */}
      <group position={[half * 0.6, 0, -half * 0.7]}>
        <React.Suspense fallback={null}>
          <EnvModel url="/models/props/Gold_Nugget_Large.gltf" scale={TILE_S * 0.4} />
        </React.Suspense>
      </group>

      <AreaLabel label="작업장" />
    </HoverableGroup>
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
        <group position={[0, 0.8, 0]} rotation={[-0.4, Math.PI * 0.75, 0.5]} scale={0.022}>
          <EnvModel url={M.minigame} />
        </group>
      </React.Suspense>
      <AreaLabel label="미니게임" />
    </HoverableGroup>
  );
}

// ─── AnimatedCar (CatmullRomCurve3로 부드러운 코너링) ───────────────
function AnimatedCar({
  modelKey, path, speed = 4, initialProgress = 0,
}: {
  modelKey: keyof typeof M;
  path: [number, number][];
  speed?: number;
  initialProgress?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(initialProgress);

  const curve = useMemo(() => {
    const pts = path.map(p => new THREE.Vector3(p[0], 0, p[1]));
    return new THREE.CatmullRomCurve3(pts, true, "centripetal", 0.5);
  }, [path]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const len = curve.getLength();
    progressRef.current = (progressRef.current + (speed * delta) / len) % 1;
    const point = curve.getPointAt(progressRef.current);
    const tangent = curve.getTangentAt(progressRef.current);
    groupRef.current.position.set(point.x, 0.15, point.z);
    groupRef.current.rotation.y = Math.atan2(tangent.x, tangent.z);
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
function MapEnvironment() {
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
      {/* 잔디 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#c8d8a0" />
      </mesh>

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

      {/* 자동차 5대 - 독립 경로, 서로 다른 속도 */}
      <AnimatedCar modelKey="carSedan" path={CAR_PATHS.outer} speed={6} initialProgress={0} />
      <AnimatedCar modelKey="carTaxi" path={CAR_PATHS.innerH} speed={5} initialProgress={0} />
      <AnimatedCar modelKey="carHatchback" path={CAR_PATHS.innerV} speed={4} initialProgress={0} />
      <AnimatedCar modelKey="carStationwagon" path={CAR_PATHS.outerCCW} speed={5.5} initialProgress={0.5} />
      <AnimatedCar modelKey="carPolice" path={CAR_PATHS.topLoop} speed={3.5} initialProgress={0} />
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

  if (data.type === "factory") {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 border border-slate-200" style={{ ...R, minWidth: 260 }}>
          <div className="text-4xl text-yellow-500">⛏️</div>
          <h2 className="text-xl font-bold text-slate-800">작업장</h2>
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
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center gap-4 min-w-[240px] border border-slate-200"
        style={{ fontFamily: "'KerisKeduLine', sans-serif" }}
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
const GameScene = ({ onDialog }: { onDialog: (d: ConfirmData) => void }) => {
  const { openBuildingPage } = useGame();
  const go = (name: string, label: string) => {
    onDialog({
      type: "building", label,
      action: () => { const p = buildingToPage[name]; if (p) openBuildingPage(p); }
    });
  };

  return (
    <>
      <ambientLight intensity={0.7} color={0xffffff} />
      {/* ★ shadow-camera 범위 [-40,40] → 맵 전체 통일 그림자 */}
      <directionalLight position={[20, 30, 20]} intensity={1.2} castShadow shadow-mapSize={[4096, 4096]}>
        <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 0.1, 100]} />
      </directionalLight>
      <directionalLight position={[-10, 15, -10]} intensity={0.3} color={0xffe8c0} />

      <MapEnvironment />

      <BuildingTile position={[-BX, 0, -BZ]} modelUrl={M.hr} label="인력소" onClick={() => go("hr", "인력소")} />
      <BuildingTile position={[0, 0, -BZ]} modelUrl={M.bank} label="은행" onClick={() => go("bank", "은행")} />
      <BuildingTile position={[BX, 0, -BZ]} modelUrl={M.warehouse} label="창고" onClick={() => go("warehouse", "창고")} />
      <BuildingTile position={[BX, 0, BZ]} modelUrl={M.market} label="마켓" onClick={() => go("market", "마켓")} />

      <React.Suspense fallback={null}>
        <Minigame position={[-BX, 0, BZ]} onClick={() => go("minigame", "미니게임")} />
        <Factory position={[0, 0, BZ]} onOpenModal={(d) => onDialog({ type: "factory", ...d })} />
      </React.Suspense>
    </>
  );
};

// ─── IsometricScene ────────────────────────────────────────────────
export function IsometricScene() {
  const [dialogData, setDialogData] = useState<ConfirmData | null>(null);

  const d = CONFIG.CAMERA.distance;
  const pA = CONFIG.CAMERA.polarAngle;
  const aA = CONFIG.CAMERA.azimuthAngle;
  const cx = d * Math.sin(pA) * Math.sin(aA);
  const cy = d * Math.cos(pA);
  const cz = d * Math.sin(pA) * Math.cos(aA);

  return (
    // HTML 전체: KerisKeduR
    <div className="w-full h-full relative" style={{ fontFamily: "'KerisKeduR', sans-serif" }}>
      <Canvas
        flat
        orthographic
        camera={{ position: [cx, cy, cz], zoom: CONFIG.CAMERA.initialZoom }}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={({ scene }) => { scene.background = new THREE.Color("#d6e8c0"); }}
      >
        <GameScene onDialog={setDialogData} />
        <WorldBounds />
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
        />
      </Canvas>

      {dialogData && (
        <GlobalDialog data={dialogData} onClose={() => setDialogData(null)} />
      )}
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
].forEach(url => useGLTF.preload(url));