import React, { useEffect, useState } from 'react';
import { Agent, getAgents, scrapeAgents, updateAgent, duplicateAgent } from '../api';
import AgentCard from '../components/AgentCard';
import VoiceModelManager from '../components/VoiceModelManager';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Agents: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  // Remove duplicate state if it belongs to layout (voiceMenuOpen), 
  // but activePanel is local to this page content now.
  const [activePanel] = useState<'agents' | 'voiceModels'>('agents');
  
  // Filter state: 'all', 'online', 'offline'
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');

  // Scraper UI states
  const [showScrapeDialog, setShowScrapeDialog] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentStyle = searchParams.get('style') || 'all';

  const fetchAgents = async () => {
    try {
      const res = await getAgents({ style: currentStyle === 'all' ? undefined : currentStyle });
      const raw: any = res.data;
      
      let list: Agent[] = [];
      
      if (Array.isArray(raw)) {
        list = raw;
      } else if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
        list = raw.data;
      } else {
        console.error('Unexpected /api/agents response:', raw);
      }
      
      setAgents(list);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      // On error, set to empty array to avoid white screen
      setAgents([]);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [currentStyle]); // Re-fetch when style changes

  const handleScrape = async () => {
    setIsScraping(true);
    try {
      await scrapeAgents(scrapeUrl);
      alert('Scraping started in background. Please refresh the list in a moment to see new agents.'); 
      setShowScrapeDialog(false);
      setScrapeUrl('');
      setTimeout(fetchAgents, 5000); 
    } catch (error) {
      alert('Scrape failed to start');
      console.error(error);
    } finally {
      setIsScraping(false);
    }
  };

  const handleToggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'online' ? 'offline' : 'online';
    try {
      setAgents(prev => prev.map(a => a._id === agent._id ? { ...a, status: newStatus } : a));
      await updateAgent(agent._id!, { ...agent, status: newStatus });
    } catch (error) {
      console.error('Failed to update status', error);
      fetchAgents();
    }
  };

  const handleDuplicate = async (agent: Agent) => {
    try {
      await duplicateAgent(agent._id!);
      alert(`已成功复制 ${agent.name}！`);
      fetchAgents(); // Refresh list to show the duplicated agent
    } catch (error: any) {
      console.error('Failed to duplicate agent', error);
      const errorMessage = error?.response?.data?.message || error?.message || '复制失败，请重试';
      alert(errorMessage);
    }
  };

  const filteredAgents = agents.filter(agent => {
    // Filter by status
    if (filterStatus !== 'all' && agent.status !== filterStatus) {
      return false;
    }
    
    // Filter by style (double-check even though backend should filter)
    if (currentStyle !== 'all') {
      // Default to 'realistic' if style is undefined (matching backend model default)
      const agentStyle = agent.style || 'realistic';
      if (agentStyle !== currentStyle) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Removed Sidebar from here */}
      
      {activePanel === 'agents' && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 px-2">
            <div className="space-y-2">
                <h2 className="text-4xl font-bold gradient-text">
                  {currentStyle === 'anime' ? 'AI 主播列表 (卡通风格)' : currentStyle === 'realistic' ? 'AI 主播列表 (真人风格)' : 'AI 主播列表'}
                </h2>
                <p className="text-base text-gray-600 font-medium">管理您的 AI 虚拟形象与配置</p>
        </div>

            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              {/* Status Filter Tabs */}
              <div className="flex glass p-1.5 rounded-xl shadow-soft border border-white/50">
           <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    filterStatus === 'all' 
                      ? 'bg-gradient-to-r from-primary-500 to-purple-600 text-white shadow-lg shadow-primary-500/30' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
           >
                  大厅 (All)
           </button>
             <button
                  onClick={() => setFilterStatus('online')}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    filterStatus === 'online' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  已上架
             </button>
                 <button
                  onClick={() => setFilterStatus('offline')}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                    filterStatus === 'offline' 
                      ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg shadow-gray-500/30' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                 >
                  未上架
                 </button>
               </div>
        
              <div className="flex gap-3 ml-auto">
                <button
                    onClick={() => setShowScrapeDialog(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 glass rounded-xl shadow-soft text-sm font-semibold text-gray-700 hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 hover:scale-105 active:scale-95 border border-white/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    导入/爬取
                </button>
                <button
                  onClick={() => navigate('/create')}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-105 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  创建主播
                </button>
              </div>
            </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
            {filteredAgents.map((agent, index) => (
              <div key={agent._id} className="animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
                <AgentCard 
                  agent={agent} 
                  onDelete={fetchAgents} 
                  onToggleStatus={() => handleToggleStatus(agent)} 
                  onDuplicate={() => handleDuplicate(agent)}
                />
              </div>
                ))}
            {filteredAgents.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-32 glass rounded-2xl border-2 border-dashed border-gray-300/50 hover:border-primary-300/50 transition-all duration-300 shadow-soft">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-purple-100 flex items-center justify-center mb-6 shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                <p className="text-xl font-bold text-gray-700 mb-2">
                    {filterStatus === 'all' ? '暂无主播' : filterStatus === 'online' ? '暂无上架主播' : '暂无未上架主播'}
                </p>
                <p className="text-sm text-gray-500 mb-6">开始创建您的第一个 AI 虚拟形象吧</p>
                {filterStatus === 'all' && (
                    <button 
                      onClick={() => navigate('/create')} 
                      className="px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      创建第一个 AI 主播
                    </button>
                )}
                  </div>
                )}
              </div>
            </div>
          )}

      {/* Note: VoiceModelManager is rendered here if activePanel is voiceModels. 
          Since we moved Navigation to Layout, we need a way to switch activePanel from Sidebar?
          The user wants to navigate to /users.
          If we want to switch between 'AI Agent' list and 'Voice Model' list on the same page (/),
          we can keep local state. But the Sidebar in Layout needs to know.
          
          Actually, the request was "Freeze sidebar".
          So navigation should be route based.
          
          Let's update Layout to have routes: / (Agents), /voice-models (VoiceModels), /users (Users).
          So I will split VoiceModels into its own page or keep it here?
          
          For simplicity, I will keep Agents.tsx handling both for now, BUT the sidebar in Layout.tsx
          has a link for "Voice Models" that currently does navigate('/').
          I should probably move VoiceModels to a route /voice-models.
      */}

          {activePanel === 'voiceModels' && (
            <div className="animate-fade-in">
               <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Voice 模型库</h2>
                    <p className="text-sm text-gray-500 mt-1">同步 Fish Audio 官方模型并管理收藏列表</p>
               </div>
               <VoiceModelManager />
            </div>
          )}

      {/* Scrape Dialog */}
      {showScrapeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="glass rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-in border border-white/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">导入 / 爬取</h3>
                <p className="text-sm text-gray-500 mt-1">从支持的网站导入角色数据</p>
              </div>
            </div>
            
            <input 
              type="url" 
              placeholder="https://candy.ai/character/..." 
              className="w-full glass border border-white/50 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowScrapeDialog(false)}
                className="px-6 py-2.5 text-gray-700 hover:bg-gray-100/80 rounded-xl font-semibold transition-all duration-200"
                disabled={isScraping}
              >
                取消
              </button>
              <button 
                onClick={handleScrape}
                className="px-6 py-2.5 bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 text-white rounded-xl hover:from-primary-700 hover:via-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                disabled={isScraping}
              >
                {isScraping && (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isScraping ? '爬取中...' : '开始爬取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;
