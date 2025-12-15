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

/**
 * 论坛帖子式故事页面
 * 
 * 每层楼 = 一段内容 + 配图
 * 类似 91 论坛 / Twitter / 微博的体验
 */
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
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  
  // 加载角色和故事
  useEffect(() => {
    if (!agentId) return;
    
    const init = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const agentRes = await getAgent(agentId);
        setAgent(agentRes.data);
        
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
      
      setParagraphs(prev => [...prev, {
        content: res.data.content,
        imageUrl: res.data.imageUrl,
        imagePrompt: res.data.imagePrompt,
        source: 'ai',
        createdAt: new Date().toISOString(),
      }]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      setIsEnding(res.data.isEnding);
      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
      }
      
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
      
      setParagraphs(prev => [...prev, {
        content: res.data.content,
        imageUrl: res.data.imageUrl,
        imagePrompt: res.data.imagePrompt,
        source: 'user_input',
        userInput: input,
        createdAt: new Date().toISOString(),
      }]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      setIsEnding(res.data.isEnding);
      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
      }
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '处理失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  // 键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
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
      {/* Header - 帖子标题栏 */}
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
            <h1 className="font-semibold text-base">{agent?.name}的故事</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {paragraphs.length} 楼 · {Math.round(progress)}%
            </p>
          </div>
          
          <div className="flex items-center gap-1 text-pink-400 text-sm">
            <span>💎</span>
            <span>{balance ?? '--'}</span>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="h-0.5 bg-gray-800">
          <div 
            className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mx-4 mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex justify-between items-center">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* 论坛帖子流 */}
      <div 
        ref={contentRef}
        className="flex-1 overflow-y-auto pb-40"
      >
        {paragraphs.map((p, idx) => (
          <div 
            key={idx} 
            className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors"
          >
            <div className="p-4">
              {/* 楼层头部：头像 + 名字 + 楼层号 + 时间 */}
              <div className="flex items-start gap-3">
                {/* 头像 */}
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={agent?.name} 
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                      {agent?.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                
                {/* 内容区 */}
                <div className="flex-1 min-w-0">
                  {/* 名字 + 楼层 + 时间 */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{agent?.name}</span>
                    <span className="text-xs text-gray-500">#{idx + 1}楼</span>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="text-xs text-gray-500">{formatTime(p.createdAt)}</span>
                  </div>
                  
                  {/* 如果是用户输入触发，显示引用 */}
                  {p.source === 'user_input' && p.userInput && (
                    <div className="mb-2 pl-3 border-l-2 border-pink-500/50 text-sm text-gray-400">
                      回复：{p.userInput}
                    </div>
                  )}
                  
                  {/* 配图 */}
                  {p.imageUrl && (
                    <div className="mb-2 -mx-1">
                      <img 
                        src={p.imageUrl} 
                        alt="配图" 
                        className="w-full max-w-sm rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setExpandedImage(p.imageUrl || null)}
                      />
                    </div>
                  )}
                  
                  {/* 文字内容 */}
                  <p className="text-gray-100 leading-relaxed text-[15px]">
                    {p.content}
                  </p>
                  
                  {/* 互动按钮 */}
                  <div className="flex items-center gap-6 mt-3 text-gray-500">
                    <button className="flex items-center gap-1.5 text-xs hover:text-pink-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span>喜欢</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-xs hover:text-blue-400 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span>分享</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {/* 生成中的占位 */}
        {generating && (
          <div className="p-4 border-b border-gray-800/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-24" />
                <div className="h-32 bg-gray-800 rounded-xl animate-pulse" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
              </div>
            </div>
          </div>
        )}
        
        {/* 故事完结 */}
        {isEnding && (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-lg font-semibold text-pink-400 mb-2">故事完结</h3>
            <p className="text-gray-400 text-sm mb-4">感谢你的陪伴</p>
            <button 
              onClick={handleRestart}
              className="px-6 py-2 bg-pink-500 hover:bg-pink-600 rounded-full text-sm font-medium transition-colors"
            >
              再来一次
            </button>
          </div>
        )}
      </div>
      
      {/* 底部操作栏 */}
      {!isEnding && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800">
          <div className="p-3">
            {/* 输入框 */}
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="说点什么..."
                disabled={generating}
                className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-full text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 disabled:opacity-50 text-sm"
              />
              {userInput.trim() && (
                <button
                  onClick={handleInput}
                  disabled={generating}
                  className="px-4 py-2.5 bg-pink-500 text-white text-sm font-medium rounded-full hover:bg-pink-600 disabled:opacity-50 transition-colors"
                >
                  发送
                </button>
              )}
            </div>
            
            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleContinue}
                disabled={generating}
                className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium rounded-xl hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    <span>生成中...</span>
                  </>
                ) : (
                  <>
                    <span>下一楼</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              
              <button
                onClick={handleRestart}
                className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                title="重新开始"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Safe Area for iOS */}
          <div className="h-safe-area-inset-bottom bg-gray-900" />
        </div>
      )}
      
      {/* 图片放大查看 */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="放大查看" 
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
            onClick={() => setExpandedImage(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
