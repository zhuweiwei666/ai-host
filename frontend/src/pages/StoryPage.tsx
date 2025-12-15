import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  StoryParagraph,
  StoryState,
  startStory,
  continueStory,
  inputStory,
  restartStory,
  getAgent,
  Agent,
} from '../api';

export default function StoryPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Agent 信息
  const [agent, setAgent] = useState<Agent | null>(null);
  
  // 故事状态
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<StoryParagraph[]>([]);
  const [progress, setProgress] = useState(0);
  const [, setStoryState] = useState<StoryState | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  
  // UI 状态
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [userInput, setUserInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  
  // 加载角色和故事
  useEffect(() => {
    if (!agentId) return;
    
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // 获取角色信息
        const agentRes = await getAgent(agentId);
        setAgent(agentRes.data);
        
        // 开始/继续故事
        const storyRes = await startStory(agentId);
        setSessionId(storyRes.data.sessionId);
        setParagraphs(storyRes.data.paragraphs);
        setProgress(storyRes.data.progress);
        setStoryState(storyRes.data.state);
        
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '加载失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [agentId]);
  
  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [paragraphs]);
  
  // 继续剧情（AI 推进）
  const handleContinue = async () => {
    if (!sessionId || generating || isEnding) return;
    
    try {
      setGenerating(true);
      setError(null);
      
      const res = await continueStory(sessionId);
      
      // 添加新段落
      setParagraphs(prev => [...prev, {
        content: res.data.content,
        source: 'ai',
        createdAt: new Date().toISOString(),
      }]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      setIsEnding(res.data.isEnding);
      setBalance(res.data.balance);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '推进失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  // 用户输入推进
  const handleInput = async () => {
    if (!sessionId || generating || isEnding || !userInput.trim()) return;
    
    try {
      setGenerating(true);
      setError(null);
      
      const input = userInput.trim();
      setUserInput('');
      
      const res = await inputStory(sessionId, input);
      
      // 添加新段落
      setParagraphs(prev => [...prev, {
        content: res.data.content,
        source: 'user_input',
        userInput: input,
        createdAt: new Date().toISOString(),
      }]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      setIsEnding(res.data.isEnding);
      setBalance(res.data.balance);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '处理失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  // 键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInput();
    }
  };
  
  // 重新开始
  const handleRestart = async () => {
    if (!agentId) return;
    
    if (!confirm('确定要重新开始吗？当前进度将丢失。')) return;
    
    try {
      setLoading(true);
      const res = await restartStory(agentId);
      setSessionId(res.data.sessionId);
      setParagraphs(res.data.paragraphs);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      setIsEnding(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '重新开始失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }
  
  // 获取最后一段内容
  const lastParagraph = paragraphs[paragraphs.length - 1];
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          {agent?.avatarUrls?.[0] && (
            <img src={agent.avatarUrls[0]} alt={agent.name} className="w-8 h-8 rounded-full object-cover" />
          )}
          <span className="font-medium">{agent?.name}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {balance !== null && (
            <span className="text-sm text-pink-400">💎 {balance}</span>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="px-4 py-2 bg-black/20">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">第 {paragraphs.length} 段</span>
          <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex justify-between items-center">
          <span className="text-sm text-red-300">{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Content Area */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {showHistory ? (
          // 历史段落列表
          <div className="space-y-4">
            {paragraphs.map((p, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                  <span>第 {idx + 1} 段</span>
                  {p.source === 'user_input' && p.userInput && (
                    <span className="text-pink-400">回复: "{p.userInput.slice(0, 20)}..."</span>
                  )}
                </div>
                <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">{p.content}</p>
              </div>
            ))}
          </div>
        ) : (
          // 当前段落
          <div className="min-h-full flex flex-col justify-center">
            {lastParagraph?.source === 'user_input' && lastParagraph.userInput && (
              <div className="mb-4 p-3 bg-pink-500/10 border border-pink-500/30 rounded-lg">
                <span className="text-xs text-pink-400 block mb-1">你说/做了:</span>
                <p className="text-pink-200">{lastParagraph.userInput}</p>
              </div>
            )}
            
            <div className="text-lg text-gray-100 leading-relaxed whitespace-pre-wrap">
              {generating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-pulse">正在生成...</div>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-pink-500 border-t-transparent"></div>
                </div>
              ) : (
                lastParagraph?.content
              )}
            </div>
            
            {isEnding && (
              <div className="mt-6 text-center">
                <span className="text-2xl">🎉</span>
                <p className="text-pink-400 mt-2">故事完结</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom Actions */}
      <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-gray-900 to-transparent">
        {/* Toggle History */}
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {showHistory ? '查看当前' : `查看历史 (${paragraphs.length} 段)`}
          </button>
        </div>
        
        {!isEnding && (
          <>
            {/* User Input */}
            <div className="mb-3">
              <div className="relative">
                <textarea
                  value={userInput}
                  onChange={e => setUserInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="我想说点什么..."
                  rows={2}
                  disabled={generating}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 resize-none focus:outline-none focus:border-pink-500 transition-colors disabled:opacity-50"
                />
                {userInput.trim() && (
                  <button
                    onClick={handleInput}
                    disabled={generating}
                    className="absolute right-2 bottom-2 px-4 py-1.5 bg-pink-500 text-white text-sm rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors"
                  >
                    发送
                  </button>
                )}
              </div>
            </div>
            
            {/* Divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-white/20"></div>
              <span className="text-xs text-gray-400">或者</span>
              <div className="flex-1 h-px bg-white/20"></div>
            </div>
            
            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={generating}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  生成中...
                </>
              ) : (
                <>
                  让她继续
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className="text-sm opacity-80">(2💎)</span>
                </>
              )}
            </button>
          </>
        )}
        
        {/* Footer Actions */}
        <div className="flex justify-between mt-4">
          <button
            onClick={handleRestart}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            从头开始
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            换个角色
          </button>
        </div>
      </div>
    </div>
  );
}
