// ─── 통합된 단일 gameStore ────────────────────────────────────────
// 이전에 src/app/store/gameStore.ts와 src/store/gameStore.ts가 중복 존재
// → src/app/store/gameStore.ts 를 정규 소스로 통합
// → 이 파일은 모든 export를 app/store에서 re-export (경로 통일 목적)
export * from "../app/store/gameStore";