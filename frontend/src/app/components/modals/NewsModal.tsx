import { useState, useEffect } from "react";
import { ArrowLeft, Newspaper, TrendingUp, ChevronRight } from "lucide-react";
import { useGame } from "../../../store/gameStore";
import type { NewsItem } from "../../../store/gameStore";

// ... [NewsDetail & NewsList component remain identical] ...
// (TargetContent can cover the rest using Replace content effectively)

// 뉴스 상세 페이지 뷰
function NewsDetail({ news, onBack }: { news: NewsItem; onBack: () => void }) {
  return (
    <div className="flex flex-col pb-8">
      {/* 상단: 뒤로가기 */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-base font-semibold text-slate-500 hover:text-slate-800 cursor-pointer mb-6 w-fit transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        뉴스 목록
      </button>

      {/* 내부 카드 영역 */}
      <div className="bg-white rounded-3xl border-4 border-slate-200 p-8 flex flex-col relative shadow-sm">
        {/* 상단 타임배너 & 카테고리 */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-slate-500 text-sm font-bold flex items-center gap-1">
            <Newspaper className="w-4 h-4"/> 데일리 브리핑
          </span>
          {news.isBreaking && (
            <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-md tracking-wider">속보</span>
          )}
          <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-200">경제/산업</span>
        </div>

        {/* 제목 */}
        <h2 className="text-3xl font-black text-slate-900 leading-tight mb-3 break-keep">
          {news.headline}
        </h2>

        {/* 날짜 */}
        <div className="text-sm text-slate-400 font-bold mb-5 flex items-center gap-2">
          <span>발행일</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"/>
          <span>{news.date}</span>
        </div>

        <hr className="border-slate-200 mb-6" />

        {/* 본문 (왼쪽 블랙 바 포인트) */}
        <div className="flex-1 flex items-start">
          <div className="w-[4px] self-stretch bg-slate-800 rounded-full mr-5 flex-shrink-0" />
          <p className="text-lg font-bold text-slate-700 leading-relaxed break-keep">
            {news.summary || "상세 기사 내용이 여기에 표시됩니다. 본문 데이터가 로드되면 확인 가능합니다."}
          </p>
        </div>
      </div>
    </div>
  );
}

// 뉴스 목록 뷰
function NewsList({ onSelect }: { onSelect: (news: NewsItem) => void }) {
  const { state } = useGame();
  
  // 첫번째 뉴스를 주요 뉴스(속보 우선, 없으면 첫번째)로 지정
  const breakingNews = state.news.find((n) => n.isBreaking) || state.news[0];
  const otherNews = state.news.filter((n) => n.id !== breakingNews?.id);

  return (
    <div className="flex gap-6 items-stretch pb-2 h-[420px]">
      {/* 왼쪽: 헤드라인 뉴스 (은행 스타일) */}
      <div className="flex flex-col" style={{ flex: 5.5 }}>
        {breakingNews && (
          <button
            onClick={() => onSelect(breakingNews)}
            className="w-full text-left bg-white rounded-3xl border-4 border-slate-200 p-8 hover:border-slate-300 transition-colors cursor-pointer flex flex-col shadow-sm group min-h-[400px] h-full"
          >
            {/* 카테고리 & 속보 배지 */}
            <div className="flex items-center gap-3 mb-5">
              {breakingNews.isBreaking && (
                <span className="bg-red-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-md tracking-wider">주요속보</span>
              )}
            </div>

            {/* 제목 */}
            <h3 className="text-2xl font-black text-slate-900 leading-tight mb-4 group-hover:text-indigo-700 transition-colors break-keep">
              {breakingNews.headline}
            </h3>

            {/* 날짜 */}
            <div className="text-sm text-slate-400 font-bold mb-5 flex items-center gap-2">
               <span>발행일</span>
               <span className="w-1 h-1 bg-slate-300 rounded-full"/>
               <span>{breakingNews.date}</span>
            </div>

            <hr className="border-slate-200 mb-5 w-full" />

            {/* 본문 짧게 미리보기 */}
            <div className="flex-1 flex items-start">
              <div className="w-[4px] self-stretch bg-indigo-600 rounded-full mr-5 flex-shrink-0" />
              <p className="text-lg font-bold text-slate-600 leading-relaxed break-keep line-clamp-3">
                {breakingNews.summary || "뉴스 본문 세부 내용이 이 영역에 표시됩니다. 전체 뉴스 목록에서 상세 기사를 확인하실 수 있습니다."}
              </p>
            </div>
            
            <div className="mt-6 flex justify-end w-full">
               <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg flex items-center gap-1 group-hover:bg-indigo-100 transition-colors">
                 자세히 보기 <ChevronRight className="w-4 h-4" />
               </span>
            </div>
          </button>
        )}
      </div>

      {/* 오른쪽: 이전 뉴스 리스트 */}
      <div className="flex flex-col bg-slate-50 rounded-3xl border-2 border-slate-200 p-5 min-h-[400px] h-full" style={{ flex: 4.5 }}>
         <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 hide-scrollbar" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {otherNews.length > 0 ? otherNews.map((news) => (
            <button
              key={news.id}
              onClick={() => onSelect(news)}
              className="w-full text-left bg-white rounded-2xl border-2 border-slate-100 p-5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col min-h-[100px] group"
            >
              <div className="flex items-center justify-end mb-2">
                 {news.isBreaking && (
                    <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">속보</span>
                 )}
              </div>
              <p className="text-base text-slate-800 line-clamp-2 leading-relaxed font-bold group-hover:text-indigo-600 transition-colors break-keep mb-3">
                {news.headline}
              </p>
              <div className="flex justify-end w-full mt-auto">
                 <span className="text-[10px] font-bold text-slate-400">{news.date}</span>
              </div>
            </button>
          )) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-bold text-sm">
               더 이상 기사가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewsModal() {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { state } = useGame();

  useEffect(() => {
    state.fetchNews();
  }, []);

  // 뉴스 모달 전체 레이아웃
  return (
    <div className="flex flex-col">
      {selectedNews ? (
        <NewsDetail news={selectedNews} onBack={() => setSelectedNews(null)} />
      ) : (
        <NewsList onSelect={(news) => setSelectedNews(news)} />
      )}
    </div>
  );
}
