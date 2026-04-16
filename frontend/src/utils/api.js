import axios from 'axios';
import { getAuthToken } from './auth';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const apiClient = axios.create({
  baseURL: API,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => apiClient.post('/auth/login', { email, password }),
  getMe: () => apiClient.get('/auth/me'),
};

export const companiesAPI = {
  list: (params = {}) => apiClient.get('/companies', { params }),
  search: (query, type) => {
    const params = { query };
    if (type) params.type = type;
    return apiClient.get('/companies/search', { params });
  },
  getProfile: (bin) => apiClient.get(`/companies/${bin}/profile`),
};

export default apiClient;
