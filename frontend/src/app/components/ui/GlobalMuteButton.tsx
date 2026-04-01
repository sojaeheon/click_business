import { Volume2, VolumeX } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";

export function GlobalMuteButton() {
  const isMuted = useGameStore((s) => s.isMuted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  return (
    <button
      onClick={toggleMute}
      className="fixed bottom-4 left-4 z-[9999] w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:bg-black/70 transition-colors shadow-lg"
      title={isMuted ? "소리 켜기" : "소리 끄기"}
    >
      {isMuted ? (
        <VolumeX className="w-6 h-6 text-red-400" />
      ) : (
        <Volume2 className="w-6 h-6 text-white" />
      )}
    </button>
  );
}
