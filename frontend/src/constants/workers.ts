// ─────────────────────────────────────────────────────────────────
// 📋 캐릭터(일꾼) 공통 정의 파일
// 인벤토리 모달, 인력소, 작업장 모달에서 모두 이 파일을 참조합니다.
// ─────────────────────────────────────────────────────────────────

// 레벨 → 공식 단계명 매핑
export const WORKER_LEVEL_NAMES: Record<number, string> = {
  1: "초보",
  2: "견습",
  3: "숙련",
  4: "마스터",
  5: "에픽",
  6: "레전드",
};

// 레벨 → 3D 모델 경로 매핑 (6종 모두 활용)
// public/models/characters 에 있는 6개 파일 사용
export const WORKER_LEVEL_MODELS: Record<number, string> = {
  1: "/models/characters/Barbarian.glb",
  2: "/models/characters/Knight.glb",
  3: "/models/characters/Rogue.glb",
  4: "/models/characters/Rogue_Hooded.glb",
  5: "/models/characters/Ranger.glb",
  6: "/models/characters/Mage.glb",
};

// 레벨 → 아이콘 (이모지 레거시, 하위호환용)
export const WORKER_LEVEL_ICONS: Record<number, string> = {
  1: "⛏️",
  2: "🔥",
  3: "🔨",
  4: "🏹",
  5: "🗡️",
  6: "👑",
};

// 레벨 → 캐릭터 이미지 경로 (public/images/character/)
export const WORKER_LEVEL_IMAGES: Record<number, string> = {
  1: "/images/character/Barbarian.png",
  2: "/images/character/Knight.png",
  3: "/images/character/Rogue.png",
  4: "/images/character/Rogue_Hooded.png",
  5: "/images/character/Ranger.png",
  6: "/images/character/Mage.png",
};

// 산업별 재료/생산품 이미지 경로 (public/images/props/)
export const PROPS_IMAGES = {
  nugget: "/images/props/nugget.png",   // 금광석 (금광업 재료)
  goldbar: "/images/props/goldbar.png", // 금괴 (금제련업 재료/금광업 생산)
  drill: "/images/props/drill.png",     // 광산드릴 (제조업 생산)
} as const;

// 아이템 이름 → 이미지 경로
export function getPropsImage(itemName: string): string | null {
  if (itemName.includes("광산 드릴") || itemName.includes("드릴")) return PROPS_IMAGES.drill;
  if (itemName.includes("금광석") || itemName.includes("원자재")) return PROPS_IMAGES.nugget;
  if (itemName.includes("금괴") || itemName.includes("생산품")) return PROPS_IMAGES.goldbar;
  return null;
}

export type WorkerClass =
  | "worker_lv1"
  | "worker_lv2"
  | "worker_lv3"
  | "worker_lv4"
  | "worker_lv5"
  | "worker_lv6";

export interface WorkerDefinition {
  id: WorkerClass;
  level: number;
  /** 화면 표시 이름: 단계명 + 업종 접미사 (없으면 단계명만) */
  displayName: string;
  icon: string;
  modelPath: string;
  /** 산업별 생산속도 배율
   * ⚠️ 백엔드 API /v1/workers/{workerType}/speedMultiplier 응답으로 대체 예정
   *    없으면 아래 프론트 default 값 사용 */
  speedMultiplier: {
    "금광업": number;
    "금 제련업": number;
    "제조업": number;
  };
}

export const WORKER_DEFINITIONS: WorkerDefinition[] = [
  {
    id: "worker_lv1",
    level: 1,
    displayName: "초보 일꾼",
    icon: WORKER_LEVEL_ICONS[1],
    modelPath: WORKER_LEVEL_MODELS[1],
    speedMultiplier: { "금광업": 1.0, "금 제련업": 1.0, "제조업": 1.0 },
  },
  {
    id: "worker_lv2",
    level: 2,
    displayName: "견습 일꾼",
    icon: WORKER_LEVEL_ICONS[2],
    modelPath: WORKER_LEVEL_MODELS[2],
    speedMultiplier: { "금광업": 1.15, "금 제련업": 1.15, "제조업": 1.15 },
  },
  {
    id: "worker_lv3",
    level: 3,
    displayName: "숙련 일꾼",
    icon: WORKER_LEVEL_ICONS[3],
    modelPath: WORKER_LEVEL_MODELS[3],
    speedMultiplier: { "금광업": 1.35, "금 제련업": 1.35, "제조업": 1.35 },
  },
  {
    id: "worker_lv4",
    level: 4,
    displayName: "마스터 일꾼",
    icon: WORKER_LEVEL_ICONS[4],
    modelPath: WORKER_LEVEL_MODELS[4],
    speedMultiplier: { "금광업": 1.6, "금 제련업": 1.6, "제조업": 1.6 },
  },
  {
    id: "worker_lv5",
    level: 5,
    displayName: "에픽 일꾼",
    icon: WORKER_LEVEL_ICONS[5],
    modelPath: WORKER_LEVEL_MODELS[5],
    speedMultiplier: { "금광업": 2.0, "금 제련업": 2.0, "제조업": 2.0 },
  },
  {
    id: "worker_lv6",
    level: 6,
    displayName: "레전드 일꾼",
    icon: WORKER_LEVEL_ICONS[6],
    modelPath: WORKER_LEVEL_MODELS[6],
    speedMultiplier: { "금광업": 3.0, "금 제련업": 3.0, "제조업": 3.0 },
  },
];

/** 레벨로 WorkerDefinition 조회 (없으면 Lv.1) */
export function getWorkerDefByLevel(level: number): WorkerDefinition {
  return WORKER_DEFINITIONS.find(w => w.level === level) ?? WORKER_DEFINITIONS[0];
}

/** 기존 코드 호환용 - id/displayName으로 검색 */
export function getWorkerDef(nameOrId: string): WorkerDefinition {
  const lvMatch = nameOrId.match(/Lv\.?(\d)/i) ?? nameOrId.match(/lv(\d)/i);
  if (lvMatch) return getWorkerDefByLevel(Number(lvMatch[1]));
  const found = WORKER_DEFINITIONS.find(
    (w) => w.id === nameOrId || w.displayName === nameOrId
  );
  return found ?? WORKER_DEFINITIONS[0];
}

// 산업별 기본 생산 비율 (백엔드 recipe API로 대체 예정)
export const INDUSTRY_PRODUCTION = {
  "금광업": { reqMat: 2, resProd: 40, durationMs: 60000 },
  "금 제련업": { reqMat: 12, resProd: 6, durationMs: 60000 },
  "제조업": { reqMat: 20, resProd: 2, durationMs: 60000 },
} as const;

export type IndustryKey = keyof typeof INDUSTRY_PRODUCTION;
