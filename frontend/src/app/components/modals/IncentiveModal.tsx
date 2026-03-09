import { useState } from "react";
import { Trophy, X } from "lucide-react";
import { useGame } from "../../store/gameStore";

interface RankEntry {
  rank: number;
  name: string;
  company: string;
  amount: string;
}

// 임시 더미 데이터 (백엔드 연동 시 교체)
const rankData: RankEntry[] = [
  { rank: 1, name: "허서연", company: "기업", amount: "돈" },
  { rank: 2, name: "손서영", company: "", amount: "돈" },
  { rank: 3, name: "김은수", company: "", amount: "돈" },
  { rank: 4, name: "강찬휘", company: "", amount: "돈" },
  { rank: 5, name: "소재헌", company: "", amount: "돈" },
  { rank: 6, name: "최두용", company: "", amount: "돈" },
];

const podiumColors: Record<number, string> = {
  1: "bg-yellow-100 border-yellow-400",
  2: "bg-gray-100 border-gray-400",
  3: "bg-orange-100 border-orange-400",
};

export function IncentiveModal() {
  const top3 = rankData.slice(0, 3);
  const rest = rankData.slice(3);

  // 기준 시각 (임시 하드코딩; 백엔드 연동 시 교체)
  const lastUpdated = "2026.03.03 PM 09:00";

  const { state } = useGame();
  const [showMyRank, setShowMyRank] = useState(false);

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
      <p className="text-xs text-gray-400 mb-5">기준 : {lastUpdated}</p>

      {/* Podium — 1, 2, 3위 */}
      <div className="flex items-end justify-center gap-4 mb-6">
        {/* 2위 */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-20 h-14 rounded-xl border-2 flex flex-col items-center justify-center ${podiumColors[2]}`}>
            <span className="text-2xl font-black text-gray-500">2</span>
          </div>
          <span className="text-sm font-bold text-gray-700">{top3[1]?.name}</span>
          <span className="text-xs text-gray-400">{top3[1]?.amount}</span>
        </div>
        {/* 1위 */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-24 h-20 rounded-xl border-2 flex flex-col items-center justify-center ${podiumColors[1]}`}>
            <span className="text-3xl font-black text-yellow-500">1</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-gray-800">{top3[0]?.name}</p>
            <p className="text-xs text-gray-500">{top3[0]?.company}</p>
          </div>
          <span className="text-xs text-gray-400">{top3[0]?.amount}</span>
        </div>
        {/* 3위 */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-20 h-10 rounded-xl border-2 flex flex-col items-center justify-center ${podiumColors[3]}`}>
            <span className="text-2xl font-black text-orange-400">3</span>
          </div>
          <span className="text-sm font-bold text-gray-700">{top3[2]?.name}</span>
          <span className="text-xs text-gray-400">{top3[2]?.amount}</span>
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
