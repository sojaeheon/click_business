import React, { Suspense, lazy, useEffect, useState } from "react";
import { IsometricScene } from "./components/game/IsometricScene";
import { GameHUD } from "./components/game/GameHUD";
import { ModalContainer } from "./components/modals/ModalContainer";
import { ControlGuideModal } from "./components/modals/ControlGuideModal";
import { ErrorBoundary } from "./components/ErrorBoundary";

// 건물 페이지들 (Lazy Loading 적용)
const BankPage = lazy(() => import("../pages/buildings/BankPage").then(module => ({ default: module.BankPage })));
const WarehousePage = lazy(() => import("../pages/buildings/WarehousePage").then(module => ({ default: module.WarehousePage })));
const HRPage = lazy(() => import("../pages/buildings/HRPage").then(module => ({ default: module.HRPage })));
const MinigamePage = lazy(() => import("../pages/buildings/MinigamePage").then(module => ({ default: module.MinigamePage })));
const MarketPage = lazy(() => import("../pages/buildings/MarketPage").then(module => ({ default: module.MarketPage })));

import { useGameStore } from "../store/gameStore";
import { useAlertStore } from "../store/useAlertStore";

export default function App() {
  const activeBuildingPage = useGameStore(state => state.activeBuildingPage);
  const activeModal = useGameStore(state => state.activeModal);
  const fetchCompanyData = useGameStore(state => state.fetchCompanyData);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // ─── 조작 가이드 모달 상태 (App 레벨에서 관리 → pointer-events 문제 해결) ───
  const [showGuide, setShowGuide] = useState(false);
  const [autoGuide, setAutoGuide] = useState(() => !localStorage.getItem("hideControlGuide"));

  // ──────────────────────────────────────────────────────────
  // 1. 초기 데이터 불러오기
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const initGame = async () => {
      try {
        // App.tsx 마운트 시, 게스트 모드 진입 직후의 캐시 삭제를 지키기 위해 강제 fetch전에 토큰 유무를 검사
        const token = localStorage.getItem('accessToken');
        if (token) {
          // 회사 데이터 불러오기 요청
          await fetchCompanyData(1);
        }
      } catch (error) {
        console.error("Failed to load initial game status", error);
      } finally {
        setIsInitialLoad(false);
      }
    };
    initGame();
  }, [fetchCompanyData]);

  // ──────────────────────────────────────────────────────────
  // 2. 창이 닫힐 때 3D 캔버스로 포커스 되돌려주기
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeModal && !activeBuildingPage) {
      setTimeout(() => {
        const canvas = document.querySelector('canvas') as HTMLElement | null;
        canvas?.focus({ preventScroll: true });
      }, 100);
    }
  }, [activeModal, activeBuildingPage]);

  // ──────────────────────────────────────────────────────────
  // 3. ESC 단축키 모달 및 페이지 닫기
  // ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 1. Alert (제일 최상위) 닫기
        const alertState = useAlertStore.getState();
        if (alertState.isOpen) {
          alertState.closeAlert();
          return;
        }

        // 2. 조작 가이드 모달 닫기
        setShowGuide(false);
        setAutoGuide(false);

        // 3. 메인 HUD 모달 & 건물 상세 페이지 닫기
        const state = useGameStore.getState();
        if (state.activeModal) {
          state.closeModal();
        } else if (state.activeBuildingPage) {
          state.closeBuildingPage();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-gray-100">

      {/* 1층: 3D Game Scene Layer */}
      <div className="absolute inset-0">
        <ErrorBoundary>
          <IsometricScene />
        </ErrorBoundary>
      </div>

      {/* 2층: HUD Overlay Layer */}
      {!activeBuildingPage && <GameHUD onOpenGuide={() => setShowGuide(true)} />}

      {/* 3층: Modal Layer */}
      <ModalContainer />

      {/* 4층: Building Page Layer */}
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

      {/* ✅ 조작 가이드 모달 — App 최상위에서 렌더 (pointer-events-none 영향 없음) */}
      <ControlGuideModal
        forceOpen={showGuide || autoGuide}
        onForceClose={() => { setShowGuide(false); setAutoGuide(false); }}
      />
    </div>
  );
}