import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const navigate = useNavigate();

  const handleLogin = () => {
    // 💡 [백엔드 연동: 구글 로그인 요청]
    // API 명세서: GET /api/v1/auth/google/login
    // 실제 구현 시 아래 주석을 풀고 백엔드 주소로 이동해주세요.
    // window.location.href = 'http://localhost:8080/api/v1/auth/google/login';

    alert('실제 구현 시 GET /api/v1/auth/google/login 으로 리다이렉트 됩니다.');
    navigate('/industry-selection');
  };

  const handleGuestMode = () => {
    navigate('/industry-selection');
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="logo-wrapper">
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

