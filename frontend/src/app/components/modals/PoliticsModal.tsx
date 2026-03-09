import React from "react";
import { Landmark, TrendingUp, TrendingDown, Vote } from "lucide-react";

const policies = [
  {
    id: "p1",
    title: "제철업 보조금 확대",
    status: "진행중",
    impact: "positive" as const,
    description: "정부 주도 제철업 육성 정책으로 보조금 20% 확대",
    daysLeft: 12,
  },
  {
    id: "p2",
    title: "환경 규제 강화",
    status: "발의",
    impact: "negative" as const,
    description: "탄소배출 규제 강화로 생산비용 증가 예상",
    daysLeft: 30,
  },
  {
    id: "p3",
    title: "수출입 관세 조정",
    status: "시행중",
    impact: "neutral" as const,
    description: "원자재 수입 관세 5% 인하, 완제품 수출 관세 유지",
    daysLeft: 0,
  },
  {
    id: "p4",
    title: "노동법 개정안",
    status: "투표중",
    impact: "negative" as const,
    description: "최저임금 인상 및 근로시간 단축 법안",
    daysLeft: 5,
  },
];

export function PoliticsModal() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Landmark className="w-5 h-5 text-gray-600" />
        <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>정치 / 정책</h2>
      </div>

      <div className="space-y-3">
        {policies.map((policy) => (
          <div
            key={policy.id}
            className="bg-white rounded-xl border-2 border-gray-300 p-4 hover:border-gray-400 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-gray-800" style={{ fontWeight: 600 }}>{policy.title}</h3>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full ${
                      policy.status === "시행중"
                        ? "bg-green-100 text-green-700"
                        : policy.status === "투표중"
                        ? "bg-yellow-100 text-yellow-700"
                        : policy.status === "진행중"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                    style={{ fontWeight: 500 }}
                  >
                    {policy.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
              </div>

              <div className="flex-shrink-0 ml-3">
                {policy.impact === "positive" ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : policy.impact === "negative" ? (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                ) : (
                  <Vote className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {policy.daysLeft > 0 && (
              <div className="mt-2 text-[11px] text-gray-400">
                {policy.daysLeft}일 후 시행 예정
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
