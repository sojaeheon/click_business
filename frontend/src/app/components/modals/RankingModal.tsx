import { useState, useEffect } from "react";
import { Trophy, X, Loader2 } from "lucide-react";
import { useGame } from "../../store/gameStore";
import { RankingAPI } from "../../../api/gameApi";

interface RankEntry {
  rank: number;
  name: string;
  company: string;
  amount: string;
}

// API 연동을 위한 빈 초기 상태
const initialRankData: RankEntry[] = [];

const podiumColors: Record<number, string> = {
  1: "bg-gradient-to-t from-yellow-300 to-yellow-100 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]",
  2: "bg-gradient-to-t from-slate-300 to-slate-100 border-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.4)]",
  3: "bg-gradient-to-t from-orange-300 to-orange-100 border-orange-300 shadow-[0_0_15px_rgba(251,146,60,0.4)]",
};

export function RankingModal() {
  const { state } = useGame();
  
  const [rankData, setRankData] = useState<RankEntry[]>(initialRankData);
  const [lastUpdated, setLastUpdated] = useState<string>("로딩 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [showMyRank, setShowMyRank] = useState(false);

  useEffect(() => {
    let isMounted = true;
    RankingAPI.getTopRanks()
      .then((res) => {
        if (!isMounted) return;
        setRankData(res.data.data);
        setLastUpdated(res.data.lastUpdated);
        setError(false);
      })
      .catch((err) => {
        console.error("명예의 전당 조회 오류:", err);
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, []);

  const top3 = rankData.slice(0, 3);
  const rest = rankData.slice(3);

  // 내 순위 더미 데이터
  const myRank = { rank: 2, amount: "돈" };

  return (
    <div className="relative h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>명예의 전당</h2>
        </div>
        <button
          onClick={() => setShowMyRank(true)}
          className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors cursor-pointer"
        >
          내 순위
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center h-64 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm">랭킹 정보를 불러오는 중입니다...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center h-64 text-rose-500">
          <p className="font-bold mb-1">통신 오류 발생</p>
          <p className="text-sm">목업 API 설정 또는 서버가 연결되지 않았습니다.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-5">기준 : {lastUpdated}</p>

          {/* Podium — 1, 2, 3위 */}
          <div className="flex items-end justify-center gap-6 mb-8 mt-4">
        {/* 2위 */}
        <div className="flex flex-col items-center gap-2 group animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="text-center mb-1">
            <p className="text-sm font-black text-gray-700">{top3[1]?.name}</p>
            <p className="text-[10px] text-gray-500">{top3[1]?.company}</p>
          </div>
          <div className={`w-20 h-24 rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-3 transition-transform group-hover:-translate-y-2 ${podiumColors[2]}`}>
            <span className="text-3xl font-black text-slate-500 drop-shadow-sm">2</span>
          </div>
          <span className="text-xs font-bold text-gray-500 bg-slate-100 px-3 py-1 rounded-full">{top3[1]?.amount}</span>
        </div>
        {/* 1위 */}
        <div className="flex flex-col items-center gap-2 group animate-fade-in relative z-10" style={{ animationDelay: '0ms' }}>
          {/* 황소머리/가랜드 대체 빛 이펙트 */}
          <div className="absolute -top-16 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl animate-pulse" />
          
          <div className="text-center mb-2">
            <Trophy className="w-8 h-8 text-yellow-500 mx-auto drop-shadow-md mb-1 animate-bounce" />
            <p className="text-base font-black text-gray-800">{top3[0]?.name}</p>
            <p className="text-xs text-yellow-600 font-bold">{top3[0]?.company}</p>
          </div>
          <div className={`relative w-28 h-32 rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-4 transition-transform group-hover:-translate-y-2 ${podiumColors[1]}`}>
            <span className="text-5xl font-black text-yellow-600 drop-shadow-md">1</span>
          </div>
          <span className="text-sm font-black text-yellow-700 bg-yellow-50 border border-yellow-200 shadow-sm px-4 py-1.5 rounded-full">{top3[0]?.amount}</span>
        </div>
        {/* 3위 */}
        <div className="flex flex-col items-center gap-2 group animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="text-center mb-1">
            <p className="text-sm font-black text-gray-700">{top3[2]?.name}</p>
            <p className="text-[10px] text-gray-500">{top3[2]?.company}</p>
          </div>
          <div className={`w-20 h-16 rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-2 transition-transform group-hover:-translate-y-2 ${podiumColors[3]}`}>
            <span className="text-3xl font-black text-orange-500 drop-shadow-sm">3</span>
          </div>
          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{top3[2]?.amount}</span>
        </div>
      </div>

      {/* 4위 이하 목록 */}
      <div className="bg-white rounded-xl border-2 border-gray-300 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-4 text-left text-gray-500 font-semibold">순위</th>
              <th className="py-2 px-4 text-left text-gray-500 font-semibold">이름</th>
              <th className="py-2 px-4 text-right text-gray-500 font-semibold">돈</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((entry) => (
              <tr key={entry.rank} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-600 font-bold">{entry.rank}</td>
                <td className="py-2 px-4 text-gray-700">{entry.name}</td>
                <td className="py-2 px-4 text-right text-gray-700">{entry.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}

      {/* 내 순위 팝업 */}
      {showMyRank && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-2xl" onClick={() => setShowMyRank(false)} />
          <div className="relative bg-white rounded-2xl border-2 border-gray-300 shadow-2xl p-6 w-72 text-center">
            <button
              onClick={() => setShowMyRank(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4">내 순위</h3>
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <div className="text-3xl font-black text-blue-500 mb-2">{myRank.rank}<span className="text-lg text-gray-500 ml-1">위</span></div>
              <div className="font-bold text-gray-700">{state.companyName}</div>
              <div className="text-sm text-gray-500 mt-1">총 자산: {myRank.amount}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
