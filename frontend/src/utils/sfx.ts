/** 경량 효과음 재생 유틸 — 동시 다발 재생 지원 */
const cache = new Map<string, HTMLAudioElement>();

function preload(src: string) {
  if (!cache.has(src)) {
    const a = new Audio(src);
    a.load();
    cache.set(src, a);
  }
}

export function playSfx(src: string, volume = 0.5) {
  preload(src);
  const a = cache.get(src)!.cloneNode(true) as HTMLAudioElement;
  a.volume = Math.min(1, Math.max(0, volume));
  a.play().catch(() => {});
}

// 프리로드
["/audio/hit.wav", "/audio/jump.wav", "/audio/leveling.wav", "/audio/spawn.wav"].forEach(preload);
