import React, { useState } from "react";
import { ImageOff } from "lucide-react";
import { useGame } from "../../store/gameStore";

export function NewsModal() {
  const { state } = useGame();
  const [selectedNews, setSelectedNews] = useState(state.news[0]?.id || "");

  const breakingNews = state.news.find((n) => n.isBreaking);
  const otherNews = state.news.filter((n) => !n.isBreaking);

  return (
    <div>
      <div className="flex gap-4">
        {/* Breaking news - left panel */}
        <div className="flex-1">
          {breakingNews && (
            <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden cursor-pointer hover:border-gray-400 transition-colors">
              {/* Banner */}
              <div className="relative bg-gray-200 h-48 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                {/* Diagonal banner */}
                <div
                  className="absolute top-4 -left-8 bg-red-500 text-white px-12 py-1.5 text-sm rotate-[-20deg] shadow-lg"
                  style={{ fontWeight: 700 }}
                >
                  BREAKING NEWS!!
                </div>
                {/* Placeholder illustration */}
                <div className="flex flex-col items-center text-gray-400">
                  <ImageOff className="w-16 h-16" />
                  <span className="text-sm mt-1">뉴스 이미지</span>
                </div>
              </div>

              <div className="p-4">
                <p className="text-gray-800 text-base" style={{ fontWeight: 600 }}>
                  {breakingNews.headline}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-blue-600" style={{ fontWeight: 600 }}>TODAY</span>
                  <span className="text-sm text-gray-500">{breakingNews.date}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* News list - right panel */}
        <div className="w-64 space-y-2">
          {otherNews.map((news) => (
            <button
              key={news.id}
              onClick={() => setSelectedNews(news.id)}
              className={`w-full text-left bg-white rounded-xl border-2 p-3 transition-all cursor-pointer flex gap-3 ${
                selectedNews === news.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center border border-gray-200">
                <ImageOff className="w-6 h-6 text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 truncate" style={{ fontWeight: 500 }}>
                  {news.headline}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">{news.date}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
