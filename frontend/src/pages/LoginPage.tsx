import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/services';

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

const handleGuestMode = async () => {
    const { data } = await authApi.createGuest();
    localStorage.setItem('accessToken', data.data.accessToken);
    navigate('/industry-selection');
};

  return (
    <div className="login-container">
      <div className="login-content">
        <div className="logo-wrapper">
          <img src="/logo.png" alt="딸깍 비즈니스 로고" className="logo-image" />
        </div>

        <div className="button-wrapper flex flex-col items-center gap-4 mt-8">
          <button
            className="relative w-64 h-20 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer bg-transparent border-none p-0"
            onClick={handleLogin}
          >
            <img src="/ui_icons/Button_Play_Blue.png" alt="Login BG" className="absolute inset-0 w-full h-full object-fill drop-shadow-md" />
            <span className="relative text-white font-bold text-xl tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">로그인</span>
          </button>
          <button
            className="relative w-64 h-20 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center cursor-pointer bg-transparent border-none p-0"
            onClick={handleGuestMode}
          >
            <img src="/ui_icons/Button_Exit_Yellow.png" alt="Guest BG" className="absolute inset-0 w-full h-full object-fill drop-shadow-md" />
            <span className="relative text-white font-bold text-xl tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">게스트모드</span>
          </button>
        </div>
      </div>
    </div>
  );
};

