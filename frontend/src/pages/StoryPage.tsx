import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  StoryParagraph,
  StoryAffection,
  startStory,
  continueStory,
  inputStory,
  restartStory,
  getAgent,
  Agent,
} from '../api';

/**
 * 极简故事页面 - 对话形式
 */

export default function StoryPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<StoryParagraph[]>([]);
  const [affection, setAffection] = useState<StoryAffection>({ level: 0, stage: '陌生', lastChange: 0 });
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  
  // 初始化
  useEffect(() => {
    if (!agentId) return;
    
    const init = async () => {
      try {
        // 获取 agent 信息
        const agentRes = await getAgent(agentId);
        const agentData = agentRes.data?.data || agentRes.data;
        setAgent(agentData);
        
        // 开始故事
        const res = await startStory(agentId);
        setSessionId(res.data.sessionId);
        setParagraphs(res.data.paragraphs);
        if (res.data.affection) {
          setAffection(res.data.affection);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '加载失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [agentId]);
  
  // 滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [paragraphs, generating]);
  
  const handleContinue = async () => {
    if (!sessionId || generating) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const res = await continueStory(sessionId);
      setParagraphs(res.data.paragraphs);
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '生成失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  const handleInput = async (text?: string) => {
    const input = text || userInput.trim();
    if (!sessionId || !input || generating) return;
    
    setGenerating(true);
    setError(null);
    setUserInput('');
    
    try {
      const res = await inputStory(sessionId, input);
      setParagraphs(res.data.paragraphs);
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '发送失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInput();
    }
  };
  
  const handleRestart = async () => {
    if (!agentId) return;
    if (!confirm('确定要重新开始吗？')) return;
    
    try {
      setLoading(true);
      const res = await restartStory(agentId);
      setSessionId(res.data.sessionId);
      setParagraphs(res.data.paragraphs);
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '重新开始失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // 格式化内容
  const formatContent = (content: string) => {
    let formatted = content.replace(/「([^」]+)」/g, '<span class="text-pink-400">"$1"</span>');
    formatted = formatted.replace(/（([^）]+)）/g, '<span class="text-gray-400 italic text-sm">（$1）</span>');
    formatted = formatted.replace(/\(([^)]+)\)/g, '<span class="text-gray-400 italic text-sm">（$1）</span>');
    formatted = formatted.replace(/\[💕内心[：:]([^\]]+)\]/g, '<div class="text-purple-400 italic text-sm mt-1">💕 $1</div>');
    formatted = formatted.replace(/\[🌙身体[：:]([^\]]+)\]/g, '<div class="text-pink-300 italic text-sm mt-1">🌙 $1</div>');
    return formatted;
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }
  
  const avatarUrl = agent?.avatarUrls?.[0] || agent?.avatarUrl;
  
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-base">{agent?.name}</h1>
            <div className="flex items-center justify-center gap-2 text-xs mt-0.5">
              <span className={`px-1.5 py-0.5 rounded ${
                affection.stage === '深爱' ? 'bg-red-500/20 text-red-400' :
                affection.stage === '热恋' ? 'bg-pink-500/20 text-pink-400' :
                affection.stage === '暧昧' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {affection.stage}
              </span>
              <span className="text-gray-500">{affection.level}%</span>
            </div>
          </div>
          
          <button
            onClick={handleRestart}
            className="p-2 -mr-2 hover:bg-white/10 rounded-full transition-colors text-gray-400"
            title="重新开始"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex justify-between items-center">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white p-1">×</button>
        </div>
      )}
      
      {/* 对话区域 */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {paragraphs.map((p, idx) => (
          <div key={idx} className="flex gap-3">
            {/* AI 消息 */}
            {p.source !== 'user_input' ? (
              <>
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={agent?.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {agent?.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 max-w-[85%]">
                  <div 
                    className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-100 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatContent(p.content) }}
                  />
                </div>
              </>
            ) : (
              /* 用户消息 */
              <div className="flex-1 flex justify-end">
                <div className="max-w-[85%]">
                  {p.userInput && (
                    <div className="bg-pink-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 mb-2">
                      {p.userInput}
                    </div>
                  )}
                  <div 
                    className="bg-gray-800 rounded-2xl px-4 py-3 text-gray-100 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatContent(p.content) }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
        
        {generating && (
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-800 animate-pulse" />
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部输入栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            disabled={generating}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 disabled:opacity-50"
          />
          {userInput.trim() ? (
            <button
              onClick={() => handleInput()}
              disabled={generating}
              className="px-5 py-3 bg-pink-500 text-white font-medium rounded-full hover:bg-pink-600 disabled:opacity-50 transition-colors"
            >
              发送
            </button>
          ) : (
            <button
              onClick={handleContinue}
              disabled={generating}
              className="px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-full hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 transition-all"
            >
              继续
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
