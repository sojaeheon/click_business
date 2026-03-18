/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame, useGameStore } from "../../../store/gameStore";
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
import { ControlGuideModal } from "../modals/ControlGuideModal";

// ─────────────────────────────────────────────────────────────────
// 🌊 1. 바다 타일 1장 (OceanTile) - 구조 변경 완벽 대응!
// ─────────────────────────────────────────────────────────────────
function OceanTile({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);

  // 새로 구운 깔끔한 모델 불러오기
  const { nodes, animations } = useGLTF(M.ocean) as any;
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // ✨ 쓸데없는 애니메이션 다 빼고, 정확히 '평면Action'만 실행합니다!
    if (actions && actions['평면Action']) {
      const action = actions['평면Action'];

      // 유저님이 구워오신 0->1->0->1 완벽 루프 재생!
      action.setLoop(THREE.LoopPingPong, Infinity);
      action.setEffectiveTimeScale(0.5); // 🌊 파도 속도 (입맛에 맞게 조절)
      action.play();
    }
  }, [actions]);

  return (
    // 타일 크기
    <group ref={group} position={position} scale={scale} dispose={null}>
      {/* gltfjsx가 뽑아준 가장 안정적이고 깔끔한 원본 구조 그대로 사용! */}
      <group name="Scene">
        <mesh
          name="LowPolyOcean"
          geometry={nodes.LowPolyOcean.geometry}
          morphTargetDictionary={nodes.LowPolyOcean.morphTargetDictionary}
          morphTargetInfluences={nodes.LowPolyOcean.morphTargetInfluences}
          receiveShadow={false}
        >
          {/* 청량하고 각진 바다 재질 */}
          <meshStandardMaterial
            color="#48cae4"
            roughness={0.5}
            metalness={0.3}
            flatShading={true}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// 🌊 2. 바다 타일맵 관리자 (OceanGrid) -> 예전 Ocean 컴포넌트 대체
// ─────────────────────────────────────────────────────────────────
function OceanGrid() {
  // 블렌더 바다 원본 크기(30) * OceanTile의 스케일(2) = 타일 1장의 실제 크기(60)
  const TILE_SIZE = 60;
  const GRID_RADIUS = 1; // 최적화: 1이면 3x3=9장 렌더링 (기존 3→1 축소)

  const tiles = [];

  // 타일을 바둑판처럼 X축, Z축으로 쫙 깝니다.
  for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x++) {
    for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z++) {
      // ✨ 핵심 마법: x와 z가 짝수냐 홀수냐에 따라 스케일을 2 또는 -2로 뒤집습니다!
      // (음수 스케일을 주면 메쉬가 거울처럼 반전됩니다)
      const scaleX = x % 2 === 0 ? 2 : -2;
      const scaleZ = z % 2 === 0 ? 2 : -2;

      tiles.push(
        <OceanTile
          key={`ocean-${x}-${z}`}
          position={[x * TILE_SIZE, -0.8, z * TILE_SIZE]}
          scale={[scaleX, 2, scaleZ]} // 뒤집힌 스케일 적용!
        />
      );
    }
  }

  // 생성된 수십 장의 바다 타일을 한 번에 렌더링합니다.
  return <group>{tiles}</group>;
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
  const keysRef = useRef({ w: false, a: false, s: false, d: false, jump: false });
  const lastBuildingRef = useRef<string | null>(null);
  const lastInWorkstation = useRef(false);
  const isWorking_ref = useRef(isWorkstationWorking);
  const modeRef = useRef<"idle" | "walking" | "working" | "spawning" | "jumping">("spawning");
  const [mode, setMode] = useState<"idle" | "walking" | "working" | "spawning" | "jumping">("spawning");
  const [showMenu, setShowMenu] = useState(false);
  const jumpVelocityRef = useRef(0);
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
      keysRef.current = { w: false, a: false, s: false, d: false, jump: false };
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

      // 1. 만약 모달이 꺼져있고 영역 안에 있는데 스페이스를 눌렀다면 다시 진입 모달을 띄운다.
      if (e.code === 'Space' && !e.repeat) {
        // 1-1. 건물 진입
        if (lastBuildingRef.current) {
          const b = BUILDING_AREAS.find(a => a.name === lastBuildingRef.current);
          if (b) {
            onEnterBuilding(b.name, b.label);
            return;
          }
        }
        
        // 1-2. 작업장 상호작용 (요청에 따라 스페이스바에서 상호작용 해제)
        // if (lastInWorkstation.current && !isWorking_ref.current) {
        //   onOpenWorkstationModal?.();
        //   return;
        // }

        // 1-3. 필드 점프 (위의 상호작용이 없었을 때만)
        if (modeRef.current !== "jumping" && modeRef.current !== "spawning") {
          keysRef.current.jump = true;
        }
      }

      if (e.code === 'KeyE' && !e.repeat && !isPaused) {
        setShowMenu(prev => !prev);
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      setKey(e.code, true);
    };
    const onUp = (e: KeyboardEvent) => {
      setKey(e.code, false);
    };
    const onBlur = () => { keysRef.current = { w: false, a: false, s: false, d: false, jump: false }; };

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

    const gameStore = useGameStore.getState();
    const currentIndustry = gameStore.industry;

    if (mode === "working") {
      let act;
      if (currentIndustry === "금광업") {
        act = actions["Pickaxing"] || Object.values(actions)[0];
      } else if (currentIndustry === "제조업") {
        act = actions["Work_B"] || actions["Work_A"] || Object.values(actions)[0];
      } else {
        // 기본(금 제련업)
        act = actions["Work_A"] || actions["Work_B"] || Object.values(actions)[0];
      }
      if (act) act.setEffectiveTimeScale(1.2).reset().fadeIn(0.3).play();
    } else if (mode === "jumping") {
      const act = actions["Jump_A"] || actions["Jump_B"] || actions["Jump"] || Object.values(actions)[0];
      if (act) act.setEffectiveTimeScale(1.5).reset().fadeIn(0.1).play();
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
      const nextPos = posRef.current.clone().add(dir);
      let canMove = true;

      // 1. 차 주변을 투과하지 않도록 충돌 (점프 체공 높이가 1.5 미만일 때)
      if (posRef.current.y < 1.5) {
        for (const carPos of Object.values(SHARED_STATE.cars)) {
          const dx = nextPos.x - carPos.x;
          const dz = nextPos.z - carPos.z;
          if (dx * dx + dz * dz < 2.5 * 2.5) { // 자동차 충돌 반경
            const oldDist = (posRef.current.x - carPos.x) ** 2 + (posRef.current.z - carPos.z) ** 2;
            if (dx * dx + dz * dz < oldDist) { // 차에서 멀어지는 방향이면 허용
              canMove = false; break;
            }
          }
        }
      }

      // 2. 가로등, 수풀, 상자 (맵 위 데스크 모델) 무적 투과 방지
      if (canMove && posRef.current.y < 1.0) {
        for (const d of mapDecos) {
          const rx = d.radius || 1.0;
          const dx = nextPos.x - d.x;
          const dz = nextPos.z - d.z;
          if (dx * dx + dz * dz < rx * rx) {
            const oldDist = (posRef.current.x - d.x) ** 2 + (posRef.current.z - d.z) ** 2;
            if (dx * dx + dz * dz < oldDist) {
              canMove = false; break;
            }
          }
        }
      }

      // 3. 빌딩 뚫고 건물 뒤로 사라짐 방지
      if (canMove && posRef.current.y < 1.0) {
        for (const b of BUILDING_AREAS) {
          const dx = nextPos.x - b.pos[0];
          const dz = nextPos.z - b.pos[1];
          if (dx * dx + dz * dz < 2.2 * 2.2) { // 빌딩 충돌 반경
            const oldDist = (posRef.current.x - b.pos[0]) ** 2 + (posRef.current.z - b.pos[1]) ** 2;
            if (dx * dx + dz * dz < oldDist) {
              canMove = false; break;
            }
          }
        }
      }

      // 4. 작업장 충돌 - 제거: 캐릭터가 작업장 안으로 들어가야 상호작용 가능
      // if (canMove && posRef.current.y < 1.0) {
      //   const dx = nextPos.x - WORKSTATION_POS[0];
      //   const dz = nextPos.z - WORKSTATION_POS[1];
      //   if (dx * dx + dz * dz < 2.0 * 2.0) {
      //     const oldDist = (posRef.current.x - WORKSTATION_POS[0]) ** 2 + (posRef.current.z - WORKSTATION_POS[1]) ** 2;
      //     if (dx * dx + dz * dz < oldDist) {
      //       canMove = false;
      //     }
      //   }
      // }


      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);

      const buffer = 5.0; // 타일 밖으로 나갈 수 있게 넉넉하게 변경 (기존 0.2 -> 5.0)
      if (canMove) {
        posRef.current.copy(nextPos);
        posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -outerX - buffer, outerX + buffer);
        posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -outerZ - buffer, outerZ + buffer);
      }
    }

    // 점프 물리 연산 (중력 및 속도)
    if (keys.jump) {
      if (modeRef.current !== "jumping") {
        jumpVelocityRef.current = 10; // 점프 초기 파워를 살짝 높여서 차를 넘도록 조정
      }
      keys.jump = false; // 플래그 소모
    }

    if (jumpVelocityRef.current !== 0 || posRef.current.y > 0) {
      jumpVelocityRef.current -= 25 * delta; // 중력
      posRef.current.y += jumpVelocityRef.current * delta;

      if (posRef.current.y <= 0) {
        posRef.current.y = 0;
        jumpVelocityRef.current = 0;
      }
    }

    groupRef.current.position.set(posRef.current.x, posRef.current.y + 0.35, posRef.current.z);
    SHARED_STATE.playerPos.copy(groupRef.current.position);

    const px = posRef.current.x;
    const pz = posRef.current.z;
    const halfBW = BW / 2;
    const inWorkstation = Math.abs(px - WORKSTATION_POS[0]) < halfBW && Math.abs(pz - WORKSTATION_POS[1]) < halfBW;

    isWorking_ref.current = isWorkstationWorking;
    const prevInWorkstation = lastInWorkstation.current;
    lastInWorkstation.current = inWorkstation;
    onInWorkstation?.(inWorkstation);
    
    // 작업장 진입함(오직 false -> true 순간) & 작업 중이 아닐 때 자동으로 모달 오픈
    if (!prevInWorkstation && inWorkstation && !isWorkstationWorking) {
      onOpenWorkstationModal?.();
    }

    let newMode: "idle" | "walking" | "working" | "jumping" = "idle";

    if (posRef.current.y > 0 || jumpVelocityRef.current > 0) {
      newMode = "jumping";
    } else if (inWorkstation && isWorkstationWorking) {
      newMode = "working";
    } else if (isMoving) {
      newMode = "walking";
    }

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

