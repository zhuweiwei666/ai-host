import { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  StoryParagraph,
  StoryState,
  StoryAffection,
  startStory,
  continueStory,
  inputStory,
  restartStory,
  getAgent,
  getParagraphImage,
  Agent,
} from '../api';

/**
 * 无限故事页面
 * 
 * 功能：
 * - 好感度系统显示
 * - 角色状态展示
 * - 生成写真按钮
 * - 内心戏/对话格式化
 */

// 图片加载状态组件
function ImageLoadingPlaceholder() {
  return (
    <div className="w-full max-w-sm aspect-[3/4] rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center gap-3 animate-pulse">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <span className="text-xs text-gray-500">图片生成中...</span>
    </div>
  );
}

export default function StoryPage() {
  const { id: agentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paragraphs, setParagraphs] = useState<StoryParagraph[]>([]);
  const [, setProgress] = useState(0);
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [affection, setAffection] = useState<StoryAffection>({ level: 0, stage: '陌生', lastChange: 0 });
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [userInput, setUserInput] = useState('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null); // 写真弹窗
  const [photoModeEnabled, setPhotoModeEnabled] = useState(false); // 写真模式开关
  
  // 正在加载图片的段落索引集合
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const pollingRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  
  // 轮询图片状态
  const pollImage = useCallback(async (sid: string, index: number) => {
    try {
      const res = await getParagraphImage(sid, index);
      if (res.data.imageReady && res.data.imageUrl) {
        // 图片已就绪，更新段落
        setParagraphs(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], imageUrl: res.data.imageUrl! };
          }
          return updated;
        });
        
        // 停止轮询
        setLoadingImages(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
        
        const timer = pollingRef.current.get(index);
        if (timer) {
          clearInterval(timer);
          pollingRef.current.delete(index);
        }
      }
    } catch (err) {
      console.error('Poll image error:', err);
    }
  }, []);
  
  // 开始轮询
  const startPolling = useCallback((sid: string, index: number) => {
    setLoadingImages(prev => new Set(prev).add(index));
    
    // 每 2 秒轮询一次
    const timer = setInterval(() => pollImage(sid, index), 2000);
    pollingRef.current.set(index, timer);
    
    // 立即轮询一次
    pollImage(sid, index);
    
    // 30 秒后停止轮询
    setTimeout(() => {
      const t = pollingRef.current.get(index);
      if (t) {
        clearInterval(t);
        pollingRef.current.delete(index);
        setLoadingImages(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    }, 30000);
  }, [pollImage]);
  
  // 清理轮询
  useEffect(() => {
    return () => {
      pollingRef.current.forEach(timer => clearInterval(timer));
      pollingRef.current.clear();
    };
  }, []);
  
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
        if (storyRes.data.affection) {
          setAffection(storyRes.data.affection);
        }
        
        // 检查是否有图片需要轮询
        storyRes.data.paragraphs.forEach((p, idx) => {
          if (!p.imageUrl && p.imagePrompt) {
            startPolling(storyRes.data.sessionId, idx);
          }
        });
        
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : '加载失败';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    init();
  }, [agentId, startPolling]);
  
  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [paragraphs]);
  
  // 继续剧情
  const handleContinue = async () => {
    if (!sessionId || generating) return;

    try {
      setGenerating(true);
      setError(null);

      const res = await continueStory(sessionId, photoModeEnabled);

      const paragraphIndex = res.data.paragraphIndex ?? paragraphs.length;
      const newParagraph: StoryParagraph = {
        content: res.data.content,
        imageUrl: res.data.imageUrl || undefined,
        imagePrompt: res.data.imagePrompt,
        source: 'ai',
        createdAt: new Date().toISOString(),
      };

      setParagraphs(prev => [...prev, newParagraph]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      
      // 如果写真模式开启且图片正在生成，开始轮询
      if (photoModeEnabled && res.data.imageGenerating && sessionId) {
        setLoadingImages(prev => new Set(prev).add(paragraphIndex));
        const timer = setInterval(() => pollImage(sessionId, paragraphIndex), 2000);
        pollingRef.current.set(paragraphIndex, timer);
      }
      
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
      }
      
      // 如果图片正在生成，开始轮询
      if (res.data.imageGenerating && res.data.paragraphIndex !== undefined) {
        startPolling(sessionId, res.data.paragraphIndex);
      }
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '推进失败';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };
  
  // 用户输入
  const handleInput = async () => {
    if (!sessionId || generating || !userInput.trim()) return;
    
    try {
      setGenerating(true);
      setError(null);
      
      const input = userInput.trim();
      setUserInput('');
      
      const res = await inputStory(sessionId, input, photoModeEnabled);
      
      const paragraphIndex = res.data.paragraphIndex ?? paragraphs.length;
      const newParagraph: StoryParagraph = {
        content: res.data.content,
        imageUrl: res.data.imageUrl || undefined,
        imagePrompt: res.data.imagePrompt,
        source: 'user_input',
        userInput: input,
        createdAt: new Date().toISOString(),
      };
      
      setParagraphs(prev => [...prev, newParagraph]);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
      if (res.data.balance !== undefined) {
        setBalance(res.data.balance);
      }
      
      // 如果写真模式开启且图片正在生成，开始轮询
      if (photoModeEnabled && res.data.imageGenerating && sessionId) {
        setLoadingImages(prev => new Set(prev).add(paragraphIndex));
        const timer = setInterval(() => pollImage(sessionId, paragraphIndex), 2000);
        pollingRef.current.set(paragraphIndex, timer);
      }
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '处理失败';
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
    if (!confirm('确定要重新开始吗？当前进度将丢失。')) return;
    
    // 清理轮询
    pollingRef.current.forEach(timer => clearInterval(timer));
    pollingRef.current.clear();
    setLoadingImages(new Set());
    
    try {
      setLoading(true);
      const res = await restartStory(agentId);
      setSessionId(res.data.sessionId);
      setParagraphs(res.data.paragraphs);
      setProgress(res.data.progress);
      setStoryState(res.data.state);
      if (res.data.affection) {
        setAffection(res.data.affection);
      }
      
      res.data.paragraphs.forEach((p, idx) => {
        if (!p.imageUrl && p.imagePrompt) {
          startPolling(res.data.sessionId, idx);
        }
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '重新开始失败';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };
  
  // 格式化内容：高亮对话和内心戏
  const formatContent = (content: string) => {
    // 处理「对话」
    let formatted = content.replace(/「([^」]+)」/g, '<span class="text-pink-400 font-medium">"$1"</span>');
    // 处理（内心戏）
    formatted = formatted.replace(/（([^）]+)）/g, '<span class="text-gray-400 italic text-sm">（$1）</span>');
    formatted = formatted.replace(/\(([^)]+)\)/g, '<span class="text-gray-400 italic text-sm">（$1）</span>');
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
        <div className="flex items-center justify-between px-4 py-2">
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
            {/* 好感度和状态 */}
            <div className="flex items-center justify-center gap-2 text-xs mt-0.5">
              <span className={`px-1.5 py-0.5 rounded ${
                affection.stage === '深爱' ? 'bg-red-500/20 text-red-400' :
                affection.stage === '热恋' ? 'bg-pink-500/20 text-pink-400' :
                affection.stage === '暧昧' ? 'bg-purple-500/20 text-purple-400' :
                affection.stage === '熟悉' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {affection.stage}
              </span>
              <span className="text-gray-500">{affection.level}%</span>
              {affection.lastChange !== 0 && (
                <span className={affection.lastChange > 0 ? 'text-green-400' : 'text-red-400'}>
                  {affection.lastChange > 0 ? '+' : ''}{affection.lastChange}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 text-pink-400 text-sm">
            <span>💎</span>
            <span>{balance ?? '--'}</span>
          </div>
        </div>
        
        {/* 角色状态栏 */}
        {storyState && (
          <div className="px-4 py-1.5 bg-gray-800/50 flex items-center justify-center gap-3 text-xs text-gray-400 overflow-x-auto">
            {storyState.expression && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>表情:</span>
                <span className="text-pink-300">{storyState.expression}</span>
              </span>
            )}
            {storyState.action && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>动作:</span>
                <span className="text-blue-300">{storyState.action}</span>
              </span>
            )}
            {storyState.mood && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>心情:</span>
                <span className="text-purple-300">{storyState.mood}</span>
              </span>
            )}
            {storyState.clothes && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <span>穿着:</span>
                <span className="text-yellow-300">{storyState.clothes}</span>
              </span>
            )}
          </div>
        )}
      </div>
      
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
      <div ref={contentRef} className="flex-1 overflow-y-auto pb-40">
        {paragraphs.map((p, idx) => (
          <div key={idx} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
            <div className="p-4">
              <div className="flex items-start gap-3">
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
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-white">{agent?.name}</span>
                    <span className="text-xs text-gray-500">{formatTime(p.createdAt)}</span>
                  </div>
                  
                  {p.source === 'user_input' && p.userInput && (
                    <div className="mb-2 pl-3 border-l-2 border-pink-500/50 text-sm text-gray-400">
                      回复：{p.userInput}
                    </div>
                  )}
                  
                  {/* 图片区域 */}
                  <div className="mb-2 -mx-1">
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt="配图" 
                        className="w-full max-w-sm rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setExpandedImage(p.imageUrl || null)}
                      />
                    ) : loadingImages.has(idx) || (!p.imageUrl && p.imagePrompt) ? (
                      <ImageLoadingPlaceholder />
                    ) : null}
                  </div>
                  
                  <p 
                    className="text-gray-100 leading-relaxed text-[15px] whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: formatContent(p.content) }}
                  />
                  
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
        
        {generating && (
          <div className="p-4 border-b border-gray-800/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-800 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded animate-pulse w-24" />
                <div className="h-4 bg-gray-800 rounded animate-pulse w-3/4" />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 底部操作栏 */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800">
          <div className="p-3">
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
            
            <div className="flex items-center gap-2">
              {/* 写真模式开关 */}
              <button
                onClick={() => setPhotoModeEnabled(!photoModeEnabled)}
                disabled={generating}
                className={`px-4 py-3 font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-sm ${
                  photoModeEnabled 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white ring-2 ring-purple-400/50' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {photoModeEnabled ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <span>写真</span>
              </button>
              
              {/* 继续故事按钮 */}
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
                    <span>继续故事</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
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
          
          <div className="h-safe-area-inset-bottom bg-gray-900" />
        </div>
      
      {/* 放大查看图片 */}
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
      
      {/* 写真弹窗 */}
      {photoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          onClick={() => setPhotoUrl(null)}
        >
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-white mb-1">{agent?.name}的写真</h3>
            <p className="text-sm text-gray-400">基于当前好感度 {affection.level}% 生成</p>
          </div>
          <img 
            src={photoUrl} 
            alt="角色写真" 
            className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-2xl"
          />
          <button 
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
            onClick={() => setPhotoUrl(null)}
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
