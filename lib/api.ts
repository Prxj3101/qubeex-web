import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const code = error.response?.data?.code;

        if (status === 403 && code === 'INSTITUTION_SUSPENDED') {
            localStorage.removeItem('token');
            localStorage.removeItem('auth-storage');
            if (typeof window !== 'undefined' && window.location.pathname !== '/suspended') {
                window.location.href = '/suspended';
            }
            return Promise.reject(error);
        }

        if (status === 401) {
            localStorage.removeItem('token');
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