type Deco = { x: number; z: number; type: keyof typeof M; rot?: number; s?: number; radius?: number };
export const mapDecos: Deco[] = [
  { x: -BX, z: -ROAD_S, type: "streetlight", rot: 90, s: 3, radius: 0.5 },
  { x: BX, z: -ROAD_S, type: "streetlight", rot: 90, s: 3, radius: 0.5 },
  { x: -BX, z: ROAD_S, type: "streetlight", rot: -90, s: 3, radius: 0.5 },
  { x: BX, z: ROAD_S, type: "streetlight", rot: -90, s: 3, radius: 0.5 },
  { x: -(BX / 2 - ROAD_S * 0.6), z: -ROAD_S * 0.6, type: "trafficlightA", rot: 45, s: 3, radius: 0.5 },
  { x: (BX / 2 - ROAD_S * 0.6), z: -ROAD_S * 0.6, type: "trafficlightB", rot: 135, s: 3, radius: 0.5 },
  { x: -(BX + BW * 0.4), z: -(BZ + BW * 0.4), type: "bush", s: 2.5, radius: 1.5 },
  { x: (BX + BW * 0.4), z: -(BZ + BW * 0.4), type: "bush", s: 2.5, radius: 1.5 },
  { x: -(BX + BW * 0.4), z: (BZ + BW * 0.4), type: "bush", s: 2.5, radius: 1.5 },
  { x: (BX + BW * 0.4), z: (BZ + BW * 0.4), type: "bush", s: 2.5, radius: 1.5 },
  { x: -BX + 2.5, z: BZ + 2.5, type: "firehydrant", s: 5, radius: 0.8 },
  { x: BX - 2, z: -BZ * 0.5, type: "firehydrant", s: 5, radius: 0.8 },
  { x: BX + BW * 0.5, z: -(BZ + BW * 0.3), type: "boxA", s: 3, radius: 1.0 },
  { x: BX + BW * 0.5, z: -BZ + 0.5, type: "boxB", s: 3, radius: 1.2 },
  { x: BX + BW * 0.5, z: -(BZ + BW * 0.1), type: "boxA", s: 3, radius: 1.0 },
];

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
      {mapDecos.map((d, i) => (
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
  // 활성 시작시 requestedQty/totalMs를 Workstation 컴포넌트에 주입하는 콜백
  const workstationStartRef = useRef<((opts: { requestedQty: number; totalMs: number }) => void) | null>(null);

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
          // ✅ 산업별 스펙 계산: cycles, 재료 소모, 총 시간
          const store = useGameStore.getState();
          const { reqMat, resProd } = store.getIndustryItemNames();
          const cycles = Math.ceil(qty / resProd);
          const totalMsNeeded = cycles * 60000;
          const materialNeeded = cycles * reqMat;

          // ✅ 재료 창고에서 차감 (updateMaterial 음수 = 차감)
          const deducted = store.updateMaterial(-materialNeeded);
          if (Math.abs(deducted) < materialNeeded) {
            useAlertStore.getState().openAlert("재료가 부족합니다.", "경고");
            return;
          }

          await WorkstationAPI.start({ companyId: 1, recipeId: 1, quantity: qty, workerId: 1 });
          setIsWorkstationWorking(true);

          // ✅ Workstation 컴포넌트에 목표 개수 & 예상 시간 전달
          workstationStartRef.current?.({ requestedQty: cycles * resProd, totalMs: totalMsNeeded });

          store.addAlert({ message: "생산 시작 🏭", detail: `재료 ${materialNeeded}개 소모 • ${cycles * resProd}개 생산 예정 (${cycles}분)` });
        } catch (e) {
          console.error(e);
          useAlertStore.getState().openAlert("작업 시작에 실패했습니다.", "경고");
        }
      },
      onStop: async () => {
        // 수령은 3D 씩 더미 클릭으로 처리되므로 모달에서는 실제 collect 안 함
        setIsWorkstationWorking(false);
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
        <OceanGrid />
      </React.Suspense>

      <directionalLight
        position={[20, 40, 20]}
        intensity={2.0}
        castShadow
        shadow-bias={-0.0001}
        shadow-mapSize={[1024, 1024]}
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
          // 실제 창고 저장은 Workstation 내부에서 gameStore.updateProduct로 처리됨
          // 여기에서는 추가 아이템 혼력 없도록 alert만 저장
          console.log(`[Workstation] ${count}개 창고 저장 완료`);
        }}
        onWorkChange={setIsWorkstationWorking}
        onRegisterStart={(fn) => { workstationStartRef.current = fn; }}
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
export function IsometricScene({ isLoginMode = false }: { isLoginMode?: boolean } = {}) {
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
        case 'i': toggleModal("inventory"); break;

        // 🏆 명예의 전당 (R -> K로 변경하여 새로고침 충돌 방지)
        case 'k': toggleModal("ranking"); break;

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
    // 모달이 열려있으면 캔버스 포커스 이동 금지 (input 포커스 유지)
    if (!dialogData) {
      refocusCanvas(canvasWrapRef.current);
    }
  }, [dialogData]);

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
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          performance={{ min: 0.5 }}
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
        {/* ✨ 조작 가이드 모달 추가 */}
        {!isLoginMode && <ControlGuideModal />}
      </div>
    </div>
  );
}

