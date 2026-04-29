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

export const dashboardAPI = {
  getStats: () => apiClient.get('/dashboard/stats'),
};

export const companiesAPI = {
  list: (params = {}) => apiClient.get('/companies', { params }),
  search: (query, type) => {
    const params = { query };
    if (type) params.type = type;
    return apiClient.get('/companies/search', { params });
  },
  getProfile: (bin) => apiClient.get(`/companies/${bin}/profile`),
  getTrustScore: (bin) => apiClient.get(`/participants/${bin}/trust-score`),
};

export const contractsAPI = {
  list: (params = {}) => apiClient.get('/contracts', { params }),
  getById: (contractId) => apiClient.get(`/contracts/${contractId}`),
};

export const complaintsAPI = {
  list: (params = {}) => apiClient.get('/complaints', { params }),
  getById: (complaintId) => apiClient.get(`/complaints/${complaintId}`),
};

export const announcementsAPI = {
  getById: (announcementId) => apiClient.get(`/announcements/${announcementId}`),
};

export const bidsAPI = {
  getById: (applicationId) => apiClient.get(`/bids/${applicationId}`),
};

export const lotsAPI = {
  getById: (lotId) => apiClient.get(`/lots/${lotId}`),
};

export const adminAPI = {
  getOptions: () => apiClient.get('/admin/options'),
  listEntity: (entity) => apiClient.get(`/admin/${entity}`),
  createEntity: (entity, payload) => apiClient.post(`/admin/${entity}`, payload),
  updateEntity: (entity, itemId, payload) => apiClient.put(`/admin/${entity}/${itemId}`, payload),
  deleteEntity: (entity, itemId) => apiClient.delete(`/admin/${entity}/${itemId}`),
  getTrustScoreSettings: () => apiClient.get('/admin/trust-score-settings'),
  updateTrustScoreSettings: (payload) => apiClient.put('/admin/trust-score-settings', payload),
  resetTrustScoreSettings: () => apiClient.post('/admin/trust-score-settings/reset'),
};

export default apiClient;
