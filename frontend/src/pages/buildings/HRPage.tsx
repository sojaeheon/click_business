import React, { useState, useCallback } from "react";
import { ArrowLeft, Plus, Sparkles, Star } from "lucide-react";
import { useGame } from "../../app/store/gameStore";
import { HRAPI } from "../../api/gameApi"; // (TODO: HR 전용 API 확장이 필요할 경우 사용)

type Grade = "NORMAL" | "RARE" | "EPIC" | "LEGENDARY";

interface GachaResult {
  grade: Grade;
  name: string;
  level: number;
}

export function HRPage() {
  const { state, closeBuildingPage } = useGame();
  const { hrData } = state;
  const [selectedLevel, setSelectedLevel] = useState<number | null>(hrData.currentLevel);

  // Upgrade Lever State
  const [leverPulled, setLeverPulled] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Gacha System State
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [gachaStage, setGachaStage] = useState<"idle" | "intro" | "reveal" | "result">("idle");
  const [gachaResult, setGachaResult] = useState<GachaResult | null>(null);

  const pullLever = useCallback(async () => {
    if (isAnimating || isRecruiting || !selectedLevel) return;
    setIsAnimating(true);
    setLeverPulled(true);
    setResultMessage(null);

    try {
      // 인력 강화 처리 API 연동
      await HRAPI.upgradeWorker({ companyId: 1, currentLevel: selectedLevel });

      const success = Math.random() * 100 < hrData.successRate;
      setResultMessage(success ? "강화 성공!" : "강화 실패...");
    } catch (error) {
      console.error(error);
      setResultMessage("서버 통신 오류");
    } finally {
      setIsAnimating(false);
      setTimeout(() => setLeverPulled(false), 1500);
    }
  }, [hrData.successRate, isAnimating, isRecruiting, selectedLevel]);

  const startRecruitment = async () => {
    if (isRecruiting || isAnimating) return;
    setIsRecruiting(true);
    setGachaStage("intro");
    setGachaResult(null);

    try {
      await HRAPI.recruitWorker({ companyId: 1, type: "NORMAL" });
      
      // 1. 인트로 애니메이션 (빛이 모이는 연출)
      setTimeout(() => {
        setGachaStage("reveal");

        // 확률 기반 등급 추첨
        const rand = Math.random() * 100;
        let grade: Grade = "NORMAL";
        if (rand < 5) grade = "LEGENDARY";
        else if (rand < 20) grade = "EPIC";
        else if (rand < 50) grade = "RARE";

        setGachaResult({
          grade,
          name: grade === "LEGENDARY" ? "전설의 달인" : grade === "EPIC" ? "수석 엔지니어" : grade === "RARE" ? "우수 사원" : "신입 사원",
          level: 1
        });

        // 2. 결과 공개 연출
        setTimeout(() => {
          setGachaStage("result");
        }, 1500); // 실루엣에서 밝아지기까지 대기

      }, 2000);
    } catch (e) {
      console.error(e);
      alert("신규 채용 요청 중 오류가 발생했습니다.");
      closeRecruitment();
    }
  };

  const closeRecruitment = () => {
    setIsRecruiting(false);
    setGachaStage("idle");
    setGachaResult(null);
  };

  const getGradeColors = (grade: Grade) => {
    switch (grade) {
      case "LEGENDARY": return { bg: "bg-fuchsia-900", border: "border-fuchsia-400", text: "text-fuchsia-300", glow: "shadow-[0_0_80px_rgba(232,121,249,0.8)]" };
      case "EPIC": return { bg: "bg-purple-900", border: "border-purple-400", text: "text-purple-300", glow: "shadow-[0_0_50px_rgba(192,132,252,0.6)]" };
      case "RARE": return { bg: "bg-blue-900", border: "border-blue-400", text: "text-blue-300", glow: "shadow-[0_0_40px_rgba(96,165,250,0.5)]" };
      default: return { bg: "bg-slate-800", border: "border-slate-400", text: "text-slate-300", glow: "shadow-2xl" };
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-[#f5f0e8] flex flex-col pt-8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 relative z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={closeBuildingPage}
            className="w-12 h-12 rounded-full bg-white border-2 border-slate-300 flex items-center justify-center hover:bg-slate-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-4xl tracking-widest text-slate-800" style={{ fontWeight: 900 }}>
            DK <span className="font-light text-slate-600">HR</span>
          </h1>
        </div>
        <div className="w-12 h-12" />
      </div>

      {/* Main content - Split View */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto p-6 gap-8 relative z-10">
        
        {/* Left Side: Worker List */}
        <div className="w-1/3 bg-white rounded-3xl shadow-xl border-4 border-slate-300 flex flex-col overflow-hidden">
          <div className="bg-slate-100 px-6 py-4 border-b-4 border-slate-200">
            <h2 className="text-xl font-bold text-slate-700">보유 인력 목록</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <button
              onClick={() => setSelectedLevel(1)}
              className={`p-4 rounded-xl border-4 transition-all text-left flex justify-between items-center ${
                selectedLevel === 1 ? "border-indigo-500 bg-indigo-50 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">기본 인력</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">현재 레벨: 1</p>
              </div>
              {selectedLevel === 1 && <div className="w-4 h-4 rounded-full bg-indigo-500" />}
            </button>
            
            <button
              onClick={() => setSelectedLevel(2)}
              className={`p-4 rounded-xl border-4 transition-all text-left flex justify-between items-center ${
                selectedLevel === 2 ? "border-indigo-500 bg-indigo-50 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div>
                <h3 className="text-lg font-bold text-slate-800">숙련된 인력</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">현재 레벨: 2</p>
              </div>
              {selectedLevel === 2 && <div className="w-4 h-4 rounded-full bg-indigo-500" />}
            </button>
            
            <button 
              onClick={startRecruitment}
              className="p-6 rounded-xl border-4 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors flex flex-col items-center justify-center gap-3 group mt-4 active:scale-95"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="font-black text-indigo-700 text-lg tracking-widest">신규 인력 채용</span>
            </button>
          </div>
        </div>

        {/* Right Side: Detail & Upgrade Machine */}
        <div className="flex-1 bg-white rounded-3xl shadow-xl border-4 border-slate-300 flex flex-col overflow-hidden items-center justify-center relative p-8">
          {selectedLevel ? (
            <div className="flex items-end gap-16 max-w-3xl w-full justify-center">
              {/* Info panels + Character */}
              <div className="flex flex-col items-center gap-4">
                {/* Level info */}
                <div className="flex gap-4">
                  <div className="bg-slate-50 border-4 border-slate-200 rounded-2xl px-6 py-4 shadow-sm w-36 text-center">
                    <div className="text-sm font-bold text-slate-400">현재 레벨</div>
                    <div className="text-4xl text-slate-700 font-black mt-1">
                      {selectedLevel}
                    </div>
                  </div>

                  <div className="bg-slate-50 border-4 border-slate-200 rounded-2xl px-6 py-4 shadow-sm w-36 text-center relative overflow-hidden">
                    <div className="text-sm font-bold text-slate-400">성공 확률</div>
                    <div className="text-3xl text-emerald-600 font-black mt-1">
                      {hrData.successRate}%
                    </div>
                    {/* 반짝임 이펙트 (순수 CSS 장식) */}
                    <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-50 transform -skew-x-12 animate-[shimmer_3s_infinite]" />
                  </div>
                </div>

                {/* Character Platform */}
                <div className="relative mt-8">
                  <svg width="220" height="100" viewBox="0 0 220 100" className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-60">
                    <ellipse cx="110" cy="50" rx="100" ry="30" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeDasharray="8 6" />
                  </svg>

                  <div className="flex flex-col items-center relative z-10 transition-transform hover:scale-105 duration-300">
                    <div className="w-20 h-20 rounded-[2rem] border-4 border-slate-700 bg-gradient-to-b from-indigo-100 to-indigo-200 shadow-inner" />
                    <div className="relative -mt-2">
                      <div className="w-28 h-24 bg-gradient-to-b from-slate-200 to-slate-400 rounded-b-2xl rounded-t-lg border-4 border-slate-700 flex items-center justify-center shadow-md">
                        <div className={`w-8 h-8 rounded-full border-4 transition-colors duration-500 shadow-inner ${leverPulled ? resultMessage?.includes("성공") ? "border-emerald-500 bg-emerald-400 shadow-[0_0_15px_#34d399]" : resultMessage?.includes("실패") ? "border-rose-500 bg-rose-400 shadow-[0_0_15px_#fb7185]" : "border-amber-500 bg-amber-400 animate-pulse" : "border-slate-400 bg-slate-200"}`} />
                      </div>
                      <div className="absolute top-4 -left-12 w-12 h-4 bg-slate-300 border-2 border-slate-600 rounded-full rotate-12" />
                      <div className="absolute top-4 -right-12 w-12 h-4 bg-slate-300 border-2 border-slate-600 rounded-full -rotate-12" />
                    </div>
                    <div className="flex gap-6 -mt-2">
                      <div className="w-6 h-16 bg-slate-300 border-4 border-slate-700 rounded-b-xl" />
                      <div className="w-6 h-16 bg-slate-300 border-4 border-slate-700 rounded-b-xl" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Upgrade Lever */}
              <div className="flex flex-col items-center ml-12">
                <div className="text-3xl text-rose-600 mb-6 font-black tracking-widest bg-rose-50 px-6 py-2 rounded-full border-2 border-rose-200 shadow-sm animate-bounce">
                  당겨!
                </div>
                <button
                  onClick={pullLever}
                  disabled={isAnimating || isRecruiting}
                  className="relative cursor-pointer active:scale-95 transition-transform disabled:cursor-not-allowed group"
                >
                  <div className="relative flex flex-col items-center transition-transform duration-500 ease-in-out" style={{ transform: leverPulled ? "rotate(45deg)" : "rotate(-10deg)", transformOrigin: "bottom center" }}>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 border-4 border-rose-800 shadow-[0_0_20px_rgba(225,29,72,0.4)] group-hover:brightness-110" />
                    <div className="w-6 h-36 bg-gradient-to-b from-slate-300 to-slate-500 border-2 border-slate-700 -mt-2 shadow-inner" />
                  </div>
                  <div className="w-28 h-8 bg-slate-700 rounded-t-xl border-2 border-slate-800 -mt-4 z-10 relative shadow-[inset_0_4px_10px_rgba(255,255,255,0.2)]" />
                  <div className="w-32 h-6 bg-slate-800 rounded-xl mx-auto border-b-4 border-slate-900 shadow-2xl" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 font-bold text-xl">좌측에서 관리할 인력을 선택해주세요.</div>
          )}

          {/* Upgrade Result Overlay */}
          {resultMessage && !isRecruiting && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm transition-opacity duration-300">
              <div className={`px-12 py-8 rounded-3xl shadow-2xl border-4 transform scale-110 ${resultMessage.includes("성공") ? "bg-emerald-50 border-emerald-400 text-emerald-600" : "bg-rose-50 border-rose-400 text-rose-600"}`}>
                <h2 className="text-5xl font-black tracking-wide">{resultMessage}</h2>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- Gacha (채용) 전용 Full Screen Overlay --- */}
      {isRecruiting && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden">
          {/* 어두운 배경 */}
          <div className={`absolute inset-0 bg-slate-950 transition-opacity duration-1000 ${gachaStage === "intro" ? "opacity-80" : "opacity-95"}`} />
          
          {/* 중앙 스포트라이트 */}
          <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[300px] border-r-[300px] border-b-[150vh] border-l-transparent border-r-transparent border-b-white/10 opacity-50 mix-blend-overlay pointer-events-none" />

          {/* 가챠 진행 단계 표시 칸 */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
            
            {/* 1. 이펙트 파티클 및 실루엣 진행 */}
            <div className="relative w-64 h-80 flex items-center justify-center">
              {gachaStage === "intro" && (
                <div className="absolute inset-0 rounded-full border-t-8 border-indigo-500 animate-[spin_1s_linear_infinite]" />
              )}
              {gachaStage === "reveal" && (
                <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full scale-150 animate-pulse" />
              )}
              {gachaStage === "result" && gachaResult && (
                <div className="absolute inset-0 scale-150 flex items-center justify-center pointer-events-none">
                  {/* 폭죽 모형 (심플 CSS 렌더링) */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="absolute w-[2px] h-32 bg-gradient-to-t from-yellow-300 to-transparent origin-bottom" style={{ transform: `rotate(${i * 45}deg) translateY(-80px)` }} />
                  ))}
                  <Star className="w-64 h-64 text-yellow-300 opacity-20 absolute animate-[spin_10s_linear_infinite]" />
                </div>
              )}

              {/* 캐릭터 바디 */}
              <div className={`w-24 h-40 rounded-[3rem] border-4 transition-all duration-1000 ${
                gachaStage === "intro" ? "bg-slate-800 border-slate-700 opacity-0 scale-50" :
                gachaStage === "reveal" ? "bg-slate-900 border-slate-600 opacity-100 scale-100 shadow-[0_0_100px_white]" :
                gachaResult?.grade === "LEGENDARY" ? "bg-fuchsia-300 border-fuchsia-100 scale-110" :
                gachaResult?.grade === "EPIC" ? "bg-purple-300 border-purple-100 scale-110" :
                gachaResult?.grade === "RARE" ? "bg-blue-300 border-blue-100 scale-110" :
                "bg-slate-200 border-white scale-110"
              }`} />
            </div>

            {/* 결과 텍스트 */}
            {gachaStage === "result" && gachaResult && (
              <div className={`mt-12 flex flex-col items-center gap-4 animate-in slide-in-from-bottom-8 fade-in duration-500`}>
                <div className={`px-6 py-2 rounded-full border-4 font-black uppercase tracking-widest text-2xl ${getGradeColors(gachaResult.grade).border} ${getGradeColors(gachaResult.grade).bg} ${getGradeColors(gachaResult.grade).text} ${getGradeColors(gachaResult.grade).glow}`}>
                  {gachaResult.grade}
                </div>
                <h1 className="text-5xl font-black text-white tracking-widest">{gachaResult.name}</h1>
                <p className="text-slate-400 font-bold text-lg mt-2">새로운 인력이 팀에 합류했습니다!</p>
                
                <button 
                  onClick={closeRecruitment}
                  className="mt-8 px-12 py-4 rounded-full bg-white text-slate-900 font-black text-xl hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all w-full max-w-xs shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                >
                  확인
                </button>
              </div>
            )}
            
            {/* 진행 중 텍스트 */}
            {gachaStage !== "result" && (
              <div className="mt-16 text-3xl font-black tracking-widest text-white animate-pulse">
                이력서 검토 중...
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
