# 🧱 WebGL Isometric Game

Three.js + React Three Fiber 기반의 아이소메트릭 뷰 도시 시뮬레이션 게임 프런트엔드입니다.

---

## 🚀 실행 방법

```bash
npm i          # 의존성 설치
npm run dev    # 개발 서버 시작 (http://localhost:5173)
```

---

## 📁 주요 파일 구조

```
src/
└── app/
    └── components/
        ├── game/
        │   └── IsometricScene.tsx   # 메인 씬 (카메라, 건물, 캐릭터, 자동차)
        └── models/
            └── Animated_conveyer_belt.jsx  # 컨베이어 벨트 컴포넌트
public/
└── models/
    ├── characters/Barbarian.glb
    ├── animations/
    │   ├── Rig_Medium_Tools.glb         (29개: Chop, Pickaxing, Work_B 등)
    │   ├── Rig_Medium_MovementBasic.glb (11개: Walking_A/B/C, Running_A/B 등)
    │   ├── Rig_Medium_General.glb       (15개: Idle_A/B, Spawn_Ground 등)
    │   ├── Rig_Medium_CombatMelee.glb
    │   ├── Rig_Medium_CombatRanged.glb
    │   ├── Rig_Medium_MovementAdvanced.glb
    │   ├── Rig_Medium_Simulation.glb
    │   └── Rig_Medium_Special.glb
    ├── environments/  (건물, 도로, 소품)
    └── props/         (Gold_Bar, Gold_Bars_Stack 등)
```

---

## 📆 개발 일지 — 2026-03-09

### 🐛 해결된 이슈 & 버그

---

#### 1. 프로젝트 `frontend` 폴더 이동 후 전체 빌드 오류
- **문제**: 기존 파일들을 `frontend/` 폴더로 이동했더니 `BankPage`, `WarehousePage`, `HRPage` 등에서 `500 Internal Server Error` 발생
  ```
  [plugin:vite:import-analysis] Failed to resolve import "../../store/gameStore"
  from "src/pages/buildings/HRPage.tsx"
  ```
- **원인**: 폴더 이동 후 상대 경로(`../../store/gameStore`)가 깨짐
- **해결**: 폴더 구조 변경을 취소하고 원래 구조로 복원

---

#### 2. Worker 캐릭터 외형 소실 (애니메이션 모델이 외형을 덮어쓰는 문제)
- **문제**: `Rig_Medium_Tools.glb` 전체를 clone하여 사용하면 Tools 모델의 외형(Mesh)이 Barbarian 외형을 덮어쓰는 현상 발생 → 캐릭터가 Tools 모델 모습으로 바뀜
- **추가 문제**: `useGLTF`의 `scene.clone()` 사용 시 Bone 구조가 깨져 애니메이션이 멈추거나 모델이 원점(0,0,0)에 박히는 버그
- **해결**:
  - `Barbarian.glb`로 외형(SkinnedMesh)만 `SkeletonUtils.clone()` 복제
  - `Rig_Medium_Tools.glb`에서 **AnimationClip만 추출**하여 Barbarian 복제본의 mixer에 연결 (리타겟팅)
  - `SkeletonUtils.clone(barbarianScene)` → `useAnimations(retargetedClips, groupRef)` 패턴 사용

---

#### 3. Worker 캐릭터 크기가 너무 작아짐
- **문제**: 수정 과정에서 Worker scale이 의도치 않게 줄어든 상태로 방치됨
- **해결**: `WORKER_S * 1.5` scale로 원래 크기 복원

---

#### 4. Worker 캐릭터 애니메이션 없이 둥둥 떠다니는 현상
- **원인**: `Rig_Medium_Tools.glb`에 없는 애니메이션 이름으로 액션을 찾으려 해서 아무것도 재생되지 않은 채 T-Pose로 공중에 떠 있는 상태
- **해결**: 실제 GLB 파일의 애니메이션 이름 목록을 바이너리 파싱으로 직접 확인 후 정확한 이름 사용

---

#### 5. 건물 클릭 — Hover Timer 방식 → Click 직접 방식으로 변경
- **문제**: 건물 위에 마우스를 올려두고 일정 시간 대기해야 모달이 뜨는 불편한 UX
- **해결**:
  - Hover timer 완전 제거
  - Canvas 밖 DOM 오버레이로 `GlobalDialog` 컴포넌트 구성
  - 건물 클릭 시 즉시 확인 다이얼로그(「[인력소]으로 이동하시겠습니까?」) 표시

---

