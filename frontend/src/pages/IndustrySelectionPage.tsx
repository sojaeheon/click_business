import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from "../store/gameStore";
import { useAlertStore } from "../store/useAlertStore";
import { preloadGameModels } from "../app/components/game/preload";
import { CompanyAPI } from "../api/gameApi";

const IndustryCard = ({ title, iconLabel, onSelect, isSelected }: {
  title: string;
  iconLabel: string;
  onSelect: () => void;
  isSelected?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const active = isSelected || isHovered;
  const bgImage = active ? "/ui_icons/Button_Exit_Blue.png" : "/ui_icons/Button_Exit_Disable.png";

  return (
    <div
      className={`industry-card flex flex-col items-center justify-start cursor-pointer transition-transform hover:-translate-y-2 hover:shadow-2xl ${isSelected ? 'scale-105' : ''}`}
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

      <div className={`industry-icon-wrapper rounded-full p-8 shadow-inner border transition-all ${isSelected ? 'bg-blue-100 border-blue-400 ring-4 ring-blue-300' : 'bg-slate-100 border-slate-200'}`}>
        <span className="industry-icon text-3xl font-black text-slate-500">{iconLabel}</span>
      </div>
    </div>
  );
};

export const IndustrySelectionPage = () => {
  const navigate = useNavigate();
  const setCompanyInfo = useGameStore(state => state.setCompanyInfo);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    preloadGameModels();
  }, []);

  const handleSelect = (industry: string) => {
    setSelectedIndustry(industry);
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
    <div className="industry-container">
      <div className="industry-content">
        <div className="industry-cards-wrapper flex gap-8">
          <IndustryCard title="금광업" iconLabel="금광석" isSelected={selectedIndustry === '금광업'} onSelect={() => handleSelect('금광업')} />
          <IndustryCard title="금 제련업" iconLabel="금괴" isSelected={selectedIndustry === '금 제련업'} onSelect={() => handleSelect('금 제련업')} />
          <IndustryCard title="제조업" iconLabel="광산 드릴" isSelected={selectedIndustry === '제조업'} onSelect={() => handleSelect('제조업')} />
        </div>
      </div>

      {selectedIndustry && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>회사 이름 설정</h3>
            <p className="modal-desc">운영할 회사의 이름을 입력해주세요.</p>
            <input
              type="text"
              className="modal-input"
              placeholder="예: SSAFY"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
            <p style={{ fontSize: '13px', color: '#6c757d', alignSelf: 'flex-start', margin: '-16px 0 20px 4px' }}>
              * 한 번 설정한 이름은 이후에 수정할 수 없습니다.
            </p>
            <div className="modal-buttons">
              <button className="modal-cancel-btn" onClick={() => {
                setSelectedIndustry(null);
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
