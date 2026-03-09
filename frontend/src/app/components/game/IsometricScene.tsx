/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
// ★ Html 모듈을 추가로 import 합니다!
import { MapControls, Text, useGLTF, Html, useAnimations } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../../store/gameStore";
import type { BuildingPage } from "../../store/gameStore";
// @ts-ignore
import { ConveyorBelt } from "../models/Animated_conveyer_belt.jsx";

// ==========================================
// ⚙️ [게임 설정 및 커스텀 (Configuration)]
// ==========================================
const CONFIG = {
  CAMERA: {
    polarAngle: Math.PI / 3,
    azimuthAngle: Math.PI / 4,
    initialZoom: 90,
    distance: 60,
    minZoom: 90,
    maxZoom: 180,
    boundLimit: 3,
  },
  LAYOUT: {
    xSpread: 5,
    zSpread: 3,
  },
  BUILDING_SCALE: 0.7,
};

const buildingToPage: Record<string, BuildingPage> = {
  hr: "hr",
  bank: "bank",
  warehouse: "warehouse",
  minigame: "minigame",
  // factory: "factory", <- 이제 페이지 이동을 안 하므로 지우거나 무시해도 됩니다.
  market: "market",
};

// --- [ Boundary Component ] ---
function WorldBounds() {
  const { controls } = useThree();
  useFrame(() => {
    if (controls) {
      const limit = CONFIG.CAMERA.boundLimit;
      // @ts-ignore
      const target = controls.target;
      if (target) {
        target.x = THREE.MathUtils.clamp(target.x, -limit, limit);
        target.z = THREE.MathUtils.clamp(target.z, -limit, limit);
        // @ts-ignore
        controls.update();
      }
    }
  });
  return null;
}

// --- [ Reusable Logic ] ---
function HoverableGroup({
  children,
  onClick,
  originalColor,
  hoverColor = "#b0b0b0",
  ...props
}: any) {
  const [hovered, setHovered] = useState(false);
  const color = hovered ? hoverColor : originalColor;

  return (
    <group
      {...props}
      onPointerOver={(e: any) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e: any) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
    >
      {React.Children.map(children, (child: any) => {
        if (React.isValidElement(child) && (child.props as any).userData?.isBody) {
          return React.cloneElement(child as React.ReactElement<any>, {
            children: <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />,
          });
        }
        return child;
      })}
    </group>
  );
}

