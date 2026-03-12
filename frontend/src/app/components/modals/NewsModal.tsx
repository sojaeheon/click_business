import { useState } from "react";
import { ImageOff, ArrowLeft } from "lucide-react";
import { useGame } from "../../store/gameStore";
import type { NewsItem } from "../../store/gameStore";

// 뉴스 상세 페이지 뷰
function NewsDetail({ news, onBack }: { news: NewsItem; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* 상단: 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-base font-semibold text-gray-500 hover:text-gray-800 cursor-pointer mb-6 w-fit transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        뉴스 목록
      </button>

      {/* 이미지 영역 */}
      <div className="relative bg-gray-200 h-60 rounded-2xl overflow-hidden mb-6 flex items-center justify-center flex-shrink-0">
        {news.isBreaking && (
          <div
            className="absolute top-5 -left-8 bg-red-500 text-white px-14 py-1.5 text-sm rotate-[-20deg] shadow-lg z-10"
            style={{ fontWeight: 700 }}
          >
            BREAKING NEWS!!
          </div>
        )}
        <div className="flex flex-col items-center text-gray-400 z-0">
          <ImageOff className="w-16 h-16 mb-2" />
          <span className="text-base text-gray-500">뉴스 이미지 공간</span>
        </div>
      </div>

      {/* 제목 + 날짜 */}
      <div className="mb-5 px-2">
        {news.isBreaking && (
          <span className="text-sm font-bold text-red-500 bg-red-50 border border-red-200 px-3 py-1 rounded-full mr-3">
            BREAKING
          </span>
        )}
        <span className="text-sm text-gray-400 font-medium">{news.date}</span>
        <h2 className="text-2xl text-gray-800 mt-2 leading-tight" style={{ fontWeight: 800 }}>
          {news.headline}
        </h2>
      </div>

      {/* 본문 */}
      <div className="flex-1 bg-white rounded-2xl border-2 border-gray-200 p-6 overflow-auto">
        {news.summary ? (
          <p className="text-gray-700 text-base leading-relaxed">{news.summary}</p>
        ) : (
          <p className="text-gray-400 text-base leading-relaxed italic">
            뉴스 본문 내용이 여기에 표시됩니다.<br /><br />
            {/* 💡 [백엔드 연동] GET /api/v1/news/{news.id} 로 본문 내용 가져오기 */}
          </p>
        )}
      </div>
    </div>
  );
}

// 뉴스 목록 뷰
function NewsList({ onSelect }: { onSelect: (news: NewsItem) => void }) {
  const { state } = useGame();
  const breakingNews = state.news.find((n) => n.isBreaking);
  const otherNews = state.news.filter((n) => !n.isBreaking);

  return (
    <div className="flex gap-6 h-full">
      {/* 왼쪽: 속보 */}
      <div className="flex-[3]">
        {breakingNews && (
          <button
            onClick={() => onSelect(breakingNews)}
            className="w-full h-full text-left bg-white rounded-2xl border-2 border-gray-300 overflow-hidden hover:border-gray-400 transition-colors cursor-pointer flex flex-col"
          >
            <div className="relative bg-gray-200 h-64 flex items-center justify-center overflow-hidden flex-shrink-0">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
              <div
                className="absolute top-8 -left-10 bg-red-500 text-white px-16 py-2 text-base rotate-[-20deg] shadow-lg z-10"
                style={{ fontWeight: 800 }}
              >
                BREAKING NEWS!!
              </div>
              <div className="flex flex-col items-center text-gray-400 z-0">
                <ImageOff className="w-16 h-16 mb-2" />
                <span className="text-base text-gray-500">메인 뉴스 이미지</span>
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <p className="text-gray-800 text-2xl mb-2" style={{ fontWeight: 800 }}>{breakingNews.headline}</p>
              <div className="flex items-center gap-2 mt-auto">
                <span className="text-base text-blue-600" style={{ fontWeight: 700 }}>TODAY</span>
                <span className="text-sm text-gray-500 font-medium">{breakingNews.date.replace("TODAY ", "")}</span>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* 오른쪽: 과거 뉴스 목록 */}
      <div className="flex-[2] space-y-4 overflow-y-auto pr-2">
        {otherNews.map((news) => (
          <button
            key={news.id}
            onClick={() => onSelect(news)}
            className="w-full text-left bg-white rounded-2xl border-2 border-gray-300 p-4 hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer flex gap-4 min-h-[100px]"
          >
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center border-2 border-gray-200">
              <ImageOff className="w-8 h-8 text-gray-400" />
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <p className="text-base text-gray-800 line-clamp-2 leading-relaxed" style={{ fontWeight: 700 }}>
                {news.headline}
              </p>
              <p className="text-xs text-gray-400 mt-2 font-medium">{news.date}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// 메인 NewsModal
export function NewsModal() {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  return (
    <div className="h-full flex flex-col">
      {selectedNews ? (
        <NewsDetail news={selectedNews} onBack={() => setSelectedNews(null)} />
      ) : (
        <NewsList onSelect={(news) => setSelectedNews(news)} />
      )}
    </div>
  );
}
