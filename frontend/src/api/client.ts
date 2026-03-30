import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // refresh token 쿠키 자동 전송
    headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: accessToken 헤더 주입 ──────────────
apiClient.interceptors.request.use((config: any) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ── Response Interceptor: 401 시 토큰 재발급 → 재요청 ────────
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
    (res: any) => res,
    async (error: any) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // 재발급 대기 큐에 등록
                return new Promise<string>((resolve) => {
                    refreshQueue.push(resolve);
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const { data } = await axios.post<{ access: string }>(
                    `${BASE_URL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );
                const newToken = data.access;
                sessionStorage.setItem('accessToken', newToken);

                // 대기 중인 요청들에 새 토큰 전달
                refreshQueue.forEach((cb) => cb(newToken));
                refreshQueue = [];

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch {
                // 재발급 실패 → 강제 로그아웃
                sessionStorage.removeItem('accessToken');
                refreshQueue = [];
                window.location.href = '/';
                return Promise.reject(error);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);
