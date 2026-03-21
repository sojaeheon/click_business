import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const LoginSuccessPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('accessToken', token);
      localStorage.removeItem('isGuest');
      navigate('/industry-selection', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return null;
};
