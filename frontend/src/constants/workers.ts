// ─────────────────────────────────────────────────────────────────
// 📋 캐릭터(일꾼) 공통 정의 파일
// 인벤토리 모달, 인력소, 작업장 모달에서 모두 이 파일을 참조합니다.
// ─────────────────────────────────────────────────────────────────

export type WorkerClass =
  | "수습_광부"
  | "숙련_광부"
  | "초보_제련공"
  | "숙련_제련공"
  | "견습_대장장이"
  | "숙련_대장장이";

export interface WorkerDefinition {
  id: string;         // 고유 식별자 (백엔드 itemName과 매칭)
  displayName: string; // 화면에 표시될 이름
  icon: string;        // 이모지 아이콘
  modelPath: string;   // 3D 모델 경로
  type: "miner" | "smelter" | "manufacturer"; // 담당 산업군
  // ─── 산업별 생산속도 보정 배율 (임시값, 추후 서버 데이터로 대체) ───
  speedMultiplier: {
    "금광업": number;
    "금 제련업": number;
    "제조업": number;
  };
}

export const WORKER_DEFINITIONS: WorkerDefinition[] = [
  {
    id: "수습_광부",
    displayName: "수습 광부",
    icon: "⛏️",
    modelPath: "/models/characters/Barbarian.glb",
    type: "miner",
    speedMultiplier: { "금광업": 1.0, "금 제련업": 0.7, "제조업": 0.5 },
  },
  {
    id: "숙련_광부",
    displayName: "숙련 광부",
    icon: "⛏️",
    modelPath: "/models/characters/Barbarian.glb",
    type: "miner",
    speedMultiplier: { "금광업": 1.5, "금 제련업": 1.0, "제조업": 0.75 },
  },
  {
    id: "초보_제련공",
    displayName: "초보 제련공",
    icon: "🔥",
    modelPath: "/models/characters/Knight.glb",
    type: "smelter",
    speedMultiplier: { "금광업": 0.7, "금 제련업": 1.0, "제조업": 0.7 },
  },
  {
    id: "숙련_제련공",
    displayName: "숙련 제련공",
    icon: "🔥",
    modelPath: "/models/characters/Knight.glb",
    type: "smelter",
    speedMultiplier: { "금광업": 0.9, "금 제련업": 1.5, "제조업": 1.0 },
  },
  {
    id: "견습_대장장이",
    displayName: "견습 대장장이",
    icon: "🔨",
    modelPath: "/models/characters/Mage.glb",
    type: "manufacturer",
    speedMultiplier: { "금광업": 0.5, "금 제련업": 0.7, "제조업": 1.0 },
  },
  {
    id: "숙련_대장장이",
    displayName: "숙련 대장장이",
    icon: "🔨",
    modelPath: "/models/characters/Mage.glb",
    type: "manufacturer",
    speedMultiplier: { "금광업": 0.75, "금 제련업": 1.0, "제조업": 1.5 },
  },
];

// Mock 인벤토리 데이터에서 캐릭터 이름으로 정의를 찾아주는 헬퍼
export function getWorkerDef(nameOrId: string): WorkerDefinition {
  const found = WORKER_DEFINITIONS.find(
    (w) => w.id === nameOrId || w.displayName === nameOrId ||
      nameOrId.includes(w.displayName) || nameOrId.includes(w.id.replace("_", " "))
  );
  return found ?? WORKER_DEFINITIONS[0];
}

// 산업별 기본 생산 비율
// 수량 1단위 = 1분(60초) 동안 아래 개수 그대로 생산
export const INDUSTRY_PRODUCTION = {
  "금광업":    { reqMat: 2,  resProd: 40, durationMs: 60000 },
  "금 제련업": { reqMat: 12, resProd: 6,  durationMs: 60000 },
  "제조업":    { reqMat: 20, resProd: 2,  durationMs: 60000 },
} as const;

export type IndustryKey = keyof typeof INDUSTRY_PRODUCTION;
