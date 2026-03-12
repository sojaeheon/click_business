import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const IndustryCard = ({ title, iconLabel, onSelect }: { title: string; iconLabel: string; onSelect: () => void }) => {
  const [isHovered, setIsHovered] = useState(false);
  const bgImage = isHovered ? "/ui_icons/Button_Exit_Blue.png" : "/ui_icons/Button_Exit_Disable.png";

  return (
    <div
      className="industry-card flex flex-col items-center justify-start cursor-pointer transition-transform hover:-translate-y-2 hover:shadow-2xl"
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 타이틀 버튼 (이미지 배경) */}
      <div className="relative w-48 h-16 flex items-center justify-center -mt-8 mb-6">
        <img src={bgImage} alt="Title BG" className="absolute inset-0 w-full h-full object-fill drop-shadow-md transition-all" />
        <span className={`relative font-bold text-lg tracking-wide ${isHovered ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]' : 'text-gray-300 drop-shadow'}`}>
          {title}
        </span>
      </div>

      <div className="industry-icon-wrapper rounded-full bg-slate-100 p-8 shadow-inner border border-slate-200">
        <span className="industry-icon text-3xl font-black text-slate-500">{iconLabel}</span>
      </div>
    </div>
  );
};

export const IndustrySelectionPage = () => {
  const navigate = useNavigate();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');

  const handleSelect = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const handleConfirm = () => {
    if (companyName.trim() === '') {
      alert('회사 이름을 입력해주세요.');
      return;
    }
    // 💡 [백엔드 연동: 기업 설정 내역 전송]
    // API 명세서: POST /api/v1/companies
    // - 산업 설정 parameter: { company_id, industry_type }
    // - 이름 설정 parameter: { company_id, company_name }
    // (이곳에서 fetch/axios를 통해 위 값을 백엔드로 전송하시면 됩니다.)

    navigate('/main');
  };

  return (
    <div className="industry-container">
      <div className="industry-content">
        <div className="industry-cards-wrapper flex gap-8">
          <IndustryCard title="금광업" iconLabel="금광석" onSelect={() => handleSelect('금광업')} />
          <IndustryCard title="금 제련업" iconLabel="금괴" onSelect={() => handleSelect('금 제련업')} />
          <IndustryCard title="제조업" iconLabel="광산 드릴" onSelect={() => handleSelect('제조업')} />
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
              <button className="modal-confirm-btn" onClick={handleConfirm}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