// ✨ 프리로드 목록 (최적화: 공통 + 현재 산업 props만 선별)
[
  // ── 환경/건물 (필수) ──
  M.base, M.bank, M.hr, M.market, M.warehouse,
  M.roadStraight, M.roadCornerCurved,
  M.roadJunction, M.roadTsplit,
  // ── 차들 / 소품 일부 ──
  M.carHatchback, M.carSedan, M.carPolice,
  M.ocean,
  // ── 캐릭터 + 애니메이션 ──
  "/models/characters/Barbarian.glb",
  "/models/animations/Rig_Medium_Tools.glb",
  "/models/animations/Rig_Medium_MovementBasic.glb",
  "/models/animations/Rig_Medium_General.glb",
  // ── 금 제련업 (컨베이어) 관련 ──
  "/models/props/animated_conveyer_belt.glb",
  "/models/props/Gold_Bar.gltf",
  "/models/props/Gold_Bars_Stack_Small.gltf",
  "/models/props/Gold_Bars_Stack_Medium.gltf",
  "/models/props/Gold_Bars_Stack_Large.gltf",
  // ── 금광업 관련 ──
  "/models/props/rocks_B.gltf",
  "/models/props/Gold_Nuggets.gltf",
  "/models/props/Gold_Nugget_Medium.gltf",
  // ── 제조업 관련 ──
  "/models/props/machine1.glb",
  "/models/props/drill.glb",
  "/models/props/toolbox.glb",
].forEach(url => useGLTF.preload(url));