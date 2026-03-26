/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, useGLTF, useAnimations, Html } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useGame, useGameStore, toEnIndustry } from "../../../store/gameStore";
import { WorkstationAPI } from "../../../api/gameApi";
import { getWorkerDefByLevel, IndustryKey, WORKER_LEVEL_MODELS } from "../../../constants/workers";
import { playSfx } from "../../../utils/sfx";

import {
  TILE_S, BX, BZ, BW, ROAD_STEP, ROAD_S,
  outerX, outerZ, vRoadX1, vRoadX2,
  CONFIG, M, CAR_PATHS, SHARED_STATE,
  BUILDING_AREAS, WORKSTATION_POS, buildingToPage, EMOTES,
  DEFAULT_WORKSTATION_CAP,
} from "./constants";
import { EnvModel, HoverableGroup } from "./BaseComponents";
import { WorldBounds } from "./SceneHelpers";
import { AreaLabel, BuildingTile, Minigame } from "./BuildingComponents";
import { Workstation } from "./Workstation";

import { GlobalDialog, ConfirmData } from "../modals/GlobalDialog";
import { useAlertStore } from "../../../store/useAlertStore";
import { ControlGuideModal } from "../modals/ControlGuideModal";

// ─────────────────────────────────────────────────────────────────
// 🌊 바다
// ─────────────────────────────────────────────────────────────────
function OceanTile({ position, scale }: { position: [number, number, number], scale: [number, number, number] }) {
  const group = useRef<THREE.Group>(null);
  const { nodes, animations } = useGLTF(M.ocean) as any;
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (actions && actions['평면Action']) {
      const action = actions['평면Action'];
      action.setLoop(THREE.LoopPingPong, Infinity);
      action.setEffectiveTimeScale(0.5);
      action.play();
    }
  }, [actions]);

  return (
    <group ref={group} position={position} scale={scale} dispose={null}>
      <group name="Scene">
        <mesh
          name="LowPolyOcean"
          geometry={nodes.LowPolyOcean.geometry}
          morphTargetDictionary={nodes.LowPolyOcean.morphTargetDictionary}
          morphTargetInfluences={nodes.LowPolyOcean.morphTargetInfluences}
          receiveShadow={false}
        >
          <meshStandardMaterial color="#48cae4" roughness={0.5} metalness={0.3} flatShading={true} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function OceanGrid() {
  const TILE_SIZE = 60;
  const GRID_RADIUS = 1;
  const tiles = [];
  for (let x = -GRID_RADIUS; x <= GRID_RADIUS; x++) {
    for (let z = -GRID_RADIUS; z <= GRID_RADIUS; z++) {
      const scaleX = x % 2 === 0 ? 2 : -2;
      const scaleZ = z % 2 === 0 ? 2 : -2;
      tiles.push(<OceanTile key={`ocean-${x}-${z}`} position={[x * TILE_SIZE, -0.8, z * TILE_SIZE]} scale={[scaleX, 2, scaleZ]} />);
    }
  }
  return <group>{tiles}</group>;
}

// ─────────────────────────────────────────────────────────────────
// 캐릭터
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
  const modeRef = useRef<"idle" | "walking" | "working" | "spawning" | "jumping" | "attacking">("spawning");
  const [mode, setMode] = useState<"idle" | "walking" | "working" | "spawning" | "jumping" | "attacking">("spawning");
  const [showMenu, setShowMenu] = useState(false);
  const jumpVelocityRef = useRef(0);
  const [emotionAnim, setEmotionAnim] = useState<string | null>(null);
  const footstepRef = useRef<HTMLAudioElement | null>(null);

  // 장착된 일꾼 레벨에 따라 캐릭터 모델 결정
  const equippedWorkerLevel = useGameStore(s => {
    const eqId = s.equippedWorkerId;
    if (!eqId) return 0;
    const item = s.inventoryItems.find(i => i.id === eqId);
    return item?.level ?? 0;
  });
  const characterModelPath = WORKER_LEVEL_MODELS[equippedWorkerLevel] || "/models/characters/Barbarian.glb";

  const { scene: characterScene } = useGLTF(characterModelPath);
  const { animations: toolsAnims } = useGLTF("/models/animations/Rig_Medium_Tools.glb");
  const { animations: moveAnims } = useGLTF("/models/animations/Rig_Medium_MovementBasic.glb");
  const { animations: generalAnims } = useGLTF("/models/animations/Rig_Medium_General.glb");
  const { animations: combatAnims } = useGLTF("/models/animations/Rig_Medium_CombatMelee.glb");

  const clonedCharacter = useMemo(() => {
    const c = SkeletonUtils.clone(characterScene);
    c.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });
    return c;
  }, [characterScene]);

  const allAnimations = useMemo(() =>
    [...toolsAnims, ...moveAnims, ...generalAnims, ...combatAnims].map(c => c.clone()),
    [toolsAnims, moveAnims, generalAnims, combatAnims]
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
      if (e.code === 'Space' && !e.repeat) {
        if (lastBuildingRef.current) {
          const b = BUILDING_AREAS.find(a => a.name === lastBuildingRef.current);
          if (b) { onEnterBuilding(b.name, b.label); return; }
        }
        if (modeRef.current !== "jumping" && modeRef.current !== "spawning") {
          keysRef.current.jump = true;
          playSfx("/audio/jump.wav", 0.8);
        }
      }
      if (e.code === 'KeyE' && !e.repeat && !isPaused) {
        setShowMenu(prev => !prev);
      }
      if (e.code === 'KeyX' && !e.repeat && !isPaused) {
        if (modeRef.current !== "spawning" && modeRef.current !== "attacking") {
          modeRef.current = "attacking";
          setMode("attacking");
          playSfx("/audio/hit.wav", 0.8);
        }
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      setKey(e.code, true);
    };
    const onUp = (e: KeyboardEvent) => { setKey(e.code, false); };
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
      playSfx("/audio/spawn.wav", 0.5);
      const onFinished = () => { if (modeRef.current === "spawning") { modeRef.current = "idle"; setMode("idle"); } };
      const mixer = spawnAct.getMixer();
      mixer.addEventListener('finished', onFinished);
      return () => mixer.removeEventListener('finished', onFinished);
    } else {
      modeRef.current = "idle"; setMode("idle");
    }
  }, [actions]);

  useEffect(() => {
    if (!actions) return;
    Object.values(actions).forEach(a => a?.fadeOut(0.2));
    if (emotionAnim && actions[emotionAnim]) {
      actions[emotionAnim]!.setEffectiveTimeScale(1).reset().fadeIn(0.3).play();
      playSfx("/audio/spawn.wav", 0.4);
      return;
    }
    if (mode === "spawning") return;
    const gameStore = useGameStore.getState();
    const currentIndustry = gameStore.industry;

    if (mode === "working") {
      let act;
      if (currentIndustry === "금광업") { act = actions["Pickaxing"] || Object.values(actions)[0]; }
      else if (currentIndustry === "제조업") { act = actions["Work_B"] || actions["Work_A"] || Object.values(actions)[0]; }
      else { act = actions["Work_A"] || actions["Work_B"] || Object.values(actions)[0]; }
      if (act) act.setEffectiveTimeScale(1.2).reset().fadeIn(0.3).play();
    } else if (mode === "attacking") {
      const act = actions["Melee_Unarmed_Attack_Kick"] || actions["Melee_1H_Attack_Slice_Horizontal"] || actions["Melee_Unarmed_Attack_Spin"] || Object.values(actions)[0];
      if (act) {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
        act.setEffectiveTimeScale(1.5).reset().fadeIn(0.1).play();
        const mixer = act.getMixer();
        const onDone = () => { modeRef.current = "idle"; setMode("idle"); mixer.removeEventListener('finished', onDone); };
        mixer.addEventListener('finished', onDone);
      }
    } else if (mode === "jumping") {
      const act = actions["Jump_A"] || actions["Jump_B"] || actions["Jump"] || Object.values(actions)[0];
      if (act) act.setEffectiveTimeScale(1.5).reset().fadeIn(0.1).play();
    } else if (mode === "walking") {
      const act = actions["Running_A"] || actions["Walking_A"] || Object.values(actions)[0];
      if (act) act.setEffectiveTimeScale(1.5).reset().fadeIn(0.3).play();
      // 발걸음 SFX 루프
      if (!footstepRef.current) {
        const a = new Audio("/audio/footstep.mp3");
        a.loop = true;
        a.volume = 0.3 * (useGameStore.getState().sfxVolume / 100);
        footstepRef.current = a;
      }
      footstepRef.current.play().catch(() => {});
    } else {
      // 걷기 아닐 때 발걸음 정지
      if (footstepRef.current) { footstepRef.current.pause(); footstepRef.current.currentTime = 0; }
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
      let canMoveFlag = true;

      if (posRef.current.y < 1.5) {
        for (const carPos of Object.values(SHARED_STATE.cars)) {
          const dx = nextPos.x - carPos.x; const dz = nextPos.z - carPos.z;
          if (dx * dx + dz * dz < 2.5 * 2.5) {
            const oldDist = (posRef.current.x - carPos.x) ** 2 + (posRef.current.z - carPos.z) ** 2;
            if (dx * dx + dz * dz < oldDist) { canMoveFlag = false; break; }
          }
        }
      }

      if (canMoveFlag && posRef.current.y < 1.0) {
        for (const d of mapDecos) {
          const rx = d.radius || 1.0;
          const dx = nextPos.x - d.x; const dz = nextPos.z - d.z;
          if (dx * dx + dz * dz < rx * rx) {
            const oldDist = (posRef.current.x - d.x) ** 2 + (posRef.current.z - d.z) ** 2;
            if (dx * dx + dz * dz < oldDist) { canMoveFlag = false; break; }
          }
        }
      }

      if (canMoveFlag && posRef.current.y < 1.0) {
        for (const b of BUILDING_AREAS) {
          const dx = nextPos.x - b.pos[0]; const dz = nextPos.z - b.pos[1];
          if (dx * dx + dz * dz < 2.2 * 2.2) {
            const oldDist = (posRef.current.x - b.pos[0]) ** 2 + (posRef.current.z - b.pos[1]) ** 2;
            if (dx * dx + dz * dz < oldDist) { canMoveFlag = false; break; }
          }
        }
      }

      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
      const buffer = 5.0;
      if (canMoveFlag) {
        posRef.current.copy(nextPos);
        posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -outerX - buffer, outerX + buffer);
        posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -outerZ - buffer, outerZ + buffer);
      }
    }

    if (keys.jump) {
      if (modeRef.current !== "jumping" && modeRef.current !== "spawning") {
        jumpVelocityRef.current = 10;
      }
      keys.jump = false;
    }

    if (jumpVelocityRef.current !== 0 || posRef.current.y > 0) {
      jumpVelocityRef.current -= 25 * delta;
      posRef.current.y += jumpVelocityRef.current * delta;
      if (posRef.current.y <= 0) { posRef.current.y = 0; jumpVelocityRef.current = 0; }
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

    // ★ 작업장 진입 시 모달 자동 오픈
    if (!prevInWorkstation && inWorkstation && !isWorking_ref.current) {
      onOpenWorkstationModal?.();
    }

    // attacking 모드 중에는 모드 전환하지 않음 (애니메이션 완료 후 자동 idle 복귀)
    if (modeRef.current !== "attacking") {
      let newMode: "idle" | "walking" | "working" | "jumping" = "idle";
      if (posRef.current.y > 0 || jumpVelocityRef.current > 0) {
        newMode = "jumping";
      } else if (inWorkstation && isWorkstationWorking) {
        newMode = "working";
      } else if (isMoving) {
        newMode = "walking";
      }

      if (newMode !== modeRef.current) { modeRef.current = newMode; setMode(newMode); }
    }

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
      <primitive object={clonedCharacter} />
      {showMenu && !isPaused && (
        <Html position={[0, 4, 0]} center zIndexRange={[100, 0]}>
          <div className="relative w-40 h-40 flex items-center justify-center pointer-events-auto">
            {EMOTES.map((em, i) => {
              const angle = (i / EMOTES.length) * Math.PI * 2 - Math.PI / 2;
              const x = Math.cos(angle) * 70;
              const y = Math.sin(angle) * 70;
              return (
                <button key={em.id} className="absolute w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-slate-100 hover:scale-110 transition-transform cursor-pointer border-2 border-slate-200"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  onPointerDown={(e) => { e.stopPropagation(); setEmotionAnim(em.id); setShowMenu(false); }}
                  title={em.id}
                >{em.icon}</button>
              );
            })}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// 환경
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

function AnimatedCar({ modelKey, path, speed = 4, initialProgress = 0 }: {
  modelKey: keyof typeof M; path: [number, number][] | undefined; speed?: number; initialProgress?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(initialProgress);
  const speedRef = useRef(speed);
  const cooldownRef = useRef(0);

  const curve = useMemo(() => {
    if (!path || path.length < 2) return new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.1)]);
    return new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(p[0], 0, p[1])), true, "catmullrom", 0.1);
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
    if (cooldownRef.current > 0) { cooldownRef.current -= delta; }
    else if (collision) { speedRef.current *= -1; cooldownRef.current = 1.0; }
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
      <React.Suspense fallback={null}><EnvModel url={M[modelKey]} scale={TILE_S * 2} /></React.Suspense>
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
      {baseTiles.map(([tx, tz], i) => (<React.Suspense key={`base-${i}`} fallback={null}><EnvModel url={M.base} position={[tx, Y, tz]} scale={3} /></React.Suspense>))}
      {roads.map((r, i) => (<React.Suspense key={`road-${i}`} fallback={null}><EnvModel url={M[r.type]} position={[r.x, Y, r.z]} rotation={[0, ((r.rot ?? 0) * Math.PI) / 180, 0]} scale={ROAD_S} /></React.Suspense>))}
      {mapDecos.map((d, i) => (<React.Suspense key={`deco-${i}`} fallback={null}><EnvModel url={M[d.type]} position={[d.x, Y + 0.5, d.z]} rotation={[0, ((d.rot ?? 0) * Math.PI) / 180, 0]} scale={(d.s ?? 1) * TILE_S} /></React.Suspense>))}
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
// GameScene
// ─────────────────────────────────────────────────────────────────
export function GameScene({
  isPaused, onDialog, isLoginMode,
}: {
  isPaused: boolean; onDialog?: (d: ConfirmData) => void; isLoginMode?: boolean;
}) {
  const openBuildingPage = useGameStore(s => s.openBuildingPage);
  const setWorkstationState = useGameStore(s => s.setWorkstationState);
  const isWorkstationWorking = useGameStore(s => s.workstationState.isWorking);
  const equippedWorkerId = useGameStore(s => s.equippedWorkerId);
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
      onStart: async (qty, workerLevel) => {
        try {
          const store = useGameStore.getState();
          const { reqMat, resProd } = store.getIndustryItemNames();
          // ★ resProd 배수로 강제 (UI에서도 제한하지만, 최종 방어)
          const safeQty = Math.round(qty / resProd) * resProd || resProd;
          const laps = safeQty / resProd;
          const materialNeeded = laps * reqMat;
          const actualProduced = laps * resProd;

          const def = getWorkerDefByLevel(workerLevel || 1);
          const industryName = toEnIndustry(store.industry) as IndustryKey;
          const speedMult = def.speedMultiplier[industryName] || 1.0;
          const totalMsNeeded = Math.ceil((laps * 60000) / speedMult);

          // ★ 시작 전 기존 pile 수량 저장 (fetchCompanyData가 덮어쓸 수 있으므로)
          const existingPile = Math.max(
            store.workstationState.uncollectedPile ?? 0,
            store.workstationState.storedCount ?? 0
          );

          setWorkstationState({ isStarting: true });

          await WorkstationAPI.start({ companyId: 1, recipeId: 1, quantity: safeQty, workerId: 1 });
          await store.fetchCompanyData(1);

          // ★ 기존 pile을 명시적으로 복원하여 누적
          setWorkstationState({
            isStarting: false,
            isWorking: true,
            startTime: Date.now(),
            totalMs: totalMsNeeded,
            requestedQty: actualProduced,
            originalRequestedQty: actualProduced,
            producedCount: 0,
            collectedTotal: 0,
            uncollectedPile: existingPile,
          });

          const timeSec = Math.ceil((laps * 60) / speedMult);
          const timeStr = timeSec >= 60
            ? `${Math.floor(timeSec / 60)}분 ${timeSec % 60 > 0 ? timeSec % 60 + '초' : ''}`
            : `${timeSec}초`;
          store.addAlert({ message: "생산 시작 🏭", detail: `재료 ${materialNeeded}개 소모 • ${actualProduced}개 생산 예정 (${timeStr})` });
        } catch (e) {
          console.error(e);
          setWorkstationState({ isStarting: false });
          useAlertStore.getState().openAlert("작업 시작에 실패했습니다.", "경고");
        }
      },
      onStop: async () => {
        setWorkstationState({ isWorking: false, endTime: null, startTime: 0, totalMs: 0 });
      },
    });
  }, [onDialog, isWorkstationWorking, setWorkstationState]);

  // ★ 작업장 진입 시에만 모달 자동 오픈 (밖→안 전환 감지)
  const prevInWorkstationRef = useRef(inWorkstation);
  useEffect(() => {
      if (!prevInWorkstationRef.current && inWorkstation) {
          handleWorkstationClick();
      }
      prevInWorkstationRef.current = inWorkstation;
  }, [inWorkstation, handleWorkstationClick]);

  return (
    <>
      <color attach="background" args={['#a5e1f9']} />
      <fog attach="fog" args={['#a5e1f9', 300, 1000]} />
      <ambientLight intensity={0.8} color="#ffffff" />

      <React.Suspense fallback={null}><OceanGrid /></React.Suspense>

      <directionalLight position={[20, 40, 20]} intensity={2.0} castShadow shadow-bias={-0.0001} shadow-mapSize={[1024, 1024]}>
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

      <Workstation position={[0, 0, BZ]} inWorkstation={inWorkstation} onOpenModal={handleWorkstationClick} />

      {!isLoginMode && (
        <React.Suspense fallback={null}>
          <PlayerCharacter
            key={equippedWorkerId ?? 'default'}
            isWorkstationWorking={isWorkstationWorking}
            onEnterBuilding={go}
            isPaused={isPaused}
            onInWorkstation={setInWorkstation}
            onOpenWorkstationModal={handleWorkstationClick}
          />
        </React.Suspense>
      )}
    </>
  );
}