#### 6. 건물 이동 모달 — 버튼 텍스트 렌더링 이슈
- **문제**: `이-동`, `취-소`처럼 하이픈이 들어간 텍스트가 표시됨 (글리치 방지를 위해 임시로 넣었다가 실수로 남겨진 것)
- **해결**: `이동`, `취소`로 정상 텍스트 복원

---

#### 7. 건물 이동 모달 폰트 불일치
- **문제**: 작업장(Factory) 모달은 `KerisKeduR` 폰트가 정상 적용됐지만, 나머지 건물 이동 확인 다이얼로그는 `KerisKeduLine`으로 달랐음
- **해결**: `GlobalDialog` 컴포넌트의 `style={R}` (`fontFamily: 'KerisKeduR'`)을 모든 다이얼로그 타입에 통일 적용. 작업장 모달 디자인 기준으로 전체 통일

---

#### 8. 모달 바깥 클릭 시 닫히지 않음
- **문제**: 모달을 끄려면 반드시 닫기 버튼을 눌러야 함
- **해결**: 배경(backdrop) div에 `onClick={onClose}`, 모달 본체 div에 `onClick={(e) => e.stopPropagation()}` 추가

---

#### 9. 자동차 충돌 & 바닥 박힘
- **문제 1**: 5대 차량 경로가 교차로에서 겹쳐 차끼리 충돌
- **문제 2**: 차량 Y=0.15로 설정되어 차체 절반이 바닥에 묻혀 보임
- **해결**:
  - `LANE_OFFSET = 1.2` 도입 → 도로 중앙선 기준으로 차선을 좌우로 명확히 분리
  - 각 차량 경로를 교차로에서 겹치지 않는 복합 루프로 재설계 (단순 왕복 → L자, Z자, 8자 루프 등)
  - 차량 Y축 `0.15` → `0.65` 상향

---

#### 10. 걷기 애니메이션 — 이동 속도 대비 모션이 너무 느림 (좀비 같은 걸음)
- **문제**: `Walking_A` 재생 시 발동작 주기가 실제 이동 속도보다 훨씬 느려 "강시(좀비) 걷기"처럼 보임
- **해결**:
  - 걷기 애니메이션을 `Walking_A` → `Running_A`로 변경
  - `setEffectiveTimeScale(1.5)` 적용으로 발동작 1.5배 빠르게
  - 이동 속도도 `8` → `10`으로 상향하여 시각적 일치감 향상

---

#### 11. 컨베이어 벨트 아이템 대체(itemUrl) 기능 동작 안 함
- **문제**: `itemUrl="/models/props/Gold_Nugget_Large.gltf"` prop을 전달해도 벨트 위 큐브가 변경되지 않음. 심지어 큐브 자체도 사라지고 애니메이션도 멈추는 현상 발생
- **원인**: `BeltItem` 컴포넌트 내부에서 `useGLTF`를 조건부 호출(React Hooks 규칙 위반), 기존 JSX 노드 구조 (`Cube003`~`Cube010`)와의 불일치
- **해결**: `BeltItem`/`itemUrl` 관련 코드를 전부 제거하고, **원본 gltfjsx 구조로 완전 복구**. 이후 큐브 메쉬 정상 렌더링 및 컨베이어 애니메이션 정상 작동 확인

---

#### 12. 금괴 스택 — 최대 단계 이후 작업 애니메이션 재생 안 됨
- **원인**: 내부의 `stackLevel` state가 최대값에 도달하면 더 이상 변경이 없으므로 `isWorking=true`여도 관련 `useEffect`가 재실행되지 않아 애니메이션이 멈춤
- **해결**: 금괴 누적 카운트(`totalGold`)와 쌓기 단계 계산을 분리. `MAX_TOTAL = 12`(3더미×4단계) 이후에도 컨베이어 및 금괴 비행 애니메이션은 계속 유지

---

#### 13. 금괴 더미 — 바닥에 박혀 보임
- **문제**: 금괴 스택 모델의 Y 위치가 `0`이라 바닥과 겹쳐 반쯤 파묻혀 보임
- **해결**: 더미 위치 Y값을 `0` → `0.3`으로 상향

---

#### 14. 작업 애니메이션 선택 개선
- **문제**: `Pickaxing` 애니메이션보다 더 자연스러운 작업 모션이 있었으나 미사용
- **해결**: 작업 중 애니메이션을 `Work_B` 최우선 사용으로 변경 (`Work_B` → `Work_A` → `Pickaxing` 순 폴백)

---

### ✨ 신규 기능

#### 🎮 WASD 플레이어 캐릭터

