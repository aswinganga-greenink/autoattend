import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000/api/v1';

export const api = axios.create({
    baseURL: API_URL,
});

// Intercept requests to add the Authorization header if a token exists
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);
