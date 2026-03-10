import React, { useState, useCallback, useMemo } from "react";
import { IsometricScene } from "./components/game/IsometricScene";
import { GameHUD } from "./components/game/GameHUD";
import { ModalContainer } from "./components/modals/ModalContainer";
import { BankPage } from "../pages/buildings/BankPage";
import { WarehousePage } from "../pages/buildings/WarehousePage";
import { HRPage } from "../pages/buildings/HRPage";
import { GameContext, defaultGameState } from "./store/gameStore";
import type { GameState, ModalTab, BuildingPage, GameContextType } from "./store/gameStore";

export default function App() {
  const [state, setState] = useState<GameState>(defaultGameState);

  const openModal = useCallback((tab: ModalTab) => {
    setState((prev) => ({ ...prev, activeModal: tab }));
  }, []);

  const closeModal = useCallback(() => {
    setState((prev) => ({ ...prev, activeModal: null }));
    // 모달 닫힌 후 canvas 포커스 복원
    setTimeout(() => {
      const canvas = document.querySelector('canvas') as HTMLElement | null;
      canvas?.focus({ preventScroll: true });
    }, 80);
  }, []);

  const switchTab = useCallback((tab: ModalTab) => {
    setState((prev) => ({ ...prev, activeModal: tab }));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.filter((n) => n.id !== id),
    }));
  }, []);

  const selectBuilding = useCallback((building: string | null) => {
    setState((prev) => ({ ...prev, selectedBuilding: building }));
  }, []);

  const openBuildingPage = useCallback((page: BuildingPage) => {
    setState((prev) => ({ ...prev, activeBuildingPage: page }));
  }, []);

  const closeBuildingPage = useCallback(() => {
    setState((prev) => ({ ...prev, activeBuildingPage: null }));
    // 건물 페이지 닫힌 후 canvas 포커스 복원
    setTimeout(() => {
      const canvas = document.querySelector('canvas') as HTMLElement | null;
      canvas?.focus({ preventScroll: true });
    }, 80);
  }, []);


  const contextValue: GameContextType = useMemo(
    () => ({
      state,
      openModal,
      closeModal,
      switchTab,
      dismissNotification,
      selectBuilding,
      openBuildingPage,
      closeBuildingPage,
    }),
    [state, openModal, closeModal, switchTab, dismissNotification, selectBuilding, openBuildingPage, closeBuildingPage]
  );

  const renderBuildingPage = () => {
    switch (state.activeBuildingPage) {
      case "bank":
        return <BankPage />;
      case "warehouse":
        return <WarehousePage />;
      case "hr":
        return <HRPage />;
      case "factory":
      case "market":
      case "minigame":
        return (
          <div className="absolute inset-0 z-40 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl text-gray-600 mb-4">
                {state.activeBuildingPage === "factory" ? "공장" : state.activeBuildingPage === "market" ? "마켓" : "미니게임"}
              </p>
              <p className="text-gray-400 mb-6">준비 중입니다...</p>
              <button
                onClick={closeBuildingPage}
                className="px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors cursor-pointer"
              >
                돌아가기
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

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
        {renderBuildingPage()}
      </div>
    </GameContext.Provider>
  );
}