// --- [ GLTF Model Loading Component ] ---
function CustomModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  useMemo(() => {
    scene.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

// --- [ Building Component (일반 건물) ] ---
function Building({ position, size, color, label, name: _name, onClick, scale = CONFIG.BUILDING_SCALE, modelUrl }: any) {
  const [w, h, d] = size;

  const windows = useMemo(() => {
    const list = [];
    for (let row = 0; row < Math.floor(h / 0.6); row++) {
      for (let col = 0; col < Math.floor(w / 0.8); col++) {
        list.push(
          <mesh key={`${row}-${col}`} position={[-w / 2 + 0.5 + col * 0.7, 0.5 + row * 0.6, d / 2 + 0.01]}>
            <boxGeometry args={[0.3, 0.3, 0.02]} />
            <meshStandardMaterial color="#a8d8ea" emissive="#a8d8ea" emissiveIntensity={0.15} />
          </mesh>
        );
      }
    }
    return list;
  }, [w, h, d]);

  return (
    <HoverableGroup position={position} scale={scale} onClick={onClick} originalColor={color}>
      {modelUrl ? (
        <React.Suspense fallback={
          <mesh><boxGeometry args={size} /><meshStandardMaterial color={color} wireframe /></mesh>
        }>
          <CustomModel modelUrl={modelUrl} />
        </React.Suspense>
      ) : (
        <>
          <mesh position={[0, -0.05, 0]} receiveShadow>
            <boxGeometry args={[w + 0.6, 0.1, d + 0.6]} />
            <meshStandardMaterial color="#e0e0e0" />
          </mesh>
          <mesh position={[0, h / 2, 0]} castShadow receiveShadow userData={{ isBody: true }}>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} metalness={0.1} roughness={0.8} />
          </mesh>
          <mesh position={[0, h + 0.05, 0]} castShadow>
            <boxGeometry args={[w + 0.1, 0.1, d + 0.1]} />
            <meshStandardMaterial color="#999" />
          </mesh>
          {windows}
        </>
      )}

      <Text
        position={[0, modelUrl ? 3.0 : h + 1.2, 0]}
        fontSize={0.5}
        color="#333"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#fff"
      >
        {label}
      </Text>
    </HoverableGroup>
  );
}

// --- [ Factory Component (오픈형 작업장) ] ---
function Factory({ position, scale = CONFIG.BUILDING_SCALE }: any) {
  const workerRef = useRef<THREE.Group>(null);

  // --- [ 애니메이션 설정 추가 ] ---
  // 1. 애니메이션 파일 로드
  const { animations: toolAnimations } = useGLTF("/models/animations/Rig_Medium_Tools.glb");
  // 2. workerRef를 대상으로 하는 애니메이션 액션 추출
  const { actions } = useAnimations(toolAnimations, workerRef);

  // ★ 모달창(팝업)을 띄울지 말지 결정하는 상태값
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!actions) return;

    // 3. 애니메이션 찾기 순서: 
    //   (1) 이름에 'tool'이 포함된 것 
    //   (2) 'pickaxing' (곡괭이질)
    //   (3) 'working_a' (일반 작업)
    const actionNames = Object.keys(actions);
    console.log("찾은 전체 애니메이션 목록:", actionNames);

    const targetAction = actionNames.find(name => name.toLowerCase().endsWith("tool")) ||
      actionNames.find(name => name.toLowerCase().includes("pickaxing")) ||
      actionNames.find(name => name.toLowerCase().includes("working_a"));

    // 4. 애니메이션이 존재하면 재생합니다.
    if (targetAction && actions[targetAction]) {
      console.log("재생할 애니메이션:", targetAction);
      actions[targetAction].reset().fadeIn(0.5).play();
    }
  }, [actions]);

  useFrame(() => {
    // const elapsed = state.clock.elapsedTime;
  });

  return (
    // 클릭 시 페이지 이동이 아니라, 모달을 띄우도록(showModal을 true로) 변경!
    <HoverableGroup position={position} scale={scale} onClick={() => setShowModal(true)} originalColor="#a0a0a0">

      {/* 0. 작업장 바닥 */}
      <mesh position={[0, -0.05, 0]} receiveShadow userData={{ isBody: true }}>
        <boxGeometry args={[4, 0.1, 4]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>

      {/* ★ 3D 공간 위에 떠있는 HTML 미니 모달창 ★ */}
      {showModal && (
        <Html position={[0, 2.5, 0]} center className="pointer-events-auto">
          <div className="bg-white border-2 border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3 w-56 animate-in zoom-in duration-200">
            <h3 className="font-bold text-center text-slate-800 flex items-center justify-center gap-2">
              <span>⛏️</span> 작업 지시
            </h3>
            <div className="text-xs text-slate-500 text-center mb-1">
              무엇을 캘까요?
            </div>

            {/* 작업 버튼들 */}
            <button
              className="bg-yellow-400 text-yellow-900 font-bold py-2 rounded-lg border-2 border-yellow-500 hover:bg-yellow-300 transition-colors"
              onClick={(e) => {
                e.stopPropagation(); // 클릭 이벤트가 바닥으로 뚫고 들어가는 것 방지
                alert('금광석 캐기를 시작합니다!');
                setShowModal(false);
              }}
            >
              금광석 캐기
            </button>
            <button
              className="bg-slate-200 text-slate-800 font-bold py-2 rounded-lg border-2 border-slate-300 hover:bg-slate-300 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                alert('은광석 캐기를 시작합니다!');
                setShowModal(false);
              }}
            >
              은광석 캐기
            </button>

            {/* 닫기 버튼 */}
            <button
              className="mt-2 text-xs text-slate-400 underline hover:text-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(false);
              }}
            >
              닫기
            </button>
          </div>
        </Html>
      )}

      {/* 1. 커다란 금광석 */}
      <group scale={[0.6, 0.6, 0.6]} position={[-0.8, 0.8, -0.5]}>
        {/* ★ 이렇게 React.Suspense 로 감싸야 흰 화면이 안 뜹니다! ★ */}
        <React.Suspense fallback={<mesh><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="red" wireframe /></mesh>}>
          {/* 테스트용 가짜 모델 (실제 모델 경로로 바꾸세요) */}
          {/* <CustomModel modelUrl="/models/props/animated_conveyer_belt.glb" /> */}
          <ConveyorBelt />
        </React.Suspense>
      </group>

      {/* 2. 작업자 캐릭터 */}
      <group ref={workerRef} position={[2, 0, 1]} rotation={[0, 130, 0]}>
        <React.Suspense fallback={<mesh><boxGeometry args={[0.5, 1, 0.5]} /><meshStandardMaterial color="blue" wireframe /></mesh>}>
          <CustomModel modelUrl="/models/characters/Barbarian.glb" />
        </React.Suspense>
      </group>

      {/* 3. 금광석 더미 */}
      <group position={[1.2, 0, -1.2]}>
        <React.Suspense fallback={<mesh><boxGeometry args={[0.5, 0.5, 0.5]} /><meshStandardMaterial color="yellow" wireframe /></mesh>}>
          <CustomModel modelUrl="/models/props/Gold_Nugget_Large.gltf" />
        </React.Suspense>
      </group>

    </HoverableGroup>
  );
}

