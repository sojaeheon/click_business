/// <reference types="@react-three/fiber" />
import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MapControls, Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "../../store/gameStore";
import type { BuildingPage } from "../../store/gameStore";

// ==========================================
// ⚙️ [게임 설정 및 커스텀 (Configuration)] ⚙️
// ------------------------------------------
// ※ 거리/크기 단위 설명: 
//   - 모든 숫자는 '블록(Grid) 1칸'을 1단위로 합니다.
//   - 숫자가 5라면 블록 5칸만큼의 길이나 거리를 의미합니다.
// ==========================================
export const CONFIG = {
  // 1. 화면(카메라) 각도 및 줌 설정
  CAMERA: {
    polarAngle: Math.PI / 3,     // [수직 각도] 위아래 회전각 (고정값)
    azimuthAngle: Math.PI / 4,   // [수평 각도] 좌우 회전각 (고정값)
    initialZoom: 100,             // [기본 확대수준] 숫자가 클수록 가깝게 보입니다.
    distance: 60,                // [가상 거리] 건물을 바라보는 시점의 깊이감
    minZoom: 100,                 // [축소 금지] initialZoom과 동일하게 설정하여 더 멀어지는 것을 막았습니다.
    maxZoom: 180,                // [확대 허용] 숫자를 높여서 더 가까이 볼 수 있게 했습니다.
    boundLimit: 3,               // [이동 반경] 중심(0,0)에서 블록 8칸 이상 못 벗어나게 제한 (약 20% 수준)
  },

  // 2. 건물 배치 간격 (Layout)
  LAYOUT: {
    xSpread: 5,   // 좌우 행 건물들이 중심에서 떨어진 거리 (블록 5칸)
    zSpread: 3,   // 상하 열 건물들이 중심에서 떨어진 거리 (블록 3칸)
  },

  // 3. 건물 기본 크기 (Scale)
  // 1.0 이면 원래 크기(박스 크기), 0.7 이면 70% 크기입니다.
  BUILDING_SCALE: 0.7,
};
// ==========================================

const buildingToPage: Record<string, BuildingPage> = {
  hr: "hr",
  bank: "bank",
  warehouse: "warehouse",
  minigame: "minigame",
  factory: "factory",
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
        // 컨트롤 업데이트를 호출하여 변경사항을 즉시 반영합니다.
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
// 외부 분리된 GLTF/GLB 파일을 불러오기 위한 컴포넌트입니다.
// public 폴더 밑에 있는 모델 파일 경로를 modelUrl 로 전달하면 됩니다. (예: modelUrl="/models/bank.glb")
function CustomModel({ modelUrl }: { modelUrl: string }) {
  const { scene } = useGLTF(modelUrl);
  // 그림자 적용을 위해 모델 안의 모든 mesh에 castShadow/receiveShadow 부여
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

// --- [ Building Component ] ---
function Building({ position, size, color, label, name, onClick, scale = CONFIG.BUILDING_SCALE, modelUrl }: any) {
  const [w, h, d] = size;

  const windows = useMemo(() => {
    const list = [];
    for (let row = 0; row < Math.floor(h / 0.6); row++) {
      for (let col = 0; col < Math.floor(w / 0.8); col++) {
        list.push(
          <mesh
            key={`${row}-${col}`}
            position={[-w / 2 + 0.5 + col * 0.7, 0.5 + row * 0.6, d / 2 + 0.01]}
          >
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
      {/* 
        ★ GLTF 커스텀 모델 적용 방법 ★
        만약 modelUrl이 프롭스로 전달되었다면(예: modelUrl="/models/my_building.gltf"),
        기본 박스 형태(Mockup)를 렌더링하지 않고 해당 3D 파일을 렌더링하도록 분기합니다.
      */}
      {modelUrl ? (
        <React.Suspense fallback={
          <mesh>
            <boxGeometry args={size} />
            <meshStandardMaterial color={color} wireframe />
          </mesh>
        }>
          <CustomModel modelUrl={modelUrl} />
        </React.Suspense>
      ) : (
        // [기본 Mockup 박스형 건물]
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

      {/* 라벨 텍스트 */}
      <Text
        position={[0, modelUrl ? 3.0 : h + 1.2, 0]} // 모델 로드시 텍스트 높이
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

// pre-load 처리 (선택사항)
// useGLTF.preload("/models/my_building.gltf");

// --- [ Factory Component ] ---
function Factory({ position, onClick, scale = CONFIG.BUILDING_SCALE }: any) {
  const gearRef = useRef<THREE.Mesh>(null);
  const smokeRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    if (gearRef.current) gearRef.current.rotation.z += 0.01;
    smokeRefs.current.forEach((smoke, i) => {
      if (smoke) {
        const baseY = 2.8 + i * 0.4;
        const speed = 0.3 + (i % 2) * 0.2;
        smoke.position.y = baseY + Math.sin(elapsed * speed + (i * 0.5)) * 0.3;
        const mat = smoke.material as THREE.MeshStandardMaterial;
        if (mat) mat.opacity = 0.3 + Math.sin(elapsed * 0.5) * 0.15;
      }
    });
  });

  return (
    <HoverableGroup position={position} scale={scale} onClick={onClick} originalColor="#c8c8c8">
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.1, 3.6]} />
        <meshStandardMaterial color="#e0e0e0" />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow userData={{ isBody: true }}>
        <boxGeometry args={[3, 1.5, 3]} />
        <meshStandardMaterial color="#c8c8c8" metalness={0.2} roughness={0.7} />
      </mesh>
      <mesh position={[-0.8, 2, -0.5]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 1.5, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <mesh position={[-0.3, 1.85, -0.5]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, 1.2, 8]} />
        <meshStandardMaterial color="#777" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el: any) => { smokeRefs.current[i] = el; }}
          position={[-0.8, 2.8 + i * 0.4, -0.5]}
        >
          <sphereGeometry args={[0.15 + i * 0.08, 8, 8]} />
          <meshStandardMaterial color="#ddd" transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh ref={gearRef} position={[0.5, 1.8, 1.51]} castShadow>
        <torusGeometry args={[0.3, 0.08, 8, 6]} />
        <meshStandardMaterial color="#666" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.3, 1.8]} receiveShadow>
        <boxGeometry args={[1.5, 0.15, 0.6]} />
        <meshStandardMaterial color="#777" />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.4 + i * 0.4, 0.5, 1.8]} castShadow>
          <boxGeometry args={[0.25, 0.15, 0.15]} />
          <meshStandardMaterial color="#DAA520" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      <Text
        position={[0, 2.8, 0]}
        fontSize={0.5}
        color="#333"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#fff"
      >
        공장
      </Text>
    </HoverableGroup>
  );
}

