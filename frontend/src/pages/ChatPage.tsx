import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Agent, getAgent, chatWithAgent, getChatHistory, generateTTS, generateVideo, generateImage, http } from '../api'; // Import generateImage
import { normalizeImageUrl } from '../utils/imageUrl';
 

const ENABLE_VIDEO_FEATURE = import.meta.env.VITE_ENABLE_VIDEO === 'true';

interface ChatMessage {
  role: string;
  content: string;
  audioUrl?: string;
  imageUrl?: string;
  isLoadingAudio?: boolean;
  shouldAutoPlay?: boolean;
  isMediaLoading?: boolean; // Added for loading state
}

// AudioPlayer Component (Unchanged)
const AudioPlayer: React.FC<{ src: string; autoPlay?: boolean }> = ({ src, autoPlay = false }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (src && audioRef.current) {
      if (autoPlay) {
        audioRef.current.play().catch(e => console.error("Auto-play prevented", e));
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    }
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-full shadow-sm border border-gray-200 px-3 py-1.5 w-full max-w-[280px]">
      <button 
        onClick={togglePlay}
        className="text-indigo-600 hover:text-indigo-700 focus:outline-none"
      >
        {isPlaying ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      <span className="text-xs text-gray-500 w-8 text-right">{formatTime(progress)}</span>
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={progress}
        onChange={handleSeek}
        className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
      />
      <span className="text-xs text-gray-500 w-8">{formatTime(duration)}</span>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
};

const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [chatPrompt, setChatPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<string | null>(null); // New Video Modal State
  const [responseMode, setResponseMode] = useState<'text' | 'image' | 'video'>('text'); // New Response Mode
  
  // Wallet State
  const [balance, setBalance] = useState<number>(0);
  const [intimacy, setIntimacy] = useState<number>(0); // Intimacy State
  const [showAdModal, setShowAdModal] = useState(false);
  // 注意：userId 现在从认证 token 中获取，不再需要硬编码
  // 所有 API 调用会自动带上 Authorization header

  // Video Generation Options
  // Removed videoFastMode toggle, defaulting to Fast Mode always as Quality Mode is deprecated.
  const [videoTemplate, setVideoTemplate] = useState<string>(''); // Template prompts
  
  const VIDEO_TEMPLATES = [
    { label: "None (Custom)", value: "" },
    { label: "Slow Zoom In", value: "slow zoom in, cinematic movement" },
    { label: "Pan Right", value: "camera panning right slowly, high quality" },
    { label: "Waving Hand", value: "character waving hand at camera, friendly, realistic movement" },
    { label: "Blowing Kiss", value: "character blowing a kiss, flirtatious, detailed face" },
    { label: "Laughing", value: "character laughing naturally, dynamic movement" },
    { label: "Dancing", value: "character dancing rhythmically, full body shot" }
  ];

  useEffect(() => {
    if (id) {
      getAgent(id)
        .then(res => setAgent(res.data))
        .catch(err => {
          console.error(err);
          alert('Failed to load agent');
          navigate('/');
        });
      
      getChatHistory(id)
        .then(res => {
            setMessages((res.data.history || []) as any);
            if (res.data.intimacy !== undefined) setIntimacy(res.data.intimacy);
        })
        .catch(console.error);
    }
    
    // Fetch initial balance
    fetchBalance();
  }, [id, navigate]);

  useEffect(() => {
    if (!ENABLE_VIDEO_FEATURE && responseMode === 'video') {
      setResponseMode('text');
    }
  }, [responseMode]);

  const fetchBalance = async () => {
    try {
      // 不再需要传递 userId，后端从认证 token 中获取用户身份
      const res = await http.get('/wallet/balance');
      setBalance(res.data.balance);
    } catch (err) {
      console.error('Failed to fetch balance', err);
    }
  };

  const handleWatchAd = async () => {
    try {
      // 不再需要传递 userId，后端从认证 token 中获取用户身份
      const res = await http.post('/wallet/reward/ad', { 
        traceId: `ad_${Date.now()}` // 用于防止重复奖励
      });
      setBalance(res.data.balance);
      setShowAdModal(false);
      alert('Ad watched! +50 Coins');
    } catch (err) {
      alert('Ad reward failed');
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleChat = async () => {
    if (!chatPrompt.trim() || !agent?._id) return;
    
    const activeMode = (!ENABLE_VIDEO_FEATURE && responseMode === 'video') ? 'text' : responseMode;
    
    // Balance check based on mode
    let cost = 1; // text
    if (activeMode === 'image') cost = 10;
    if (activeMode === 'video') cost = 50;

    if (balance < cost) {
      setShowAdModal(true);
      return;
    }

    const currentPrompt = chatPrompt;
    setChatPrompt(''); 
    setLoading(true);

    // 1. Add User Message immediately
    const newHistory = [...messages, { role: 'user', content: currentPrompt } as ChatMessage];
    setMessages(newHistory);

    try {
      // 2. ALWAYS Get Text Reply first (Skip image gen in chat API)
      // We send skipImageGen: true so the backend doesn't auto-generate or charge for image yet
      const apiHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const textRes = await chatWithAgent(agent._id, currentPrompt, apiHistory, true);
      
      if (textRes.data.balance !== undefined) setBalance(textRes.data.balance);
      if (textRes.data.intimacy !== undefined) setIntimacy(textRes.data.intimacy);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
          content: textRes.data.reply,
          audioUrl: textRes.data.audioUrl,
          // If mode is NOT text, we show a loading placeholder immediately
          isMediaLoading: activeMode !== 'text',
          imageUrl: activeMode !== 'text' ? 'loading_placeholder' : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // 3. If Media Mode, Trigger Generation in Background
      if (activeMode !== 'text') {
          // We don't await this immediately to let the UI update with text first? 
          // Actually, we want to start it now.
          
          try {
              let mediaUrl = '';
              let newBal = balance;

              if (activeMode === 'video') {
                  // Generate Video (Direct Animation of Avatar)
                  // No intermediate image generation to save time and cost.
                  
                  let finalVideoPrompt = videoTemplate;
                  if (currentPrompt && !videoTemplate) finalVideoPrompt = currentPrompt;
                  else if (currentPrompt && videoTemplate) finalVideoPrompt = `${videoTemplate}, ${currentPrompt}`;
                  
                  if (!finalVideoPrompt) finalVideoPrompt = "cinematic movement";

                  // We send NO imageUrl, backend resolves it based on Intimacy
                  const vidRes = await generateVideo(agent._id, finalVideoPrompt, undefined, true);
                  
                  if (vidRes.data && vidRes.data.url) {
                      mediaUrl = vidRes.data.url;
                      if (vidRes.data.balance !== undefined) newBal = vidRes.data.balance;
                      if (vidRes.data.intimacy !== undefined) setIntimacy(vidRes.data.intimacy);
                  } else {
                      throw new Error("Video URL missing in response");
                  }

              } else {
                  // Generate Image
                  // Use user prompt + agent context is handled by backend
                  // 不再需要传递 userId，后端从认证 token 中获取用户身份
                  const imgRes = await generateImage(currentPrompt, { 
                      agentId: agent._id, 
                      useAvatar: true 
                  });
                  mediaUrl = imgRes.data.url;
                  if (imgRes.data.balance !== undefined) newBal = imgRes.data.balance;
                  if (imgRes.data.intimacy !== undefined) setIntimacy(imgRes.data.intimacy);
              }

              setBalance(newBal);

              // Update the message with the real URL
              setMessages(prev => prev.map((msg, idx) => {
                  // Check if it's the last message (or matching content/role)
                  // Better way: we know we just added it.
                  // But state updates are async.
                  // We can target the last message if we assume no other messages came in.
                  // Or better, match by content if unique enough, or just last assistant message.
                  if (idx === prev.length - 1 && msg.role === 'assistant') {
                      return { 
                          ...msg, 
                          imageUrl: mediaUrl, 
                          isMediaLoading: false 
                      };
                  }
                  return msg;
              }));

          } catch (mediaErr) {
              console.error("Media generation failed", mediaErr);
              // Update message to remove loading and maybe show error text
              setMessages(prev => prev.map((msg, idx) => {
                  if (idx === prev.length - 1 && msg.role === 'assistant') {
                      return { 
                          ...msg, 
                          isMediaLoading: false,
                          imageUrl: undefined, // Clear placeholder to prevent broken image icon
                          content: msg.content + "\n\n(Media generation failed)"
                      };
                  }
                  return msg;
              }));
          }
      }

    } catch (error: any) {
      if (error.response && error.response.status === 402) {
        setShowAdModal(true);
      } else {
        alert('Chat failed: ' + error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudio = async (index: number) => {
    const msg = messages[index];
    if (!msg || !msg.content || msg.role !== 'assistant' || !agent?._id) return;

    if (balance < 5) {
      setShowAdModal(true);
      return;
    }

    setMessages(prev => prev.map((m, i) => i === index ? { ...m, isLoadingAudio: true } : m));

    try {
        const res = await generateTTS(agent._id, msg.content);

        if (res.data.balance !== undefined) {
            setBalance(res.data.balance);
        }

        if (res.data.audioUrl) {
            setMessages(prev => prev.map((m, i) => i === index ? { ...m, audioUrl: res.data.audioUrl, isLoadingAudio: false, shouldAutoPlay: true } : m));
        } else {
             alert('Failed to generate audio');
             setMessages(prev => prev.map((m, i) => i === index ? { ...m, isLoadingAudio: false } : m));
        }
    } catch (error: any) {
        if (error.response && error.response.status === 402) {
            setShowAdModal(true);
            setMessages(prev => prev.map((m, i) => i === index ? { ...m, isLoadingAudio: false } : m));
        } else {
            console.error(error);
            alert('TTS Error');
            setMessages(prev => prev.map((m, i) => i === index ? { ...m, isLoadingAudio: false } : m));
        }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  };

  if (!agent) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading agent...</div>;

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <img 
            src={normalizeImageUrl(agent.avatarUrl)} 
            alt={agent.name} 
            className="w-10 h-10 rounded-full object-cover object-[50%_20%] bg-gray-200"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64'; }}
          />
          <div>
            <h1 className="text-lg font-bold text-gray-900">{agent.name}</h1>
            <p className="text-xs text-gray-500">{agent.modelName}</p>
          </div>
        </div>

        {/* Balance & Intimacy Display */}
        <div className="flex items-center gap-4">
             {/* Intimacy Bar */}
             <div className="hidden sm:flex items-center gap-2 bg-pink-50 px-3 py-1.5 rounded-full border border-pink-100" title="Intimacy Level">
                <span className="text-pink-500">❤️</span>
                <div className="flex flex-col w-24">
                    <div className="flex justify-between text-[10px] text-pink-700 font-bold leading-none mb-0.5">
                        <span>Intimacy</span>
                        <span>{intimacy}</span>
                    </div>
                    <div className="w-full bg-pink-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-pink-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.min(intimacy, 100)}%` }}
                        ></div>
                    </div>
                </div>
             </div>

        <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
          <span className="text-lg">💎</span>
          <span className="font-bold text-indigo-700">{balance}</span>
          <button 
            onClick={() => setShowAdModal(true)}
            className="ml-2 text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
          >
            + Get Coins
          </button>
             </div>
        </div>
      </header>

      {/* Main Layout: Chat Area with Background Visual */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Background Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none">
            {agent.coverVideoUrl ? (
                <video 
                    src={normalizeImageUrl(agent.coverVideoUrl)} 
                    className="w-full h-full object-cover opacity-30" // Low opacity to not distract
                    autoPlay 
                    loop 
                    muted 
                    playsInline
                />
            ) : (
                <img 
                    src={normalizeImageUrl(agent.avatarUrl, 'https://via.placeholder.com/400x600')} 
                    alt={agent.name}
                    className="w-full h-full object-cover object-[50%_20%] opacity-30" 
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x600'; }}
                />
            )}
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]"></div>
        </div>

        {/* Chat Content (z-10 to sit above background) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-block p-4 rounded-full bg-indigo-50 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Start a conversation with {agent.name}</h3>
              <p className="text-gray-500 mt-1 max-w-md mx-auto">{agent.description}</p>
              <p className="text-xs text-gray-400 mt-4">Chat costs 1 Coin. Images cost 10 Coins.</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <img 
                  src={normalizeImageUrl(agent.avatarUrl, 'https://via.placeholder.com/40')} 
                  alt={agent.name} 
                        className="w-8 h-8 rounded-full object-cover object-[50%_20%] flex-shrink-0 mt-1"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40'; }}
                />
              )}
              
              <div className={`flex flex-col max-w-[80%] sm:max-w-[70%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Media Loading State */}
                        {msg.isMediaLoading && (
                        <div className="mb-2 relative w-64 h-64 bg-gray-200 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                            {/* Blurred background effect if we had a thumb, but here just pulse */}
                            <div className="absolute inset-0 bg-indigo-50 animate-pulse"></div>
                            <div className="z-10 flex flex-col items-center gap-2">
                                <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="text-xs font-medium text-indigo-600">Generating Media...</span>
                            </div>
                        </div>
                        )}

                        {/* Real Image/Video */}
                        {msg.imageUrl && !msg.isMediaLoading && (
                  <div className="mb-2">
                            {msg.imageUrl.endsWith('.mp4') ? (
                                <div className="relative group cursor-pointer" onClick={() => setModalVideo(msg.imageUrl!)}>
                                    <video 
                                        src={normalizeImageUrl(msg.imageUrl)} 
                                        className="rounded-lg shadow-sm max-w-full w-64 object-cover border border-gray-200"
                                        muted
                                        loop
                                        onMouseOver={e => e.currentTarget.play()}
                                        onMouseOut={e => e.currentTarget.pause()}
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="bg-black/50 rounded-full p-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                    <img 
                      src={normalizeImageUrl(msg.imageUrl)} 
                      alt="Sent by AI" 
                      className="rounded-lg shadow-sm max-w-full w-64 object-cover cursor-zoom-in border border-gray-200"
                      onClick={() => setModalImage(normalizeImageUrl(msg.imageUrl))}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/256'; }}
                    />
                            )}
                  </div>
                )}
                
                <div 
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'
                  }`}
                >
                  {msg.content}
                </div>
                
                {msg.role === 'assistant' && (
                    <div className="mt-2">
                        {msg.audioUrl ? (
                            <AudioPlayer src={msg.audioUrl} autoPlay={msg.shouldAutoPlay} />
                        ) : (
                            <button 
                                onClick={() => handleGenerateAudio(idx)}
                                disabled={msg.isLoadingAudio}
                                className="flex items-center gap-2 text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                            >
                                {msg.isLoadingAudio ? (
                                    <>
                                        <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating (5 Coins)...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        Play Audio (5 Coins)
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0 mt-1">
                  You
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </main>

            <footer className="bg-white/90 backdrop-blur-md border-t border-gray-200 p-4 relative z-10">
                <div className="max-w-3xl mx-auto">
                {/* Response Mode Selector */}
                <div className="flex gap-2 mb-3">
                    <button
                        onClick={() => setResponseMode('text')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                            responseMode === 'text' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Text (1)
                    </button>
                    <button
                        onClick={() => setResponseMode('image')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                            responseMode === 'image' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Image (10)
                    </button>
                    {ENABLE_VIDEO_FEATURE && (
                    <button
                        onClick={() => setResponseMode('video')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors flex items-center gap-1 ${
                            responseMode === 'video' 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Video (50)
                    </button>
                    )}
                </div>

                    {/* Video Options (Only visible in Video Mode) */}
                    {ENABLE_VIDEO_FEATURE && responseMode === 'video' && (
                        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                            <select
                                value={videoTemplate}
                                onChange={(e) => setVideoTemplate(e.target.value)}
                                className="text-xs border border-gray-300 rounded-full px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="" disabled>Select Motion Template</option>
                                {VIDEO_TEMPLATES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                            
                            {/* Quality Mode Removed as requested */}
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                ⚡ Fast Mode Active
                            </span>
                        </div>
                    )}

                    <div className="relative">
                    <input 
                    type="text" 
                    value={chatPrompt}
                    onChange={(e) => setChatPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        loading 
                            ? "Generating..." 
                            : (ENABLE_VIDEO_FEATURE && responseMode === 'video')
                                ? videoTemplate ? `Template: ${VIDEO_TEMPLATES.find(t => t.value === videoTemplate)?.label}` : "Describe video motion..."
                                : `Message ${agent.name}...`
                    }
                    className="w-full border border-gray-300 rounded-full pl-6 pr-14 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-sm disabled:bg-gray-100"
                    disabled={loading || balance < 1}
                    autoFocus
                    />
                    <button 
                    onClick={handleChat} 
                    disabled={loading || !chatPrompt.trim() || balance < 1}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                    {loading ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    )}
                    </button>
                </div>
                </div>
            </footer>
        </div>

      {/* Image Modal */}
      {modalImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setModalImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={modalImage} 
              alt="Full size" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button 
              className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700 focus:outline-none"
              onClick={() => setModalImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Ad Reward Modal */}
      {showAdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center transform transition-all scale-100">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💎</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Insufficient Coins</h3>
            <p className="text-gray-600 mb-6">
              You need more AI Coins to continue chatting or generate content. Watch a short ad to earn +50 Coins!
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleWatchAd}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                Watch Ad (+50 Coins)
              </button>
              <button 
                onClick={() => setShowAdModal(false)}
                className="w-full py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {modalVideo && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setModalVideo(null)}
        >
          <div className="relative max-w-full max-h-full w-full max-w-4xl">
            <video 
              src={modalVideo} 
              className="max-w-full max-h-[90vh] w-full object-contain rounded-lg shadow-2xl"
              controls
              autoPlay
          />
          <button 
              className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700 focus:outline-none z-10"
              onClick={() => setModalVideo(null)}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
          </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
