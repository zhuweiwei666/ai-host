import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, isTokenExpired, logout } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由保护组件
 * 未登录时重定向到登录页
 * 注意：token 过期只在路由首次加载时检查一次，避免正常操作时被踢出
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const hasCheckedExpiry = useRef(false);

  // 只在组件首次挂载时检查 token 是否过期
  useEffect(() => {
    if (!hasCheckedExpiry.current && isTokenExpired()) {
      hasCheckedExpiry.current = true;
      logout();
      window.location.href = '/login';
    }
  }, []);

  // 检查是否已认证（这个检查是快速的，不会登出用户）
  if (!isAuthenticated()) {
    // 保存当前路径，登录后可以跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