// --- [ Environment Component ] ---
function Environment() {
  // 도로 배치를 위한 기준값 계산 (CONFIG.LAYOUT 기준)
  const hRoads = [-CONFIG.LAYOUT.zSpread - 3, 0, CONFIG.LAYOUT.zSpread + 3]; // 가로 길 3개
  const vRoads = [
    -CONFIG.LAYOUT.xSpread - 3,
    -CONFIG.LAYOUT.xSpread + 2.5,
    CONFIG.LAYOUT.xSpread - 2.5,
    CONFIG.LAYOUT.xSpread + 3
  ]; // 세로 길 4개

  return (
    <group>
      {/* 바닥 전체 판 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#f0ede8" />
      </mesh>

      {/* 가로 도로 3개 (3x2 그리드용) */}
      {hRoads.map((z, i) => (
        <mesh key={`h-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, z]}>
          <planeGeometry args={[40, 1.2]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
      ))}

      {/* 세로 도로 4개 (3x2 그리드용) */}
      {vRoads.map((x, i) => (
        <mesh key={`v-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}>
          <planeGeometry args={[1.2, 20]} />
          <meshStandardMaterial color="#d4d4d4" />
        </mesh>
      ))}

      {/* 배경 가이드 그리드 (얇은 선) */}
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

      {/* 건물 배치를 CONFIG 파일의 변수로 연동했습니다. */}
      {/* 
        ★ GLTF 모델 적용 예시 ★ 
        <Building ... modelUrl="/models/bank.glb" /> 형태로 속성을 추가하세요! 
      */}
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
      <Factory
        position={[0, 0, CONFIG.LAYOUT.zSpread]}
        scale={CONFIG.BUILDING_SCALE}
        onClick={() => handleBuildingClick("factory")}
      />
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
  // CONFIG에서 설정한 각도를 카메라의 위치로 계산하기 (구면 좌표계 -> 데카르트 좌표계)
  // 좌우 회전, 위아래 회전을 모두 반영하여 카메라가 어디서 시작할지 정해줍니다.
  const d = CONFIG.CAMERA.distance;
  const pAngle = CONFIG.CAMERA.polarAngle;
  const aAngle = CONFIG.CAMERA.azimuthAngle;

  // 구면 좌표계를 이용한 3D x, y, z 변환 공식
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
          makeDefault // useThree().controls 에서 이 컨트롤을 참조할 수 있게 합니다.
          enableRotate={false}
          enableZoom={true}
          enablePan={true}
          minZoom={CONFIG.CAMERA.minZoom}
          maxZoom={CONFIG.CAMERA.maxZoom}
          // 변수 하나로 통일되도록 적용 (min과 max를 같게 두면 유저가 회전시킬 때 각도가 고정됨)
          maxPolarAngle={CONFIG.CAMERA.polarAngle}
          minPolarAngle={CONFIG.CAMERA.polarAngle}
          // 좌우 각도 마저도 고정하기 위해서 Azimuth Angle도 고정을 겁니다.
          minAzimuthAngle={CONFIG.CAMERA.azimuthAngle}
          maxAzimuthAngle={CONFIG.CAMERA.azimuthAngle}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            // RIGHT 버튼은 비활성화하려면 기본적으로 속성을 제공하지 않거나,
            // 별도로 THREE.MOUSE 기본 내장 상수를 할당합니다.
          }}
        />
      </Canvas>
    </div>
  );
}
