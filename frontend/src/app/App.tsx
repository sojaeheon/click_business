import React, { useState, useCallback, useMemo, Suspense, lazy, useEffect } from "react";
import { IsometricScene } from "./components/game/IsometricScene";
import { GameHUD } from "./components/game/GameHUD";
import { ModalContainer } from "./components/modals/ModalContainer";
const BankPage = lazy(() => import("../pages/buildings/BankPage").then(module => ({ default: module.BankPage })));
const WarehousePage = lazy(() => import("../pages/buildings/WarehousePage").then(module => ({ default: module.WarehousePage })));
const HRPage = lazy(() => import("../pages/buildings/HRPage").then(module => ({ default: module.HRPage })));
const MinigamePage = lazy(() => import("../pages/buildings/MinigamePage").then(module => ({ default: module.MinigamePage })));
const MarketPage = lazy(() => import("../pages/buildings/MarketPage").then(module => ({ default: module.MarketPage })));
import { GameContext, defaultGameState } from "./store/gameStore";
import type { GameState, ModalTab, BuildingPage, GameContextType } from "./store/gameStore";
import { CompanyAPI } from "../api/gameApi";

export default function App() {
  const [state, setState] = useState<GameState>(defaultGameState);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await CompanyAPI.getStatus(1);
        if (response.data) {
          setState((prev) => ({
            ...prev,
            ...response.data
          }));
        }
      } catch (error) {
        console.error("Failed to load initial game status", error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    fetchStatus();
  }, []);

  const openModal = useCallback((tab: ModalTab) => {
    setState((prev) => ({ ...prev, activeModal: tab }));
  }, []);

  const closeModal = useCallback(() => {
    // 클릭(pointerup) 이벤트 처리가 브라우저에서 완전히 끝난 직후에 unmount되도록 0ms 지연
    setTimeout(() => {
      setState((prev) => ({ ...prev, activeModal: null }));
      // 모달 닫힌 후 canvas 포커스 복원 (포인터 이벤트 버그 방지)
      setTimeout(() => {
        const canvas = document.querySelector('canvas') as HTMLElement | null;
        canvas?.focus({ preventScroll: true });
      }, 100);
    }, 0);
  }, []);

  const switchTab = useCallback((tab: ModalTab) => {
    setState((prev) => ({ ...prev, activeModal: tab }));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.filter((n) => n.id !== id),
    }));
  }, []);

  const selectBuilding = useCallback((building: string | null) => {
    setState((prev) => ({ ...prev, selectedBuilding: building }));
  }, []);

  const openBuildingPage = useCallback((page: BuildingPage) => {
    setState((prev) => ({ ...prev, activeBuildingPage: page }));
  }, []);

  const closeBuildingPage = useCallback(() => {
    setTimeout(() => {
      setState((prev) => ({ ...prev, activeBuildingPage: null }));
      // 건물 페이지 닫힌 후 canvas 포커스 복원
      setTimeout(() => {
        const canvas = document.querySelector('canvas') as HTMLElement | null;
        canvas?.focus({ preventScroll: true });
      }, 100);
    }, 0);
  }, []);


  const contextValue: GameContextType = useMemo(
    () => ({
      state,
      setGameState: setState,
      openModal,
      closeModal,
      switchTab,
      dismissAlert,
      selectBuilding,
      openBuildingPage,
      closeBuildingPage,
    }),
    [state, openModal, closeModal, switchTab, dismissAlert, selectBuilding, openBuildingPage, closeBuildingPage]
  );

  const renderBuildingPage = () => {
    switch (state.activeBuildingPage) {
      case "bank":
        return <BankPage />;
      case "warehouse":
        return <WarehousePage />;
      case "hr":
        return <HRPage />;
      case "minigame":
        return <MinigamePage />;
      case "market":
        return <MarketPage />;
      default:
        return null;
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

  return (
    <GameContext.Provider value={contextValue}>
      <div className="w-screen h-screen overflow-hidden relative bg-gray-100">
        {/* 3D Game Scene Layer */}
        <div className="absolute inset-0">
          <IsometricScene />
        </div>

        {/* HUD Overlay Layer */}
        {!state.activeBuildingPage && <GameHUD />}

        {/* Modal Layer */}
        <ModalContainer />

        {/* Building Page Layer */}
        {state.activeBuildingPage && (
          <Suspense fallback={
            <div className="absolute inset-0 z-40 bg-gray-100/80 backdrop-blur-sm flex items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-gray-400 border-t-gray-800 rounded-full animate-spin"></div>
                <p className="mt-4 text-gray-700 font-bold tracking-wide">로딩 중...</p>
              </div>
            </div>
          }>
            {renderBuildingPage()}
          </Suspense>
        )}
      </div>
    </GameContext.Provider>
  );
}