- `PlayerCharacter` 컴포넌트 신규 추가
- **이동**: W/A/S/D 키보드 입력, 아이소메트릭 카메라 방향(45도) 반영
- **애니메이션 상태 머신**:

  | 상태 | 조건 | 사용 애니메이션 | 파일 |
  |------|------|----------------|------|
  | `spawning` | 최초 마운트 | `Spawn_Ground` (1회) | General |
  | `idle` | 정지 상태 | `Idle_A` | General |
  | `walking` | WASD 이동 중 | `Running_A` (1.5x 속도) | MovementBasic |
  | `working` | 작업장 영역 안 + 가동 중 | `Work_B` | Tools |

- **영역 감지**:
  - 건물 영역(인력소/은행/창고/마켓/미니게임) 진입 시 이동 확인 모달 자동 표시
  - 작업장 영역 + 가동 중 → 자동으로 `working` 모드 전환
- **모달 중 이동 잠금**: 다이얼로그 오픈 시 `isPaused=true` 전달 → 이동 불가

#### 🏭 작업장 — 금괴 쌓기 & 비행 애니메이션

- 작업 시작 시 3초마다 컨베이어 끝에서 **금괴가 포물선으로 날아가** 지정 더미에 쌓임
- 3개 더미 위치에 순차 누적, 각 더미별 4단계 성장:
  `Gold_Bars` → `Gold_Bars_Stack_Small` → `Gold_Bars_Stack_Medium` → `Gold_Bars_Stack_Large`
- 최대 12개(더미 3×4단계) 이후에도 금괴 비행 효과는 계속 유지

#### 🎬 애니메이션 디버그 드롭다운 패널

- 우측 상단 `🎬 애니메이션 테스트` 패널 추가
- 탑재된 전체 애니메이션 목록을 드롭다운으로 선택하여 캐릭터에 즉시 재생
- GLB 파일 3개 합산 56개 애니메이션 지원
- `자동 (WASD 모드)` 선택 시 상태머신 모드로 복귀

---

### 🔧 주요 리팩토링 요약

| 항목 | 변경 전 | 변경 후 |
|------|--------|--------|
| Worker 외형 | Tools 모델 전체 클론 (외형 덮어씌워짐) | Barbarian 외형 + Tools 애니메이션 리타겟팅 분리 |
| Worker 애니메이션 | 없음 / T-Pose 떠다님 | `Spawn_Ground → Idle_A → Running_A → Work_B` 상태머신 |
| 건물 클릭 UX | Hover 일정시간 대기 후 모달 | 즉시 클릭 → 모달 |
| 모달 폰트 | 작업장만 KerisKeduR, 나머지 KerisKeduLine | 전체 KerisKeduR 통일 |
| 모달 닫기 | 닫기 버튼만 가능 | 배경 클릭으로도 닫기 |
| 차량 경로 | 단순 직선/왕복 (충돌 발생) | 차선 분리(LANE_OFFSET) + 복합 루프 |
| 차량 Y축 | 0.15 (바닥 박힘) | 0.65 |
| 컨베이어 벨트 | itemUrl/BeltItem 코드 (동작 안 함) | 원본 gltfjsx 구조 복원 |
| 작업 중 애니메이션 | Pickaxing | Work_B 최우선 |

---

## ⚠️ 미해결 이슈 / 향후 개선 예정

- **컨베이어 벨트 위 아이템 교체**: `itemUrl` prop으로 큐브를 Gold Nugget 등으로 교체하는 기능이 React Hooks 규칙 문제로 안정적 구현 어려움 → 블렌더에서 GLB 파일 자체를 수정하는 방식 검토 필요
- **Pickaxe 모델 색상 적용 안 됨**: `/models/environments/minecraft_pickaxe.gltf` 모델에 색상(Material)이 입혀지지 않는 문제 미해결

---

## 🎯 현재 상태 (2026-03-09 기준)

- [x] 아이소메트릭 맵 렌더링
- [x] 건물 5종 클릭 이동 모달 (즉시 클릭, KerisKeduR 폰트, 배경 클릭 닫기)
- [x] 작업장: 컨베이어 벨트 가동 / 금괴 3더미 순차 쌓기 시스템
- [x] 자동차 5대 독립 차선 경로 주행 (충돌 방지, Y축 정상)
- [x] WASD 플레이어 캐릭터 (Barbarian 외형, 4단계 애니메이션 상태머신)
- [x] 캐릭터 영역 감지 → 건물 모달 자동 표시 / 작업장 애니메이션 전환
- [x] 모달 오픈 시 캐릭터 이동 잠금
- [x] 페이지 새로고침 시 Spawn_Ground 애니메이션 재생
- [x] 애니메이션 디버그 드롭다운 패널 (56개)
- [ ] 컨베이어 벨트 위 아이템 교체 (차후 개선)
- [ ] Pickaxe 모델 색상 적용 (미해결)