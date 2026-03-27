import { useState, useEffect } from "react";
import { Trophy, Loader2 } from "lucide-react";
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

  const [rankData, setRankData] = useState<RankEntry[]>(initialRankData);
  const [lastUpdated, setLastUpdated] = useState<string>("로딩 중...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);


  useEffect(() => {
    let isMounted = true;
    RankingAPI.getTopRanks()
      .then((res) => {
        if (!isMounted) return;

        // ✨ 수정 포인트 1: res.data.data가 아니라 res.data 입니다!
        // 그리고 api의 목업 데이터(companyName, score)를 컴포넌트 규격에 맞게 예쁘게 맵핑해줍니다.
        const formattedData = res.data.map((item: any) => ({
          rank: item.rank,
          name: item.companyName, // 대표자 이름 (현재는 회사명으로 대체)
          company: item.tier || "일반", // 회사명 자리 (현재는 티어로 대체)
          amount: item.score.toLocaleString() + " 원", // 점수를 돈 형식으로 변환
        }));

        setRankData(formattedData || []);

        // 매 시 정각 포맷 구하기
        const now = new Date();
        const hr = now.getHours().toString().padStart(2, '0');
        setLastUpdated(`오늘 ${hr}:00 업데이트됨`);

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

  // ✨ 수정 포인트 2: rest 변수에도 물음표(?)를 붙여서 안전하게 방어!
  const top3 = rankData?.slice(0, 3) || [];
  const rest = rankData?.slice(3) || [];


  return (
    <div className="relative h-full flex flex-col pointer-events-auto overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-600" />
          <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>명예의 전당</h2>
        </div>
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
        <div className="flex flex-col w-full">
          <p className="text-xs text-gray-400 mb-2 flex-shrink-0">기준 : {lastUpdated}</p>

          {/* Podium — 1, 2, 3위 */}
          <div className="flex items-end justify-center gap-6 mb-4 mt-2 flex-shrink-0">
            {/* 2위 */}
            <div className="flex flex-col items-center gap-2 group animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="text-center mb-1">
                <p className="text-sm font-black text-gray-700">{top3[1]?.name}</p>
              </div>
              <div className={`w-20 h-24 rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-3 transition-transform group-hover:-translate-y-2 ${podiumColors[2]}`}>
                <span className="text-3xl font-black text-slate-500 drop-shadow-sm">2</span>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-slate-100 px-3 py-1 rounded-full">{top3[1]?.amount}</span>
            </div>

            {/* 1위 */}
            <div className="flex flex-col items-center gap-2 group animate-fade-in relative z-10" style={{ animationDelay: '0ms' }}>
              <div className="absolute -top-16 w-32 h-32 bg-yellow-400/20 rounded-full blur-xl animate-pulse" />
              <div className="text-center mb-2">
                <Trophy className="w-8 h-8 text-yellow-500 mx-auto drop-shadow-md mb-1 animate-bounce" />
                <p className="text-base font-black text-gray-800">{top3[0]?.name}</p>
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
              </div>
              <div className={`w-20 h-16 rounded-t-2xl border-2 border-b-0 flex flex-col items-center justify-start pt-2 transition-transform group-hover:-translate-y-2 ${podiumColors[3]}`}>
                <span className="text-3xl font-black text-orange-500 drop-shadow-sm">3</span>
              </div>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{top3[2]?.amount}</span>
            </div>
          </div>

          {/* 4위 이하 목록 */}
          <div className="w-full bg-white rounded-xl border-2 border-gray-300 mt-2">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 shadow-sm border-b border-gray-200">
                <tr className="border-b border-gray-200">
                  <th className="py-3 px-4 text-left text-gray-500 font-bold">순위</th>
                  <th className="py-3 px-4 text-left text-gray-500 font-bold">기업명</th>
                  
                  <th className="py-3 px-4 text-right text-gray-500 font-bold">자산</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((entry) => (
                  <tr key={entry.rank} className="border-b border-gray-100 transition-colors">
                    <td className="py-3 px-4 text-gray-600 font-black">{entry.rank}</td>
                    <td className="py-3 px-4 text-gray-800 font-bold">{entry.name}</td>
                    <td className="py-3 px-4 text-right text-gray-700 font-bold">{entry.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </div>
  );
}