import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(true);
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 获取当前用户
  const user = getUser();

  // Determine active state based on current path
  const isAgentsActive = location.pathname === '/';
  const searchParams = new URLSearchParams(location.search);
  const currentStyle = searchParams.get('style') || 'all';

  const isVoiceModelsActive = location.pathname === '/voice-models';
  const isStatsActive = location.pathname === '/stats';
  const isUsersActive = location.pathname === '/users';
  const isApiDocsActive = location.pathname === '/api-docs';
  const isSettingsActive = location.pathname === '/settings';

  // 登出处理
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20">
      {/* Sidebar */}
      <aside className="w-64 glass flex-shrink-0 flex flex-col transition-all duration-300 shadow-soft border-r-0">
        <div className="h-20 flex items-center justify-center px-6 border-b border-gray-200/50 bg-gradient-to-r from-primary-600 to-purple-600">
           <div className="flex items-center gap-3">
             <div className="relative w-10 h-10 flex-shrink-0">
               <img 
                 src="/logo.png" 
                 alt="Clingai Logo" 
                 className="w-10 h-10 rounded-lg object-cover absolute inset-0"
                 onError={(e) => {
                   (e.target as HTMLImageElement).style.display = 'none';
                 }}
               />
             <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                 <span className="text-2xl font-extrabold text-white">C</span>
               </div>
             </div>
             <h1 className="text-xl font-bold tracking-wide text-white">Clingai-控制台</h1>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
           {/* Agents Menu Group */}
           <div>
             <button
               onClick={() => setAgentsMenuOpen(!agentsMenuOpen)}
               className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                 isAgentsActive && currentStyle === 'all'
                   ? 'text-primary-700 bg-gradient-to-r from-primary-50 to-purple-50 shadow-sm border border-primary-200/50' 
                   : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900'
               }`}
             >
               <div className="flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                 </svg>
                 <span>AI 主播管理</span>
               </div>
               <svg 
                 xmlns="http://www.w3.org/2000/svg" 
                 className={`h-4 w-4 transform transition-transform text-gray-400 ${agentsMenuOpen ? 'rotate-90' : ''}`} 
                 viewBox="0 0 20 20" 
                 fill="currentColor"
               >
                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
               </svg>
             </button>

             {agentsMenuOpen && (
               <div className="mt-2 ml-6 space-y-1 border-l-2 border-primary-200/50 pl-4">
                 <button
                   onClick={() => navigate('/')} 
                   className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                     isAgentsActive && (currentStyle === 'all' || !currentStyle)
                       ? 'text-primary-700 bg-gradient-to-r from-primary-100 to-purple-100 shadow-sm border border-primary-200/50'
                       : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                   }`}
                 >
                   大厅 (All)
                 </button>
                 <button
                   onClick={() => navigate('/?style=realistic')} 
                   className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                     isAgentsActive && currentStyle === 'realistic'
                       ? 'text-primary-700 bg-gradient-to-r from-primary-100 to-purple-100 shadow-sm border border-primary-200/50'
                       : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                   }`}
                 >
                   真人风格
                 </button>
                 <button
                   onClick={() => navigate('/?style=anime')} 
                   className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                     isAgentsActive && currentStyle === 'anime'
                       ? 'text-primary-700 bg-gradient-to-r from-primary-100 to-purple-100 shadow-sm border border-primary-200/50'
                       : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                   }`}
                 >
                   卡通风格
                 </button>
               </div>
             )}
           </div>

           {/* Stats Menu */}
           <button
             onClick={() => navigate('/stats')}
             className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
               isStatsActive
                 ? 'text-primary-700 bg-gradient-to-r from-primary-50 to-purple-50 shadow-sm border border-primary-200/50'
                 : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900'
             }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
             </svg>
             ROI 数据统计
           </button>

           {/* Voice Models Menu Group */}
           <div className="pt-2">
             <button
               onClick={() => setVoiceMenuOpen(!voiceMenuOpen)}
               className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900 transition-all duration-200"
             >
               <div className="flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                 </svg>
                 <span>Voice 模板</span>
               </div>
               <svg 
                 xmlns="http://www.w3.org/2000/svg" 
                 className={`h-4 w-4 transform transition-transform text-gray-400 ${voiceMenuOpen ? 'rotate-90' : ''}`} 
                 viewBox="0 0 20 20" 
                 fill="currentColor"
               >
                 <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
               </svg>
             </button>
             
             {voiceMenuOpen && (
               <div className="mt-2 ml-6 space-y-1 border-l-2 border-primary-200/50 pl-4">
                 <button
                   onClick={() => navigate('/voice-models')} 
                   className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                     isVoiceModelsActive
                       ? 'text-primary-700 bg-gradient-to-r from-primary-100 to-purple-100 shadow-sm border border-primary-200/50'
                       : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
                   }`}
                 >
                   模型同步 / 收藏
                 </button>
               </div>
             )}
           </div>

           {/* Users Menu */}
           <button
             onClick={() => navigate('/users')}
             className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isUsersActive
                  ? 'text-primary-700 bg-gradient-to-r from-primary-50 to-purple-50 shadow-sm border border-primary-200/50'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900'
              }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
             用户管理
           </button>

           {/* API Docs Menu */}
           <button
             onClick={() => navigate('/api-docs')}
             className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isApiDocsActive
                  ? 'text-primary-700 bg-gradient-to-r from-primary-50 to-purple-50 shadow-sm border border-primary-200/50'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900'
              }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
             接口文档
           </button>

           {/* Settings Menu */}
           <button
             onClick={() => navigate('/settings')}
             className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isSettingsActive
                  ? 'text-primary-700 bg-gradient-to-r from-primary-50 to-purple-50 shadow-sm border border-primary-200/50'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-50/50 hover:text-gray-900'
              }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
             系统设置
           </button>
        </nav>
        
        {/* 用户信息和登出 */}
        <div className="p-5 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/80 to-gray-100/50 backdrop-blur-sm relative">
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-white/50 rounded-lg p-2 -m-2 transition-colors"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ring-white/50">
                    {user?.username?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="overflow-hidden flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{user?.username || 'Admin'}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email || '管理员'}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
            
            {/* 下拉菜单 */}
            {showUserMenu && (
              <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  退出登录
                </button>
              </div>
            )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="min-h-full">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
};

export default Layout;