// --- [ Environment Component ] ---
function Environment() {
  const hRoads = [-CONFIG.LAYOUT.zSpread - 3, 0, CONFIG.LAYOUT.zSpread + 3];
  const vRoads = [
    -CONFIG.LAYOUT.xSpread - 3,
    -CONFIG.LAYOUT.xSpread + 2.5,
    CONFIG.LAYOUT.xSpread - 2.5,
    CONFIG.LAYOUT.xSpread + 3
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#f0ede8" />
      </mesh>
      {hRoads.map((z, i) => (
        <mesh key={`h-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[40, 1.2]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
      ))}
      {vRoads.map((x, i) => (
        <mesh key={`v-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[1.2, 20]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
      ))}
      {Array.from({ length: 41 }).map((_, i) => (
        <group key={i}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, -60 + i * 3]}>
            <planeGeometry args={[120, 0.02]} />
            <meshStandardMaterial color="#e5e2dd" transparent opacity={0.4} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-60 + i * 3, 0.005, 0]}>
            <planeGeometry args={[0.02, 120]} />
            <meshStandardMaterial color="#e5e2dd" transparent opacity={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --- [ Main Scene ] ---
const GameScene = () => {
  const { openBuildingPage } = useGame();

  const handleBuildingClick = (name: string) => {
    const pageName = buildingToPage[name];
    if (pageName) openBuildingPage(pageName);
  };

  return (
    <>
      <ambientLight intensity={0.6} color={0xffffff} />
      <directionalLight position={[20, 30, 20]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-10, 15, -10]} intensity={0.4} color={0xffffff} />

      <Environment />

      <Building
        position={[-CONFIG.LAYOUT.xSpread, 0, -CONFIG.LAYOUT.zSpread]}
        size={[2, 2, 2]}
        color="#b8c8b8"
        label="인력소"
        name="hr"
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("hr")}
      />
      <Building
        position={[0, 0, -CONFIG.LAYOUT.zSpread]}
        size={[2.5, 2.5, 2.5]}
        color="#d0d0d0"
        label="은행"
        name="bank"
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("bank")}
      />
      <Building
        position={[CONFIG.LAYOUT.xSpread, 0, -CONFIG.LAYOUT.zSpread]}
        size={[2.5, 1.2, 2]}
        color="#c8c0b8"
        label="창고"
        name="warehouse"
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("warehouse")}
      />
      <Building
        position={[-CONFIG.LAYOUT.xSpread, 0, CONFIG.LAYOUT.zSpread]}
        size={[2, 1.8, 2]}
        color="#c8b8c8"
        label="미니게임"
        name="minigame"
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("minigame")}
      />

      {/* ★ Factory는 이제 외부 클릭 핸들러를 받지 않고 내부에서 모달을 켭니다! 
          Suspense로 감싸서 로딩 중 크래시를 방지합니다.
      */}
      <React.Suspense fallback={null}>
        <Factory
          position={[0, 0, CONFIG.LAYOUT.zSpread]}
          scale={CONFIG.BUILDING_SCALE}
        />
      </React.Suspense>

      <Building
        position={[CONFIG.LAYOUT.xSpread, 0, CONFIG.LAYOUT.zSpread]}
        size={[2.5, 1.5, 2]}
        color="#d8d0c8"
        label="마켓"
        name="market"
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("market")}
      />
    </>
  );
};

export function IsometricScene() {
  const d = CONFIG.CAMERA.distance;
  const pAngle = CONFIG.CAMERA.polarAngle;
  const aAngle = CONFIG.CAMERA.azimuthAngle;

  const cx = d * Math.sin(pAngle) * Math.sin(aAngle);
  const cy = d * Math.cos(pAngle);
  const cz = d * Math.sin(pAngle) * Math.cos(aAngle);

  return (
    <div className="w-full h-full">
      <Canvas
        orthographic
        camera={{ position: [cx, cy, cz], zoom: CONFIG.CAMERA.initialZoom }}
        shadows
        gl={{ antialias: true, alpha: true }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color("#f5f3ef");
        }}
      >
        <GameScene />
        <WorldBounds />
        <MapControls
          makeDefault
          enableRotate={false}
          enableZoom={true}
          enablePan={true}
          minZoom={CONFIG.CAMERA.minZoom}
          maxZoom={CONFIG.CAMERA.maxZoom}
          maxPolarAngle={CONFIG.CAMERA.polarAngle}
          minPolarAngle={CONFIG.CAMERA.polarAngle}
          minAzimuthAngle={CONFIG.CAMERA.azimuthAngle}
          maxAzimuthAngle={CONFIG.CAMERA.azimuthAngle}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
          }}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/props/animated_conveyer_belt.glb');
useGLTF.preload('/models/characters/Barbarian.glb');
useGLTF.preload('/models/animations/Rig_Medium_Tools.glb');