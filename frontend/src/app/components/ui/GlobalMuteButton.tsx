import { Volume2, VolumeX } from "lucide-react";
import { useGameStore } from "../../../store/gameStore";

export function GlobalMuteButton() {
  const isMuted = useGameStore((s) => s.isMuted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  return (
    <button
      onClick={toggleMute}
      style={{ zIndex: 99999 }}
      className="fixed bottom-6 left-6 w-14 h-14 rounded-full bg-black/80 backdrop-blur-md border-[2px] border-white/50 flex items-center justify-center cursor-pointer hover:bg-black hover:scale-110 transition-all shadow-2xl"
      title={isMuted ? "소리 켜기" : "소리 끄기"}
    >
      {isMuted ? (
        <VolumeX className="w-8 h-8 text-red-500" />
      ) : (
        <Volume2 className="w-8 h-8 text-white" />
      )}
    </button>
  );
}
