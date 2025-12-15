import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Agents from './pages/Agents';
import EditAgent from './pages/EditAgent';
import ChatPage from './pages/ChatPage';
import UserList from './pages/UserList'; 
import AgentStats from './pages/AgentStats';
import VoiceModelsPage from './pages/VoiceModelsPage';
import ApiDocs from './pages/ApiDocs';
import AdminLogin from './pages/AdminLogin';
import Settings from './pages/Settings';
import OperationsDashboard from './pages/OperationsDashboard';
import SpatialAvatarLab from './pages/SpatialAvatarLab';
import MyAgents from './pages/MyAgents';
import CreateUserAgent from './pages/CreateUserAgent';
import ReviewAgents from './pages/ReviewAgents';
import StoryPage from './pages/StoryPage';
import './index.css';

// Suppress browser extension errors in console
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    if (errorMessage.includes('contentScript.bundle.js') && 
        errorMessage.includes('Access to storage') &&
        errorMessage.includes('is not allowed from this context')) {
      event.preventDefault();
      return;
    }
  });

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    if (errorMessage.includes('contentScript.bundle.js') && 
        errorMessage.includes('Access to storage') &&
        errorMessage.includes('is not allowed from this context')) {
      return;
    }
    originalError.apply(console, args);
  };
}

// 在开发环境禁用 StrictMode 以避免双重渲染导致的性能问题
// 生产环境保留 StrictMode 以帮助发现潜在问题
const isDevelopment = import.meta.env.DEV;
const App = (
    <BrowserRouter>
      <Routes>
        {/* 登录页面 - 无需认证 */}
        <Route path="/login" element={<AdminLogin />} />
        
        {/* 受保护的路由 - 需要管理员登录 */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/" element={<Agents />} />
          <Route path="/stats" element={<AgentStats />} />
          <Route path="/users" element={<UserList />} />
          <Route path="/voice-models" element={<VoiceModelsPage />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/operations" element={<OperationsDashboard />} />
          <Route path="/avatar-lab" element={<SpatialAvatarLab />} />
          {/* 用户创建角色 */}
          <Route path="/my-agents" element={<MyAgents />} />
          <Route path="/my-agents/create" element={<CreateUserAgent />} />
          <Route path="/my-agents/edit/:id" element={<CreateUserAgent />} />
          {/* 管理员审核 */}
          <Route path="/review-agents" element={<ReviewAgents />} />
        </Route>
        
        {/* 其他受保护页面 */}
        <Route path="/create" element={
          <ProtectedRoute>
            <EditAgent />
          </ProtectedRoute>
        } />
        <Route path="/edit/:id" element={
          <ProtectedRoute>
            <EditAgent />
          </ProtectedRoute>
        } />
        <Route path="/chat/:id" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />
        <Route path="/story/:id" element={
          <ProtectedRoute>
            <StoryPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  isDevelopment ? App : <React.StrictMode>{App}</React.StrictMode>
);
