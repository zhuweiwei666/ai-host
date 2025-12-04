import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated, isTokenExpired, logout } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由保护组件
 * 未登录或 token 过期时重定向到登录页
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  // 检查 token 是否过期
  if (isTokenExpired()) {
    logout(); // 清除过期的登录信息
  }

  // 检查是否已认证
  if (!isAuthenticated()) {
    // 保存当前路径，登录后可以跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

