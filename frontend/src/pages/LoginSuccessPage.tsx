import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';

export const LoginSuccessPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    localStorage.setItem('accessToken', token);
    localStorage.removeItem('isGuest');

    // 이미 회사가 있으면 /main, 없으면 /industry-selection
    apiClient.get('/companies/me')
      .then(() => navigate('/main', { replace: true }))
      .catch(() => navigate('/industry-selection', { replace: true }));
  }, [navigate]);

  return null;
};
