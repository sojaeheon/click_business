# 프론트엔드 파일 구조 정리 및 역할 (Architecture)

## 디렉토리 구조 분석

### `src/api/`
- **[client.ts](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/api/client.ts)**: Axios 기반 HTTP 클라이언트 (토큰 인터셉터 포함)
- **[gameApi.ts](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/api/gameApi.ts)**: 서비스 전반에 사용되는 API 엔드포인트 세트 구현
- **`authApi.ts`**: 인증 및 유저 프로필 관리
- **(기타 api 모듈들)**: 역할별로 분리됨.

### `src/app/store/`
- **[gameStore.ts](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/store/gameStore.ts)**: Zustand를 이용해 게임 세션 전반의 상태(선택된 페이지, 모달 가시성 등) 관리

### `src/app/components/`
- **[game/](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/MinigamePage.tsx#7-291)**: 3D 씬과 건물(오브젝트) 컴포넌트
  - [IsometricScene.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/IsometricScene.tsx): 게임 메인 씬. (내부에서 Factory 등 각종 건물과 맵 로드)
  - [Factory.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/Factory.tsx) $\rightarrow$ **`Workstation.tsx`** 로 변경 필요: 생산 건물의 3D 오브젝트 및 다이얼로그 처리
  - [GameHUD.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/GameHUD.tsx): 메인 화면 오버레이 (자산 총액 표시, 환경설정/프로필 진입점)
  - [constants.ts](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/constants.ts): 게임 관련 상수 모음
- **`modals/`**: 앱 내 글로벌 팝업(Z-index 상위) 컴포넌트들
  - [RankingModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/RankingModal.tsx) (기존 Incentive): 유저 시가총액 기반 명예의 전당. 단순 CSS 개선 필요
  - [NewsDetailModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/NewsDetailModal.tsx) (기존 Politics 등 분산 구조 통합 요망)
  - [InventoryModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/InventoryModal.tsx): 인벤토리 관리. 단순 UI 개선 요망
  - [CompanyProfile.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/CompanyProfile.tsx), [NotificationModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/NotificationModal.tsx), [SettingsModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/SettingsModal.tsx) 등 목적별 모달
- **[ui/](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/store/gameStore.ts#5-6)**: shadcn/ui 기반의 재사용 가능한 UI 컴포넌트(버튼, 배지, 카드 등)

### `src/pages/`
- **[MainPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/MainPage.tsx)**: 게임 진입 및 Isometric 씬을 마운트하는 최상위 컨테이너
- **[LoginPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/LoginPage.tsx), [IndustrySelectionPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/IndustrySelectionPage.tsx)**: 권한 없는 유저용 인증 뷰
- **`buildings/`**: 3D 씬 내에서 건물 클릭 시 오버레이되는 전용 페이지들
  - [BankPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/BankPage.tsx): 중앙은행
  - [HRPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/HRPage.tsx): 인력소
  - [MarketPage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/MarketPage.tsx): 마켓
  - [WarehousePage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/WarehousePage.tsx): 창고
  - [MinigamePage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/MinigamePage.tsx): 광클 미니게임

---

## 🛠 리팩토링 및 구조 개선 대상

1. **명칭 및 API 동기화 (`factory` $\rightarrow$ `workstation`)**
   - [gameStore.ts](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/store/gameStore.ts): [BuildingPage](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/store/gameStore.ts#5-6) 타입 및 상태 변수명 (`factory` -> `workstation`)
   - [IsometricScene.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/IsometricScene.tsx): `Factory` 컴포넌트 임포트 및 렌더링을 `Workstation`으로 일괄 변경
   - [Factory.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/game/Factory.tsx) 파일명 $\rightarrow$ `Workstation.tsx` 로 변경 및 텍스트 수정
   - 기타 모달 아이콘 명칭 변경 (`lucide-react` 아이콘의 `Factory`는 에셋명으로 유지하되 도메인 관련 변수명 수정)

2. **단순 도형/와이어프레임 목적 UI 고도화**
   - **[RankingModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/RankingModal.tsx), [InventoryModal.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/app/components/modals/InventoryModal.tsx), [WarehousePage.tsx](file:///c:/Users/SSAFY/Desktop/workspace/frontend-2nd/S14P21B109/frontend/src/pages/buildings/WarehousePage.tsx)**: 와이어프레임 수준의 네모/단순 선으로 분할된 영역에 `lucide-react` 아이콘, `Tailwindcss` 그라데이션, `shadcn/ui`의 Card 등을 혼합 적용하여 웹 게임 퀄리티로 상향
   - **미니게임 성공/실패 팝업**: 투박한 테두리 등 세련되게 조정

3. **중복/미사용 구조 제거**
   - 뷰와 무관하게 흩어져 있거나 레거시로 남은 파일 추적 후 병합 (예: `politics`, `incentive` 흔적이 남아 있다면 완전히 `News/Ranking`으로 포워딩 후 관련 참조 끊기)
