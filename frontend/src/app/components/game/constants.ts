import * as THREE from "three";
import type { BuildingPage } from "../../../store/gameStore";

// ─── 스케일/크기 상수 ────────────────────────────────────────────
export const TILE_S = 1.5;
export const BLDG_S = TILE_S * 2;   // = 3
export const BX = TILE_S * 8;       // = 12
export const BZ = TILE_S * 4;       // = 6
export const WORKER_S = 0.6;
export const BELT_S = 0.55;

export const TW = TILE_S * 2;
export const BW = BLDG_S * 2;       // = 6
const ROAD_GAP_W = BX - BW;         // = 6
export const ROAD_S = TILE_S * (ROAD_GAP_W / TW); // = 3
export const ROAD_STEP = ROAD_S * 2; // = 6

// 폰트: 3D 라벨 → KerisKeduLine
export const FONT_URL = "fonts/KERISKEDU_Line.ttf";

export const outerX = BX + BW / 2 + ROAD_STEP / 2; // = 18
export const outerZ = BZ + BW / 2 + ROAD_STEP / 2; // = 12
export const vRoadX1 = -BX / 2; // = -6
export const vRoadX2 = BX / 2; // =  6

// ─── 카메라 설정 ─────────────────────────────────────────────────
export const CONFIG = {
    CAMERA: {
        polarAngle: Math.PI / 3,
        azimuthAngle: Math.PI / 4,
        initialZoom: 80,
        distance: 60,
        minZoom: 40,
        maxZoom: 150,
        boundLimit: 15,
    },
};

// ─── GLTF 모델 경로 ──────────────────────────────────────────────
const ENV = "/models/environments/";
export const M = {
    base: `${ENV}base.gltf`,
    bank: `${ENV}bank.gltf`,
    hr: `${ENV}humanresourcecenter.gltf`,
    market: `${ENV}market.gltf`,
    warehouse: `${ENV}warehouse.gltf`,
    roadStraight: `${ENV}road_straight.gltf`,
    roadCorner: `${ENV}road_corner.gltf`,
    roadCornerCurved: `${ENV}road_corner_curved.gltf`,
    roadJunction: `${ENV}road_junction.gltf`,
    roadTsplit: `${ENV}road_tsplit.gltf`,
    streetlight: `${ENV}streetlight.gltf`,
    trafficlightA: `${ENV}trafficlight_A.gltf`,
    trafficlightB: `${ENV}trafficlight_B.gltf`,
    bush: `${ENV}bush.gltf`,
    firehydrant: `${ENV}firehydrant.gltf`,
    boxA: `${ENV}box_A.gltf`,
    boxB: `${ENV}box_B.gltf`,
    carHatchback: `${ENV}car_hatchback.gltf`,
    carPolice: `${ENV}car_police.gltf`,
    carSedan: `${ENV}car_sedan.gltf`,
    carStationwagon: `${ENV}car_stationwagon.gltf`,
    carTaxi: `${ENV}car_taxi.gltf`,
    minigame: `${ENV}minecraft_pickaxe.gltf`,
    ocean: `${ENV}ocean.glb`,
};

// ─── 자동차 경로 ─────────────────────────────────────────────────
export const CAR_PATHS = {
    outer: [
        [-outerX, -outerZ], [outerX, -outerZ], [outerX, outerZ], [-outerX, outerZ], [-outerX, -outerZ],
    ] as [number, number][],
    innerH: [
        [-outerX, 0], [vRoadX1, 0], [vRoadX2, 0], [outerX, 0], [vRoadX2, 0], [vRoadX1, 0], [-outerX, 0],
    ] as [number, number][],
    innerV: [
        [vRoadX1, -outerZ], [vRoadX1, -BZ], [vRoadX1, 0], [vRoadX1, BZ], [vRoadX1, outerZ],
        [vRoadX1, BZ], [vRoadX1, 0], [vRoadX1, -BZ], [vRoadX1, -outerZ],
    ] as [number, number][],
    topLoop: [
        [vRoadX2, outerZ], [vRoadX2, 0], [outerX, 0], [outerX, -outerZ],
        [vRoadX2, -outerZ], [vRoadX2, -BZ], [vRoadX2, 0], [vRoadX2, outerZ],
    ] as [number, number][],
};

// ─── 전역 공유 상태 (차량/플레이어 충돌용) ──────────────────────
export const SHARED_STATE = {
    playerPos: new THREE.Vector3(0, -100, 0),
    cars: {} as Record<string, THREE.Vector3>,
};

// ─── 건물 영역 ───────────────────────────────────────────────────
export const BUILDING_AREAS = [
    { name: "hr", label: "인력소", pos: [-BX, -BZ] as [number, number] },
    { name: "bank", label: "은행", pos: [0, -BZ] as [number, number] },
    { name: "warehouse", label: "창고", pos: [BX, -BZ] as [number, number] },
    { name: "market", label: "마켓", pos: [BX, BZ] as [number, number] },
    { name: "minigame", label: "미니게임", pos: [-BX, BZ] as [number, number] },
];
export const WORKSTATION_POS = [0, BZ] as const;

// ─── 건물→페이지 라우팅 ──────────────────────────────────────────
export const buildingToPage: Record<string, BuildingPage> = {
    hr: "hr", bank: "bank", warehouse: "warehouse", minigame: "minigame", market: "market",
};

// ─── 이모트 목록 ─────────────────────────────────────────────────
export const EMOTES = [
    { id: "Death_A", icon: "☠️" },
    { id: "Spawn_Air", icon: "✨" },
    { id: "Sawing", icon: "🪚" },
    { id: "Pickaxing", icon: "⛏️" },
    { id: "Digging", icon: "🪏" },
];

// ─── 작업장 더미 모델 단일 구성 ────────────────────────────────
// 더미를 하나로만 표시. 적재량(storedCount)에 따라 시각적으로 표현.
export const STACK_LEVEL_MODELS = [
    "/models/props/Gold_Bars.gltf",             // lv1: 소량
    "/models/props/Gold_Bars_Stack_Small.gltf", // lv2: 중간
    "/models/props/Gold_Bars_Stack_Medium.gltf",// lv3: 많음
    "/models/props/Gold_Bars_Stack_Large.gltf", // lv4: 가득
];
// 하위 호환성 별칭 (기존 코드에서 import하는 이름 유지)
export const GOLD_STACK_MODELS = STACK_LEVEL_MODELS;

// 더미 1스택으로 단일화. 기존 MAX_PILES/MAX_TOTAL은 주서에 남기도
// 프론트가 참조하는 값만 남김
export const MAX_PILES = 1;   // 더미 1개로 고정
export const MAX_TOTAL = STACK_LEVEL_MODELS.length; // = 4 (레벨만 사용)

// 작업장 내 최대 적재량
// ⚠️ 백엔드 API에서 제공해야하는 값. 현재 WorkstationAPI.getStatus()
//        응답의 maxCapacity 값으로 대체해야함.
// 활용: Workstation.tsx에서 maxCapacity state로 저장하고 isFull 판단에 사용
export const DEFAULT_WORKSTATION_CAP = 100; // fallback 값 (백엔드가 내려주지 않을 때)
export const MAX_GOLD_CAP = DEFAULT_WORKSTATION_CAP; // 하위 호환성
