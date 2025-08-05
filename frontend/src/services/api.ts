import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { apiLogger } from '../config/logger';

const api: AxiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    apiLogger.info('API Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      timeout: config.timeout,
      hasToken: !!token
    });
    
    return config;
  },
  (error) => {
    apiLogger.error('API Request Error', {
      error: error.message,
      config: error.config
    });
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => {
    apiLogger.info('API Response', {
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      statusText: response.statusText,
      responseTime: response.headers['x-response-time'] || 'unknown'
    });
    return response;
  },
  (error) => {
    apiLogger.error('API Response Error', {
      method: error.config?.method?.toUpperCase(),
      url: error.config?.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      error: error.message,
      responseData: error.response?.data
    });
    
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email: string, password: string) => {
    apiLogger.info('Login attempt', { email });
    return api.post('/auth/login', { email, password });
  },
  
  register: (name: string, email: string, password: string, role?: string) => {
    apiLogger.info('Registration attempt', { email, role });
    return api.post('/auth/register', { name, email, password, role });
  },
  
  getProfile: () => {
    apiLogger.info('Fetching user profile');
    return api.get('/auth/profile');
  },
  
  updateProfile: (data: any) => {
    apiLogger.info('Updating user profile', { fields: Object.keys(data) });
    return api.put('/auth/profile', data);
  },
  
  changePassword: (currentPassword: string, newPassword: string) => {
    apiLogger.info('Password change attempt');
    return api.put('/auth/change-password', { currentPassword, newPassword });
  },
};

export const postsAPI = {
  getAllPosts: (params?: any) => {
    apiLogger.info('Fetching all posts', { params });
    return api.get('/posts', { params });
  },
  
  getUserPosts: (params?: any) => {
    apiLogger.info('Fetching user posts', { params });
    return api.get('/posts/user', { params });
  },
  
  getPostById: (id: string) => {
    apiLogger.info('Fetching post by ID', { postId: id });
    return api.get(`/posts/${id}`);
  },
  
  createPost: (data: FormData) => {
    apiLogger.info('Creating new post');
    return api.post('/posts', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  updatePost: (id: string, data: FormData) => {
    apiLogger.info('Updating post', { postId: id });
    return api.put(`/posts/${id}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  deletePost: (id: string) => {
    apiLogger.info('Deleting post', { postId: id });
    return api.delete(`/posts/${id}`);
  },
  
  incrementViews: (id: string) => {
    apiLogger.info('Incrementing post views', { postId: id });
    return api.post(`/posts/${id}/views`);
  },
  
  incrementLikes: (id: string) => {
    apiLogger.info('Incrementing post likes', { postId: id });
    return api.post(`/posts/${id}/likes`);
  },
};

export const claimsAPI = {
  checkPostsAlreadyClaimed: (postIds: string[]) => {
    apiLogger.info('Checking if posts are already claimed', { postIds });
    return api.post('/claims/check-posts', { postIds });
  },
  
  submitClaim: (data: FormData) => {
    apiLogger.info('Submitting new claim');
    return api.post('/claims', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getUserClaims: (params?: any) => {
    apiLogger.info('Fetching user claims', { params });
    return api.get('/claims/user', { params });
  },
  
  getAllClaims: (params?: any) => {
    apiLogger.info('Fetching all claims', { params });
    return api.get('/claims', { params });
  },
  
  getClaimById: (id: string) => {
    apiLogger.info('Fetching claim by ID', { claimId: id });
    return api.get(`/claims/${id}`);
  },
  
  applyDeduction: (id: string, data: any) => {
    apiLogger.info('Applying deduction to claim', { claimId: id, deductionData: data });
    return api.post(`/claims/${id}/deduction`, data);
  },
  
  respondToDeduction: (id: string, accepted: boolean) => {
    apiLogger.info('Responding to deduction', { claimId: id, accepted });
    return api.post(`/claims/${id}/respond`, { accepted });
  },
  
  accountApprove: (id: string) => {
    apiLogger.info('Account approving claim', { claimId: id });
    return api.post(`/claims/${id}/approve`);
  },
  
  accountReject: (id: string, reason: string) => {
    apiLogger.info('Account rejecting claim', { claimId: id, reason });
    return api.post(`/claims/${id}/reject`, { reason });
  },
  
  adminApprove: (id: string) => {
    apiLogger.info('Admin final approving claim', { claimId: id });
    return api.post(`/claims/${id}/final-approve`);
  },
  
  lockClaim: (id: string) => {
    apiLogger.info('Locking claim', { claimId: id });
    return api.post(`/claims/${id}/lock`);
  },
  
  unlockClaim: (id: string) => {
    apiLogger.info('Unlocking claim', { claimId: id });
    return api.post(`/claims/${id}/unlock`);
  },
  
  getClaimStats: () => {
    apiLogger.info('Fetching claim statistics');
    return api.get('/claims/stats');
  },
};

export const settingsAPI = {
  getSettings: () => {
    apiLogger.info('Fetching settings');
    return api.get('/settings');
  },
  
  getCurrentSettings: () => {
    apiLogger.info('Fetching current settings');
    return api.get('/settings/current');
  },
  
  getAdminSettings: () => {
    apiLogger.info('Fetching admin settings');
    return api.get('/admin/settings');
  },
  
  updateAdminSettings: (data: any) => {
    apiLogger.info('Updating admin settings', { settings: Object.keys(data) });
    return api.put('/admin/settings', data);
  },
  
  getAdminStats: () => {
    apiLogger.info('Fetching admin statistics');
    return api.get('/admin/stats');
  },
};

export const uploadFile = async (file: File): Promise<string> => {
  apiLogger.info('Uploading file', { fileName: file.name, fileSize: file.size });
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  
  apiLogger.info('File upload successful', { fileName: file.name, url: response.data.url });
  
  return response.data.url;
};

export default api; 