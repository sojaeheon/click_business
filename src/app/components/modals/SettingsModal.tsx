import React, { useState } from "react";
import { Settings, Volume2, VolumeX, Monitor, Globe } from "lucide-react";

export function SettingsModal() {
  const [soundOn, setSoundOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(70);
  const [sfxVolume, setSfxVolume] = useState(80);
  const [language, setLanguage] = useState("ko");
  const [quality, setQuality] = useState("high");

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>설정</h2>
      </div>

      <div className="space-y-4">
        {/* Sound */}
        <div className="bg-white rounded-xl border-2 border-gray-300 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {soundOn ? (
                <Volume2 className="w-5 h-5 text-gray-600" />
              ) : (
                <VolumeX className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-gray-800" style={{ fontWeight: 600 }}>사운드</span>
            </div>
            <button
              onClick={() => setSoundOn(!soundOn)}
              className={`w-12 h-6 rounded-full transition-colors cursor-pointer ${
                soundOn ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  soundOn ? "translate-x-6.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-16">배경음</span>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume}
                onChange={(e) => setMusicVolume(Number(e.target.value))}
                className="flex-1"
                disabled={!soundOn}
              />
              <span className="text-sm text-gray-500 w-8">{musicVolume}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 w-16">효과음</span>
              <input
                type="range"
                min="0"
                max="100"
                value={sfxVolume}
                onChange={(e) => setSfxVolume(Number(e.target.value))}
                className="flex-1"
                disabled={!soundOn}
              />
              <span className="text-sm text-gray-500 w-8">{sfxVolume}%</span>
            </div>
          </div>
        </div>

        {/* Graphics */}
        <div className="bg-white rounded-xl border-2 border-gray-300 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-5 h-5 text-gray-600" />
            <span className="text-gray-800" style={{ fontWeight: 600 }}>그래픽 품질</span>
          </div>
          <div className="flex gap-2">
            {[
              { key: "low", label: "낮음" },
              { key: "medium", label: "보통" },
              { key: "high", label: "높음" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setQuality(opt.key)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                  quality === opt.key
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
                style={{ fontWeight: quality === opt.key ? 600 : 400 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-white rounded-xl border-2 border-gray-300 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-gray-600" />
            <span className="text-gray-800" style={{ fontWeight: 600 }}>언어</span>
          </div>
          <div className="flex gap-2">
            {[
              { key: "ko", label: "한국어" },
              { key: "en", label: "English" },
              { key: "ja", label: "日本語" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setLanguage(opt.key)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm transition-all cursor-pointer ${
                  language === opt.key
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
                style={{ fontWeight: language === opt.key ? 600 : 400 }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
