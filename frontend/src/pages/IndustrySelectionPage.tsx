import { useState, useEffect, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from "../store/gameStore";
import { useAlertStore } from "../store/useAlertStore";
import { preloadGameModels } from "../app/components/game/preload";
import { CompanyAPI } from "../api/gameApi";
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';

/** ocean.glb 3D 배경 모델 */
function OceanModel() {
  const { scene } = useGLTF('/models/environments/ocean.glb');
  return <primitive object={scene} scale={2.5} position={[0, -1.5, 0]} />;
}

function OceanBackground() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 4, 8], fov: 50 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 5]} intensity={1.5} />
        <Suspense fallback={null}>
          <OceanModel />
          <Environment preset="sunset" />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.4}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.5}
        />
      </Canvas>
    </div>
  );
}

const IndustryCard = ({ title, iconSrc, onSelect, isSelected, isConfirmed }: {
  title: string;
  iconSrc: string;
  onSelect: () => void;
  isSelected?: boolean;   // 키보드/마우스로 하이라이트 (헤더 이미지 변경용)
  isConfirmed?: boolean;  // 카드 클릭해서 모달 열린 상태 (카드 배경색 변경용)
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const active = isSelected || isHovered;
  const bgImage = active ? "/ui_icons/Button_Exit_Blue.png" : "/ui_icons/Button_Exit_Disable.png";

  return (
    <div
      className={`industry-card flex flex-col items-center justify-start cursor-pointer transition-all duration-300
        hover:-translate-y-2 hover:shadow-2xl
        ${isSelected ? 'scale-105' : ''}
        ${isConfirmed ? 'bg-sky-400/25 rounded-3xl ring-2 ring-sky-300/60' : ''}
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-48 h-16 flex items-center justify-center -mt-8 mb-6">
        <img src={bgImage} alt="Title BG" className="absolute inset-0 w-full h-full object-fill drop-shadow-md transition-all" />
        <span className={`relative font-bold text-lg tracking-wide ${active ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-gray-300 drop-shadow'}`}>
          {title}
        </span>
      </div>

      <div className="industry-icon-wrapper p-6 transition-all">
        <img
          src={iconSrc}
          alt={title}
          className="w-full h-full object-cover drop-shadow-lg"
        />
      </div>
    </div>
  );
};

export const IndustrySelectionPage = () => {
  const navigate = useNavigate();
  const setCompanyInfo = useGameStore(state => state.setCompanyInfo);

  const INDUSTRIES = ['금광업', '금 제련업', '제조업'];
  const INDUSTRY_ICONS = ['/images/props/nugget.png', '/images/props/goldbar.png', '/images/props/drill.png'];

  const [selectedIndex, setSelectedIndex] = useState(1); // 기본값: 가운데 (금 제련업)
  const selectedIndustry = INDUSTRIES[selectedIndex];

  const [showModal, setShowModal] = useState(false); // 카드 클릭 시만 true
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    preloadGameModels();
  }, []);

  // ← → / a / d 키 → 카드 이동 / Enter → 모달 오픈
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        setSelectedIndex(prev => (prev - 1 + INDUSTRIES.length) % INDUSTRIES.length);
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        setSelectedIndex(prev => (prev + 1) % INDUSTRIES.length);
      } else if (e.key === 'Enter' && !showModal) {
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal]);

  const handleSelect = (industry: string) => {
    const idx = INDUSTRIES.indexOf(industry);
    setSelectedIndex(idx);
    setShowModal(true); // 카드 클릭 시 모달 오픈
  };

  const handleConfirm = async () => {
    if (companyName.trim() === '') {
      useAlertStore.getState().openAlert('회사 이름을 입력해주세요.', "경고");
      return;
    }
    if (!selectedIndustry) {
      useAlertStore.getState().openAlert('산업을 선택해주세요.', "경고");
      return;
    }

    setIsSubmitting(true);
    let mappedIndustry = 'GOLD_MINING';
    if (selectedIndustry === '금 제련업') mappedIndustry = 'GOLD_SMELTING';
    if (selectedIndustry === '제조업') mappedIndustry = 'MANUFACTURING';

    try {
      await CompanyAPI.create({
        companyName: companyName.trim(),
        industryType: mappedIndustry,
      });
    } catch (e) {
      console.warn("회사 생성 API 실패, 목업으로 진행:", e);
    } finally {
      setCompanyInfo(companyName.trim(), selectedIndustry);
      setIsSubmitting(false);
      navigate('/main');
    }
  };

  return (
    <div className="industry-container relative">
      {/* 🌊 ocean.glb 3D 배경 */}
      <OceanBackground />
      <div className="industry-content relative z-10">
        <div className="industry-cards-wrapper flex gap-8">
          {INDUSTRIES.map((ind, idx) => (
            <IndustryCard
              key={ind}
              title={ind}
              iconSrc={INDUSTRY_ICONS[idx]}
              isSelected={selectedIndex === idx}
              isConfirmed={showModal && selectedIndex === idx}
              onSelect={() => handleSelect(ind)}
            />
          ))}
        </div>
      </div>

      {/* ← → 키 안내 — 배경 없이 텍스트만 */}
      {!showModal && (
        <>
          <div className="fixed left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none animate-pulse">
            <span className="text-white/70 text-6xl leading-none">←</span>
            <span className="text-white/50 text-lg font-bold tracking-widest mt-1">이전</span>
          </div>
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none animate-pulse">
            <span className="text-white/70 text-6xl leading-none">→</span>
            <span className="text-white/50 text-lg font-bold tracking-widest mt-1">다음</span>
          </div>
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-pulse">
            <span className="text-white/55 text-lg font-bold tracking-wider">⏎ 선택 확정</span>
          </div>
        </>
      )}

      {/* 회사 이름 모달 — 카드 클릭/Enter 시만 */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>회사 이름 설정</h3>
            <p className="modal-desc">운영할 회사의 이름을 입력해주세요.</p>
            <input
              type="text"
              className="modal-input"
              placeholder="예: SSAFY"
              value={companyName}
              autoFocus
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            <p style={{ fontSize: '13px', color: '#6c757d', alignSelf: 'flex-start', margin: '-16px 0 20px 4px' }}>
              * 한 번 설정한 이름은 이후에 수정할 수 없습니다.
            </p>
            <div className="modal-buttons">
              <button className="modal-cancel-btn" onClick={() => {
                setShowModal(false);
                setCompanyName('');
              }}>취소</button>
              <button
                className="modal-confirm-btn"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