/** 카메라가 플레이어를 부드럽게 추적 */
function CameraTracker() {
  useFrame((state) => {
    const target = SHARED_STATE.playerPos;
    if (target.y < -50) return; // 아직 스폰 전
    const controls = state.controls as any;
    if (!controls?.target) return;
    const offset = state.camera.position.clone().sub(controls.target);
    controls.target.lerp(target, 0.05);
    state.camera.position.copy(controls.target.clone().add(offset));
  });
  return null;
}

function refocusCanvas(wrap: HTMLDivElement | null) {
  const canvas = wrap?.querySelector('canvas') as HTMLElement | null;
  if (canvas) { canvas.tabIndex = 0; canvas.focus({ preventScroll: true }); }
}

// ─────────────────────────────────────────────────────────────────
// 최상위
// ─────────────────────────────────────────────────────────────────
export function IsometricScene({ isLoginMode = false }: { isLoginMode?: boolean } = {}) {
  const { state, openModal, closeModal } = useGame();
  const [dialogData, setDialogData] = useState<ConfirmData | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const isGlobalPaused = isLoginMode || !!dialogData || !!state.activeModal || !!state.activeBuildingPage;

  useEffect(() => {
    const handleHotkeys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isLoginMode || !!dialogData || !!state.activeBuildingPage) return;

      const toggleModal = (targetModal: "profile" | "news" | "ranking" | "inventory" | "alert" | "settings") => {
        e.preventDefault();
        if (state.activeModal === targetModal) { closeModal(); } else { openModal(targetModal); }
      };

      switch (e.key.toLowerCase()) {
        case 'i': toggleModal("inventory"); break;
        case 'k': toggleModal("ranking"); break;
        case 'n': toggleModal("news"); break;
        case 'p': toggleModal("profile"); break;
        case 'o': toggleModal("settings"); break;
        case 'l': toggleModal("alert"); break;
      }
    };
    window.addEventListener('keydown', handleHotkeys);
    return () => window.removeEventListener('keydown', handleHotkeys);
  }, [isLoginMode, dialogData, state.activeBuildingPage, state.activeModal, openModal, closeModal]);

  const d = CONFIG.CAMERA.distance;
  const pA = CONFIG.CAMERA.polarAngle;
  const aA = CONFIG.CAMERA.azimuthAngle;
  const cx = d * Math.sin(pA) * Math.sin(aA);
  const cy = d * Math.cos(pA);
  const cz = d * Math.sin(pA) * Math.cos(aA);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { setTimeout(() => refocusCanvas(canvasWrapRef.current), 100); } };
    const onFocusIn = (e: FocusEvent) => {
      const wrap = canvasWrapRef.current; if (!wrap) return;
      const target = e.target as HTMLElement;
      if (!wrap.contains(target) && target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
        setTimeout(() => refocusCanvas(canvasWrapRef.current), 50);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('focusin', onFocusIn);
    return () => { document.removeEventListener('visibilitychange', onVisible); document.removeEventListener('focusin', onFocusIn); };
  }, []);

  const closeDialog = useCallback(() => {
    setTimeout(() => {
      setDialogData(null);
      setTimeout(() => refocusCanvas(canvasWrapRef.current), 100);
    }, 0);
  }, []);

  const handleWrapperClick = useCallback(() => {
    if (!dialogData) { refocusCanvas(canvasWrapRef.current); }
  }, [dialogData]);

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden font-sans bg-[#0a3d6b]">
      <div ref={canvasWrapRef} className="flex-1 w-full h-full relative cursor-auto" style={{ touchAction: "none" }} onClick={handleWrapperClick}>
        <Canvas
          flat orthographic
          camera={{ position: [cx, cy, cz], zoom: isLoginMode ? 40 : CONFIG.CAMERA.initialZoom }}
          shadows
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          performance={{ min: 0.5 }}
          tabIndex={0}
          onCreated={({ gl }) => { gl.domElement.tabIndex = 0; gl.domElement.focus({ preventScroll: true }); }}
        >
          <GameScene onDialog={setDialogData} isPaused={isGlobalPaused} isLoginMode={isLoginMode} />
          <WorldBounds />
          {!isLoginMode && <CameraTracker />}
          <MapControls
            makeDefault enabled={!isLoginMode} enableRotate={false} enableZoom enablePan
            minZoom={CONFIG.CAMERA.minZoom} maxZoom={CONFIG.CAMERA.maxZoom}
            maxPolarAngle={pA} minPolarAngle={pA}
            minAzimuthAngle={aA} maxAzimuthAngle={aA}
            mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY }}
          />
        </Canvas>
        {dialogData && <GlobalDialog data={dialogData} onClose={closeDialog} />}
      </div>
    </div>
  );
}

import { preloadGameModels } from "./preload";
preloadGameModels();