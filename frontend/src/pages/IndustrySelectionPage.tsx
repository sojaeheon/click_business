import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
        <div className="industry-cards-wrapper">
          <div className="industry-card" onClick={() => handleSelect('금광업')}>
            <h2 className="industry-title">금광업</h2>
            <div className="industry-icon-wrapper">
              <span className="industry-icon">금광석</span>
            </div>
          </div>

          <div className="industry-card" onClick={() => handleSelect('금 제련업')}>
            <h2 className="industry-title">금 제련업</h2>
            <div className="industry-icon-wrapper">
              <span className="industry-icon">금괴</span>
            </div>
          </div>

          <div className="industry-card" onClick={() => handleSelect('제조업')}>
            <h2 className="industry-title">제조업</h2>
            <div className="industry-icon-wrapper">
              <span className="industry-icon">광산 드릴</span>
            </div>
          </div>
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
