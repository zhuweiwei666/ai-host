import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(true);
  const [agentsMenuOpen, setAgentsMenuOpen] = useState(true); // Default open

  // Determine active state based on current path
  const isAgentsActive = location.pathname === '/';
  const searchParams = new URLSearchParams(location.search);
  const currentStyle = searchParams.get('style') || 'all';

  const isVoiceModelsActive = location.pathname === '/voice-models'; // Placeholder path if we split it later
  const isStatsActive = location.pathname === '/stats'; // Stats active state
  const isUsersActive = location.pathname === '/users';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col transition-all duration-300">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
           <div className="flex items-center gap-2 text-indigo-600">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12zm-1-9.243a1 1 0 112 0v4.486a1 1 0 11-2 0V6.757z" clipRule="evenodd" />
             </svg>
             <h1 className="text-xl font-bold tracking-wide">HeartMerge</h1>
           </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
           {/* Agents Menu Group */}
           <div>
             <button
               onClick={() => setAgentsMenuOpen(!agentsMenuOpen)}
               className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                 isAgentsActive && currentStyle === 'all' // Optional: highlight parent if strictly active or contains active child? Usually parent is active if any child is.
                   ? 'text-gray-900 bg-gray-50' 
                   : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
               <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 pl-2">
                 <button
                   onClick={() => navigate('/')} 
                   className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                     isAgentsActive && (currentStyle === 'all' || !currentStyle)
                       ? 'text-indigo-600 bg-indigo-50'
                       : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                   }`}
                 >
                   大厅 (All)
                 </button>
                 <button
                   onClick={() => navigate('/?style=realistic')} 
                   className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                     isAgentsActive && currentStyle === 'realistic'
                       ? 'text-indigo-600 bg-indigo-50'
                       : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                   }`}
                 >
                   真人风格
                 </button>
                 <button
                   onClick={() => navigate('/?style=anime')} 
                   className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                     isAgentsActive && currentStyle === 'anime'
                       ? 'text-indigo-600 bg-indigo-50'
                       : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
             className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors mt-1 ${
               isStatsActive
                 ? 'bg-indigo-50 text-indigo-600'
                 : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
               className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors"
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
               <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 pl-2">
                 <button
                   onClick={() => navigate('/voice-models')} 
                   className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                     isVoiceModelsActive
                       ? 'text-indigo-600 bg-indigo-50'
                       : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
             className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors mt-2 ${
                isUsersActive
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
             用户管理
           </button>
        </nav>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                    A
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-900 truncate">Administrator</p>
                    <p className="text-xs text-gray-500 truncate">admin@ai-host.com</p>
                </div>
            </div>
        </div>
      </aside>

      {/* Main Content Area - This is where pages will be injected */}
      <main className="flex-1 overflow-y-auto bg-gray-50 relative">
        <Outlet /> 
      </main>
    </div>
  );
};

export default Layout;
