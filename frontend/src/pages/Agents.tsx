import React, { useEffect, useState } from 'react';
import { Agent, getAgents, scrapeAgents, updateAgent } from '../api';
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

  const filteredAgents = agents.filter(agent => {
    if (filterStatus === 'all') return true;
    return agent.status === filterStatus; 
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
      {/* Removed Sidebar from here */}
      
      {activePanel === 'agents' && (
        <div className="animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentStyle === 'anime' ? 'AI 主播列表 (卡通风格)' : currentStyle === 'realistic' ? 'AI 主播列表 (真人风格)' : 'AI 主播列表'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">管理您的 AI 虚拟形象与配置</p>
        </div>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              {/* Status Filter Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
           <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
           >
                  大厅 (All)
           </button>
             <button
                  onClick={() => setFilterStatus('online')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'online' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  已上架
             </button>
                 <button
                  onClick={() => setFilterStatus('offline')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${filterStatus === 'offline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                  未上架
                 </button>
               </div>
        
              <div className="flex gap-3 ml-auto">
                <button
                    onClick={() => setShowScrapeDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    导入/爬取
                </button>
                <button
                  onClick={() => navigate('/create')}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  创建主播
                </button>
              </div>
            </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAgents.map((agent) => (
              <AgentCard 
                key={agent._id} 
                agent={agent} 
                onDelete={fetchAgents} 
                onToggleStatus={() => handleToggleStatus(agent)} 
              />
                ))}
            {filteredAgents.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-500 bg-white rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                <p className="text-lg font-medium">
                    {filterStatus === 'all' ? '暂无主播' : filterStatus === 'online' ? '暂无上架主播' : '暂无未上架主播'}
                </p>
                {filterStatus === 'all' && (
                    <button onClick={() => navigate('/create')} className="mt-2 text-indigo-600 hover:text-indigo-500 font-medium">
                        点击创建第一个 AI 主播
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold mb-4">Import / Scrape Agent</h3>
            <p className="text-sm text-gray-500 mb-4">Enter a URL to scrape character data from supported sites (e.g., Candy.ai).</p>
            
            <input 
              type="url" 
              placeholder="https://candy.ai/character/..." 
              className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
            />
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowScrapeDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                disabled={isScraping}
              >
                Cancel
              </button>
              <button 
                onClick={handleScrape}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                disabled={isScraping} // Allow running without URL since it auto-discovers
              >
                {isScraping && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {isScraping ? 'Scraping...' : 'Start Scrape'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Agents;
