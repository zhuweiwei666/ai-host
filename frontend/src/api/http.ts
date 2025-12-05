import axios from "axios";
import { BASE_URL } from "./config";
import { getToken, logout, isTokenExpired } from "../utils/auth";

export const http = axios.create({
  baseURL: BASE_URL,
  timeout: 60000, // 60 秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证 token
http.interceptors.request.use(
  (config) => {
    const token = getToken();
    
    if (token) {
      // 不在请求拦截器中检查 token 过期
      // 让后端来决定 token 是否有效，避免不需要认证的 API 被错误拦截
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理错误和数据解包
http.interceptors.response.use(
  (response) => {
    // 解包标准化的后端响应 { success, data, ... }
    if (
      response?.data &&
      typeof response.data === 'object' &&
      response.data.success === true &&
      Object.prototype.hasOwnProperty.call(response.data, 'data')
    ) {
      return {
        ...response,
        data: response.data.data,
        __meta: response.data,
      };
    }
    return response;
  },
  (error) => {
    // 处理 401 错误 - token 无效或过期
    if (error.response?.status === 401) {
      console.warn('认证失败，请重新登录');
      logout();
      
      // 跳转到登录页（除非已经在登录页）
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
