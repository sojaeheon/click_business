import React, { Suspense, lazy, useEffect, useState } from "react";
import { IsometricScene } from "./components/game/IsometricScene";
import { GameHUD } from "./components/game/GameHUD";
import { ModalContainer } from "./components/modals/ModalContainer";

// 건물 페이지들 (Lazy Loading 적용)
const BankPage = lazy(() => import("../pages/buildings/BankPage").then(module => ({ default: module.BankPage })));
const WarehousePage = lazy(() => import("../pages/buildings/WarehousePage").then(module => ({ default: module.WarehousePage })));
const HRPage = lazy(() => import("../pages/buildings/HRPage").then(module => ({ default: module.HRPage })));
const MinigamePage = lazy(() => import("../pages/buildings/MinigamePage").then(module => ({ default: module.MinigamePage })));
const MarketPage = lazy(() => import("../pages/buildings/MarketPage").then(module => ({ default: module.MarketPage })));

// ✨ 1. Zustand 스토어 올바른 경로로 불러오기
import { useGameStore } from "../store/gameStore";

export default function App() {
  // ✨ 2. Zustand 냉장고에서 필요한 상태만 꺼내기
  const activeBuildingPage = useGameStore(state => state.activeBuildingPage);
  const activeModal = useGameStore(state => state.activeModal);

  const fetchCompanyData = useGameStore(state => state.fetchCompanyData);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ──────────────────────────────────────────────────────────
  // 1. 초기 데이터 불러오기
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const initGame = async () => {
      try {
        await fetchCompanyData(1);
      } catch(error){
        console.error("Failed to load initial game status", error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    initGame();
  }, [fetchCompanyData]); // 의존성 배열에 추가

  // ──────────────────────────────────────────────────────────
  // 2. 창이 닫힐 때 3D 캔버스로 포커스 되돌려주기 (마우스 꼬임 방지 버그 픽스)
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeModal && !activeBuildingPage) {
      setTimeout(() => {
        const canvas = document.querySelector('canvas') as HTMLElement | null;
        canvas?.focus({ preventScroll: true });
      }, 100);
    }
  }, [activeModal, activeBuildingPage]);

  const renderBuildingPage = () => {
    switch (activeBuildingPage) {
      case "bank": return <BankPage />;
      case "warehouse": return <WarehousePage />;
      case "hr": return <HRPage />;
      case "minigame": return <MinigamePage />;
      case "market": return <MarketPage />;
      default: return null;
    }
  };

  if (isInitialLoad) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-100 relative">
        <div className="w-12 h-12 border-4 border-gray-400 border-t-gray-800 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-800 font-bold tracking-widest text-lg">회사 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  // ✨ 3. GameContext.Provider 같은 거추장스러운 태그가 전부 사라졌습니다!
  return (
    <div className="w-screen h-screen overflow-hidden relative bg-gray-100">
      
      {/* 1층: 3D Game Scene Layer */}
      <div className="absolute inset-0">
        <IsometricScene />
      </div>

      {/* 2층: HUD Overlay Layer (건물 안에 안 들어갔을 때만 보임) */}
      {!activeBuildingPage && <GameHUD />}

      {/* 3층: Modal Layer (알림창 등) */}
      <ModalContainer />

      {/* 4층: Building Page Layer (건물 입장 시 전체 화면 덮기) */}
      {activeBuildingPage && (
        <Suspense fallback={
          <div className="absolute inset-0 z-40 bg-gray-100/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-gray-400 border-t-gray-800 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-700 font-bold tracking-wide">로딩 중...</p>
            </div>
          </div>
        }>
          <div className="absolute inset-0 z-[100] bg-black bg-opacity-95 flex items-center justify-center">
            <div
              className="w-full h-full relative"
              style={{ transformOrigin: "center center", maxHeight: "100vh" }}
            >
              {renderBuildingPage()}
            </div>
          </div>
        </Suspense>
      )}
    </div>
  );
}