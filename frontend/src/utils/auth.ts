/**
 * 管理员认证工具
 */

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

export interface AdminUser {
  _id: string;
  username: string;
  role: 'admin' | 'user';
  email?: string;
}

/**
 * 保存登录信息
 */
export function setAuth(token: string, user: AdminUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * 获取 token
 */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * 获取当前用户
 */
export function getUser(): AdminUser | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  const user = getUser();
  return !!(token && user && user.role === 'admin');
}

/**
 * 登出
 */
export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // 清除旧的 mock auth 数据
  localStorage.removeItem('mockUserId');
  localStorage.removeItem('mockUserRole');
}

/**
 * 检查 token 是否过期（简单检查）
 */
export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;
  
  try {
    // JWT 格式: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    
    if (!exp) return false; // 没有过期时间，假设不过期
    
    // exp 是秒级时间戳
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

