import { useGLTF } from "@react-three/drei";
import { M } from "./constants";

export const PRELOAD_MODEL_URLS: string[] = [
  // ── 환경/건물 (필수) ──
  M.base, M.bank, M.hr, M.market, M.warehouse,
  M.roadStraight, M.roadCornerCurved,
  M.roadJunction, M.roadTsplit,
  // ── 차/소품 ──
  M.carHatchback, M.carSedan, M.carPolice,
  M.ocean,
  // ── 캐릭터 + 애니메이션 ──
  "/models/characters/Barbarian.glb",
  "/models/animations/Rig_Medium_Tools.glb",
  "/models/animations/Rig_Medium_MovementBasic.glb",
  "/models/animations/Rig_Medium_General.glb",
  // ── 금 제련업 (콘베이어) ──
  "/models/props/animated_conveyer_belt.glb",
  "/models/props/Gold_Bar.gltf",
  "/models/props/Gold_Bars_Stack_Small.gltf",
  "/models/props/Gold_Bars_Stack_Medium.gltf",
  "/models/props/Gold_Bars_Stack_Large.gltf",
  // ── 금광업 ──
  "/models/props/rock.glb",
  "/models/props/Gold_Nuggets.gltf",
  "/models/props/Gold_Nugget_Medium.gltf",
  // ── 제조업 ──
  "/models/props/machine1.glb",
  "/models/props/drill.glb",
  "/models/props/toolbox.glb",
];

let isPreloaded = false;

/** 로그인/산업선택 화면에서 미리 호출함으로써 맞 화면 진입 전 워밍업 */
export function preloadGameModels() {
  if (isPreloaded) return;
  
  // setTimeout을 통해 메인 스레드 렌더링 블로킹을 살짝 피합니다. (requestIdleCallback 대용)
  setTimeout(() => {
    PRELOAD_MODEL_URLS.forEach(url => useGLTF.preload(url));
  }, 100);
  
  isPreloaded = true;
}
