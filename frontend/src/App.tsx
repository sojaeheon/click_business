// React import removed to resolve TS6133
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';

const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    // 1. 추후 아래 URL을 백엔드에서 제공하는 실제 Google OAuth 로그인 엔드포인트로 변경하세요.
    // window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    
    // 현재는 버튼 클릭 시 산업 선택 페이지로 이동한다고 가정하고 구현합니다.
    alert('실제 구현 시 구글 OAuth 로그인 페이지로 리다이렉트 됩니다.');
    navigate('/industry-selection');
  };

  const handleGuestMode = () => {
    navigate('/industry-selection');
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="logo-wrapper">
          {/*
            [로고 첨부 방법]
            1. 준비하신 로고 사진 파일의 이름을 'logo.png'로 변경하세요.
            2. 이 파일을 frontend/public/ 폴더 안에 복사하여 넣으세요.
            3. 그러면 아래 img 태그가 해당 이미지를 자동으로 불러옵니다.
          */}
          <img src="/logo.png" alt="딸깍 비즈니스 로고" className="logo-image" />
        </div>

        <div className="button-wrapper">
          <button className="custom-button" onClick={handleLogin}>
            로그인
          </button>
          <button className="custom-button" onClick={handleGuestMode}>
            게스트모드
          </button>
        </div>
      </div>
    </div>
  );
};

const IndustrySelectionPage = () => {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
      산업 선택 페이지 (임시)
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/industry-selection" element={<IndustrySelectionPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
