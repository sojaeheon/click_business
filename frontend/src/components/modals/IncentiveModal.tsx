import React from "react";
import { Trophy, Medal, Star, Award } from "lucide-react";

const achievements = [
  { id: "a1", title: "첫 생산", desc: "첫 번째 제품 생산 완료", icon: Star, earned: true, date: "2026.02.15" },
  { id: "a2", title: "백만장자", desc: "잔액 1,000,000 달성", icon: Trophy, earned: true, date: "2026.02.20" },
  { id: "a3", title: "81승", desc: "거래 81회 성공", icon: Medal, earned: true, date: "2026.03.01" },
  { id: "a4", title: "제철왕", desc: "철강 생산량 1위 달성", icon: Award, earned: false, date: "" },
  { id: "a5", title: "무차입 경영", desc: "부채 0원 달성", icon: Star, earned: false, date: "" },
  { id: "a6", title: "글로벌 진출", desc: "해외 수출 시작", icon: Trophy, earned: false, date: "" },
];

export function IncentiveModal() {
  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-yellow-600" />
        <h2 className="text-xl text-gray-800" style={{ fontWeight: 700 }}>명예의 전당 / 인센티브</h2>
        <span className="text-sm text-gray-400 ml-2">
          {earnedCount}/{achievements.length} 달성
        </span>
      </div>

      {/* Progress bar */}
      <div className="bg-gray-200 rounded-full h-3 mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all"
          style={{ width: `${(earnedCount / achievements.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          return (
            <div
              key={achievement.id}
              className={`rounded-xl border-2 p-4 transition-all ${
                achievement.earned
                  ? "bg-white border-yellow-300 shadow-sm"
                  : "bg-gray-100 border-gray-200 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    achievement.earned
                      ? "bg-yellow-100"
                      : "bg-gray-200"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      achievement.earned ? "text-yellow-600" : "text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-gray-800" style={{ fontWeight: 600 }}>{achievement.title}</h3>
                  <p className="text-[11px] text-gray-500">{achievement.desc}</p>
                  {achievement.earned && (
                    <p className="text-[10px] text-yellow-600 mt-0.5">{achievement.date}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
