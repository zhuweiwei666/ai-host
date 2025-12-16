import { http } from './http';
export { http };

export interface Agent {
  _id?: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  style?: 'realistic' | 'anime';
  avatarUrl: string; // Deprecated: use avatarUrls[0] instead
  coverVideoUrl?: string; // Deprecated: use coverVideoUrls[0] instead
  privatePhotoUrl?: string; // Deprecated: use privatePhotoUrls[0] instead
  // New: Support multiple media files
  avatarUrls?: string[]; // Array of image URLs
  coverVideoUrls?: string[]; // Array of video URLs
  privatePhotoUrls?: string[]; // Array of NSFW/Paid image URLs
  // WebGL spatial photo asset pack (meta.json URL)
  avatarSpatialMetaUrl?: string;
  // Optional per-agent shader overrides (global tuning)
  avatarSpatialShader?: {
    parallaxStrength?: number;
    normalStrength?: number;
    rimStrength?: number;
    glareStrength?: number;
    fxStrength?: number;
    fxSpeed?: number;
    fxScale?: number;
    focusX?: number;
    focusY?: number;
    blinkStrength?: number;
    bgColor?: string; // hex like "#F2F2F2"
  };
  description: string;
  modelName: string;
  temperature: number;
  corePrompt?: string;
  systemPrompt: string;
  voiceId?: string;
  status?: 'online' | 'offline';
  stage1Prompt?: string;
  stage2Prompt?: string;
  stage3Prompt?: string;
  stage1Threshold?: number;
  stage2Threshold?: number;
  // 故事模式配置
  storyConfig?: {
    enabled?: boolean;
    tagline?: string;      // 角色标签，如"禁忌继母 · 三天独处"
    synopsis?: string;     // 故事简介
    opening?: string;      // 开场白
    personality?: string;  // 性格描述
    appearance?: string;   // 外貌描述
    contentRating?: 'mild' | 'moderate' | 'explicit';
    storyBeats?: Array<{
      progressRange: [number, number];
      goal: string;
      sceneHint?: string;
      moodHint?: string;
    }>;
  };
}

export interface VoiceModel {
  _id: string;
  remoteId: string;
  title: string;
  description: string;
  coverImage: string;
  isFavorite: boolean;
  languages: string[];
  tags: string[];
  gender?: 'male' | 'female' | 'other' | '';
  previewAudioUrl?: string;
}

export interface VoiceExtractResult {
  voiceId: string;
  sourceUrl: string;
}

// ==================== Preview Videos (LiveSkin FSM) ====================
export interface PreviewVideoItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  isVertical?: boolean;
  sortOrder?: number;
  tags?: string[];
  scaleLevel?: number;
  index?: number;
  // FSM 相关字段
  assetType?: 'idle' | 'reaction' | 'transition' | 'speak';
  loopSafe?: boolean;
  loopSafeUrl?: string;
  safeCutPoints?: number[];
  poseId?: string;
  emotionId?: string;
  fromPose?: string;
  toPose?: string;
}

export interface PreviewVideosResponse {
  agentId: string;
  agentName?: string;
  videos: PreviewVideoItem[];
  defaultIndex?: number;
  totalCount?: number;
}

export const getPreviewVideos = (agentId: string, params?: { maxScale?: number; tag?: string; limit?: number }) =>
  http.get<PreviewVideosResponse>(`/preview/videos/${agentId}`, { 
    params: {
      ...params,
      _t: Date.now(), // 添加时间戳避免缓存
    },
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

export const migratePreviewVideos = (agentId: string) =>
  http.post<{ message?: string; migratedCount?: number; videos?: unknown }>(`/preview/videos/${agentId}/migrate`, {});

export const updatePreviewVideo = (
  agentId: string,
  videoId: string,
  updates: Partial<
    Pick<
      PreviewVideoItem,
      'tags' | 'sortOrder' | 'scaleLevel' | 'thumbnailUrl' | 'duration' | 'width' | 'height' | 'fileSize' | 'format' | 'isVertical'
    >
  >
) => http.put<{ video: PreviewVideoItem }>(`/preview/videos/${agentId}/${videoId}`, updates);

// ==================== LiveSkin FSM API ====================
export interface LiveSkinManifest {
  agentId: string;
  agentName: string;
  version: number;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  assets: {
    idle: PreviewVideoItem[];
    reactions: Record<string, PreviewVideoItem[]>;
    transitions: PreviewVideoItem[];
    speak: PreviewVideoItem[];
  };
  defaultIdleIndex: number;
  totalAssets: number;
  generatedAt: string;
}

export const getLiveSkinManifest = (agentId: string) =>
  http.get<LiveSkinManifest>(`/liveskin/manifest/${agentId}`, {
    // 禁用缓存，确保获取最新的manifest
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    // 添加时间戳参数避免浏览器缓存
    params: {
      _t: Date.now(),
    },
  });

export const updateVideoAssetType = (
  agentId: string,
  videoId: string,
  assetType: string,
  emotionId?: string
) => http.put<{ video: Partial<PreviewVideoItem> }>(`/liveskin/video/${agentId}/${videoId}`, {
  assetType,
  emotionId,
});

export const batchUpdateAssetTypes = (agentId: string) =>
  http.post<{ message: string; total: number }>(`/liveskin/batch-update/${agentId}`, {});

export const reportLiveSkinEvent = (data: {
  agentId: string;
  eventType: 'reaction_queued' | 'reaction_played' | 'reaction_skipped' | 'fsm_state_change';
  data?: Record<string, unknown>;
  timestamp?: string;
}) => http.post<{ recorded: boolean }>('/liveskin/event', data);

// IDLE 视频上传 API（简化版，无需服务端处理）
export interface IdleVideoUploadResult {
  message: string;
  videoId: string;
  url: string;
  tips: string[];
}

export interface IdleVideoStatus {
  agentId: string;
  liveSkinStatus: 'pending' | 'generating' | 'ready' | 'failed';
  hasIdleVideo: boolean;
  hasLoopSafe: boolean;
  idleVideo: {
    id: string;
    url: string;
    loopSafeUrl: string;
    duration: number;
    safeCutPoints: number[];
  } | null;
  totalIdleVideos: number;
}

export const checkIdleVideoDependencies = () =>
  http.get<{ ready: boolean; mode: string; message: string; requirements: string[] }>('/idle-video/check');

// 获取预签名上传 URL
export const getIdleVideoPresignUrl = (agentId: string, filename: string, contentType: string) =>
  http.post<{ uploadUrl: string; publicUrl: string; key: string; expiresIn: number }>(
    `/idle-video/presign/${agentId}`,
    { filename, contentType }
  );

// 注册已上传的 IDLE 视频
export const registerIdleVideo = (agentId: string, url: string, key: string) =>
  http.post<IdleVideoUploadResult>(`/idle-video/register/${agentId}`, { url, key });

// 直传 IDLE 视频到 R2（绕过 Cloudflare 超时限制）
export const uploadIdleVideo = async (
  agentId: string, 
  videoFile: File,
  onProgress?: (progress: number) => void
): Promise<{ data: IdleVideoUploadResult }> => {
  const fileSize = videoFile.size;
  const startTime = Date.now();
  
  console.log(`[IdleVideo] Starting upload: ${videoFile.name} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
  
  // Step 1: 获取预签名 URL
  const presignStart = Date.now();
  onProgress?.(5); // 5% - 获取预签名 URL
  const presignRes = await getIdleVideoPresignUrl(agentId, videoFile.name, videoFile.type || 'video/mp4');
  const { uploadUrl, publicUrl, key } = presignRes.data;
  console.log(`[IdleVideo] Presign URL obtained in ${Date.now() - presignStart}ms`);

  // Step 2: 直接上传到 R2（使用 XMLHttpRequest 以支持进度）
  onProgress?.(10); // 10% - 开始上传
  const uploadStart = Date.now();
  
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // 上传进度
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = 10 + Math.floor((e.loaded / e.total) * 80); // 10% - 90%
        onProgress?.(percent);
        console.log(`[IdleVideo] Upload progress: ${percent}% (${(e.loaded / 1024 / 1024).toFixed(2)}MB / ${(e.total / 1024 / 1024).toFixed(2)}MB)`);
      }
    });
    
    // 上传完成
    xhr.addEventListener('load', async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const uploadTime = Date.now() - uploadStart;
        const uploadSpeed = (fileSize / 1024 / 1024) / (uploadTime / 1000);
        console.log(`[IdleVideo] Upload completed in ${uploadTime}ms (${uploadSpeed.toFixed(2)}MB/s)`);
        
        onProgress?.(90); // 90% - 上传完成，注册中
        
        try {
          // Step 3: 注册视频到数据库
          const registerRes = await registerIdleVideo(agentId, publicUrl, key);
          onProgress?.(100); // 100% - 完成
          
          const totalTime = Date.now() - startTime;
          console.log(`[IdleVideo] Total time: ${totalTime}ms`);
          
          resolve(registerRes);
        } catch (err) {
          console.error('[IdleVideo] Registration failed:', err);
          reject(err);
        }
      } else {
        console.error(`[IdleVideo] Upload failed: ${xhr.status} ${xhr.statusText}`);
        reject(new Error(`Upload to R2 failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    
    // 错误处理
    xhr.addEventListener('error', () => {
      console.error('[IdleVideo] Upload error');
      reject(new Error('Network error during upload'));
    });
    
    // 超时处理（5分钟）
    xhr.timeout = 5 * 60 * 1000;
    xhr.addEventListener('timeout', () => {
      console.error('[IdleVideo] Upload timeout');
      reject(new Error('Upload timeout (5 minutes)'));
    });
    
    // 开始上传
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', videoFile.type || 'video/mp4');
    xhr.send(videoFile);
  });
};

export const getIdleVideoStatus = (agentId: string) =>
  http.get<IdleVideoStatus>(`/idle-video/status/${agentId}`, {
    params: {
      _t: Date.now(), // 添加时间戳避免缓存
    },
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

export const deleteIdleVideo = (agentId: string, videoId: string) =>
  http.delete<{ message: string; remainingIdleVideos: number }>(`/idle-video/${agentId}/${videoId}`);

// User Interface
export interface User {
  _id: string; // 内部用户ID
  externalUserId?: string; // 外部产品用户ID（Android/iOS）
  externalAppId?: string; // 外部应用ID
  username: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'user';
  userType?: 'operator' | 'channel';
  platform?: 'web' | 'android' | 'ios' | 'admin';
  isActive?: boolean;
  balance?: number;
  createdAt: string;
  lastLoginAt?: string;
}

export const getAgents = (params?: { status?: string; style?: string }) => http.get<Agent[]>('/agents', { params });
export const getAgent = (id: string) => http.get<Agent>(`/agents/${id}`, {
  params: {
    _t: Date.now(), // 添加时间戳避免缓存
  },
  headers: {
    'Cache-Control': 'no-cache',
  },
});
export const createAgent = (data: Agent & { updateGlobalCore?: boolean }) => http.post<Agent>('/agents', data);
export const updateAgent = (id: string, data: Agent & { updateGlobalCore?: boolean }) => http.put<Agent>(`/agents/${id}`, data);
export const deleteAgent = (id: string) => http.delete(`/agents/${id}`);
export const duplicateAgent = (id: string) => http.post<Agent>(`/agents/${id}/duplicate`);

export const scrapeAgents = (url?: string) => http.post('/agents/scrape', { url });

// OSS upload via backend proxy - imports from utils
import { uploadFileViaBackend } from '../utils/ossUpload';

/**
 * Upload image file to OSS via backend proxy
 * @param file - Image file to upload
 * @param folder - Optional folder prefix (default: 'uploads')
 * @returns Object with url property containing the OSS public URL
 */
export const uploadImage = async (file: File, folder?: string) => {
  const result = await uploadFileViaBackend(file, { folder: folder || 'uploads' });
  return { url: result.url };
};

/**
 * Upload file to OSS via backend proxy (generic, supports any file type)
 * @param file - File to upload
 * @param folder - Optional folder prefix (default: 'uploads')
 * @returns Object with url property containing the OSS public URL
 */
export const uploadFile = async (file: File, folder?: string) => {
  const result = await uploadFileViaBackend(file, { folder: folder || 'uploads' });
  return { url: result.url };
};

export const generateImage = (
  description: string, 
  options?: { 
    count?: number; 
    width?: number; 
    height?: number; 
    provider?: 'fal' | 'volcengine';
    agentId?: string;
    userId?: string;
    useAvatar?: boolean;
    faceImageUrl?: string;
    skipBalanceCheck?: boolean;
    useImg2Img?: boolean;
  }
) => http.post<{ url: string; remoteUrl?: string; urls?: string[]; balance?: number; intimacy?: number }>('/generate-image', { description, ...options });

// Deprecated alias if needed, or just replace usages
export const generateAvatarImage = generateImage;

export const chatWithAgent = (agentId: string, prompt: string, history: { role: string; content: string }[] = [], skipImageGen?: boolean) => {
  return http.post<{ 
    reply: string; 
    audioUrl?: string; 
    ttsError?: string; 
    balance?: number; 
    imageUrl?: string; 
    intimacy?: number;
    detection?: {
      round: number;
      userType: string;
      isComplete: boolean;
      replyOptions: { text: string; style: string }[];
    };
  }>('/chat', { agentId, prompt, history, skipImageGen });
};

export const getChatHistory = (agentId: string) => http.get<{ 
  history: { role: string; content: string; audioUrl?: string }[]; 
  intimacy?: number;
  greeting?: { content: string; withImage?: boolean; mood?: string };
}>(`/chat/history/${agentId}`);

export const generateTTS = (agentId: string, text: string) => http.post<{ audioUrl: string; balance?: number }>('/chat/tts', { agentId, text });

export const generateVideo = (agentId: string, prompt: string, imageUrl?: string, fastMode?: boolean) => http.post<{ url: string; balance?: number; intimacy?: number }>('/generate-video', { agentId, prompt, imageUrl, fastMode });

export const syncVoiceModels = () => http.post<{ totalFetched: number; upserted: number; modified: number; truncated?: boolean; limit?: number; remoteTotal?: number }>('/voice-models/sync');

export const getVoiceModels = (params?: { favoriteOnly?: boolean }) =>
  http.get<VoiceModel[]>('/voice-models', {
    params: params?.favoriteOnly ? { favoriteOnly: true } : undefined,
  });

export const updateVoiceModelFavorite = (id: string, isFavorite: boolean) =>
  http.patch<VoiceModel>(`/voice-models/${id}/favorite`, { isFavorite });

export const updateVoiceModel = (id: string, data: Partial<VoiceModel>) =>
  http.patch<VoiceModel>(`/voice-models/${id}`, data);

export const deleteVoiceModel = (id: string) => http.delete(`/voice-models/${id}`);
export const batchDeleteVoiceModels = (ids: string[]) => http.delete('/voice-models/batch', { data: { ids } });

export const getVoicePreview = (id: string) => http.post<{ url: string; cached: boolean }>(`/voice-models/${id}/preview`);

export const extractVoiceId = (sourceUrl: string) => http.post<VoiceExtractResult>('/voice-models/extract', { sourceUrl });

export const createVoiceModelManual = (data: Partial<VoiceModel>) => http.post<VoiceModel>('/voice-models/create', data);
export const createVoiceTemplate = (sourceUrl: string) => http.post('/voice-models', { sourceUrl });

// User API
export const getUsers = (params?: { userType?: 'operator' | 'channel'; platform?: 'web' | 'android' | 'ios'; isActive?: boolean }) => 
  http.get<User[]>('/users', { params });
export const createUser = (data: Partial<User> & { password?: string }) => http.post<User>('/users', data);
export const rechargeUser = (userId: string, amount: number) => http.post<{ success: true; balance: number }>(`/users/${userId}/recharge`, { amount });
export const initAdminUser = () => http.post<User>('/users/init-admin');

// Channel User Auth API (public)
// For Android/iOS: Sync external user (creates if not exists, returns existing if exists)
export const syncExternalUser = (data: { 
  externalUserId: string; 
  platform: 'android' | 'ios'; 
  externalAppId?: string;
  email?: string; 
  phone?: string; 
  username?: string;
}) => 
  http.post<{ user: User; token: string; balance: number; isNew: boolean }>('/users/sync', data);

// For Web: Traditional register with username/password
export const registerChannelUser = (data: { username: string; password: string; email?: string; phone?: string; platform?: 'web' }) => 
  http.post<{ user: User; token: string }>('/users/register', data);

// Login (supports both web username/password and Android/iOS externalUserId)
export const loginChannelUser = (data: { 
  username?: string; 
  password?: string;
  externalUserId?: string;
  platform?: 'android' | 'ios';
}) => 
  http.post<{ user: User; token: string; balance: number }>('/users/login', data);

// ==================== AI UGC 相册 API ====================

export interface UgcImage {
  _id: string;
  agentId: string;
  imageUrl: string;
  prompt: string;
  generatedByUserId: string | null;
  sentToUserIds: string[];
  isNsfw: boolean;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UgcImageStats {
  sfwCount: number;
  nsfwCount: number;
  totalImages: number;
  maxPerCategory: number;
  totalUsage: number;
}

export interface UgcImageListResponse {
  images: UgcImage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 获取 UGC 相册列表
export const getUgcImages = (agentId: string, params?: { isNsfw?: boolean; isActive?: boolean; page?: number; limit?: number }) =>
  http.get<UgcImageListResponse>(`/agents/${agentId}/ugc-images`, { params });

// 获取 UGC 相册统计
export const getUgcImageStats = (agentId: string) =>
  http.get<UgcImageStats>(`/agents/${agentId}/ugc-images/stats`);

// 手动添加图片到相册
export const addUgcImage = (agentId: string, data: { imageUrl: string; prompt?: string; isNsfw?: boolean }) =>
  http.post<UgcImage>(`/agents/${agentId}/ugc-images`, data);

// 删除 UGC 图片
export const deleteUgcImage = (agentId: string, imageId: string) =>
  http.delete(`/agents/${agentId}/ugc-images/${imageId}`);

// 启用/禁用 UGC 图片
export const toggleUgcImageActive = (agentId: string, imageId: string, isActive: boolean) =>
  http.patch<UgcImage>(`/agents/${agentId}/ugc-images/${imageId}`, { isActive });

// 批量删除 UGC 图片
export const batchDeleteUgcImages = (agentId: string, imageIds: string[]) =>
  http.post<{ deletedCount: number }>(`/agents/${agentId}/ugc-images/batch-delete`, { imageIds });

// ==================== 运营仪表盘 API ====================

// Dashboard 概览
export const getDashboardOverview = () => 
  http.get<{
    overview: {
      totalAgents: number;
      activeAgents: number;
      totalUsers: number;
      activeUsersToday: number;
      totalRevenue: number;
      revenueToday: number;
    };
    trends: {
      users: { date: string; count: number }[];
      revenue: { date: string; amount: number }[];
      messages: { date: string; count: number }[];
    };
  }>('/analytics/dashboard');

// 告警相关
export interface Alert {
  _id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'ignored';
  agentId?: { _id: string; name: string };
  userId?: string;
  data?: {
    metric?: string;
    currentValue?: number;
    threshold?: number;
    changePercent?: number;
    details?: Record<string, unknown>;
  };
  duplicateCount: number;
  createdAt: string;
}

export interface AlertRule {
  _id: string;
  name: string;
  description?: string;
  type: string;
  conditions: {
    metric: string;
    operator: string;
    threshold: number;
    timeWindow: number;
    minSampleSize?: number;
  };
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notifications: {
    channels: { type: string; target: string; enabled: boolean }[];
    cooldown: number;
    maxPerDay: number;
  };
}

export const getAlertStats = () => 
  http.get<{ total: number; bySeverity: Record<string, number>; byType: Record<string, number> }>('/alert/stats');

export const getAlerts = (params?: { limit?: number; status?: string; severity?: string; type?: string }) =>
  http.get<{ count: number; alerts: Alert[] }>('/alert/list', { params });

export const acknowledgeAlert = (alertId: string) =>
  http.post(`/alert/${alertId}/acknowledge`);

export const acknowledgeAlertsBatch = (alertIds: string[]) =>
  http.post('/alert/acknowledge-batch', { alertIds });

export const resolveAlert = (alertId: string, resolution?: string) =>
  http.post(`/alert/${alertId}/resolve`, { resolution });

export const ignoreAlert = (alertId: string) =>
  http.post(`/alert/${alertId}/ignore`);

export const getAlertRules = () =>
  http.get<{ rules: AlertRule[] }>('/alert/rules/list');

export const toggleAlertRule = (ruleId: string) =>
  http.post<{ enabled: boolean; message: string }>(`/alert/rules/${ruleId}/toggle`);

export const runAlertCheck = () =>
  http.post<{ checks: unknown[]; alertsCreated: number; alertsUpdated: number }>('/alert/run-check');

export const initDefaultAlertRules = () =>
  http.post<{ message: string; count: number }>('/alert/rules/init-defaults');

// A/B 测试
export interface ABExperiment {
  _id: string;
  name: string;
  description?: string;
  agentId: { _id: string; name: string } | string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  variants: {
    id: string;
    name: string;
    prompt: string;
    allocation: number;
    isControl: boolean;
    metrics: {
      sessions: number;
      messages: number;
      gifts: number;
      giftValue: number;
      unlocks: number;
      nextDayRetention: number;
      totalUsers: number;
    };
  }[];
  winner?: string;
  confidenceLevel?: number;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export const getABExperiments = (params?: { agentId?: string; status?: string }) =>
  http.get<{ experiments: ABExperiment[] }>('/analytics/ab-test/list', { params });

export const getABExperimentResults = (experimentId: string) =>
  http.get<{
    experiment: { id: string; name: string; status: string; runningDays: number };
    variants: { id: string; name: string; score: number; metrics: Record<string, number> }[];
    totalUsers: number;
    canConclude: boolean;
    winner?: string;
    confidenceLevel?: number;
  }>(`/analytics/ab-test/${experimentId}`);

export const createABExperiment = (data: { agentId: string; variants: { name?: string; prompt: string }[]; name?: string; description?: string }) =>
  http.post<{ experiment: ABExperiment }>('/analytics/ab-test/create', data);

export const startABExperiment = (experimentId: string) =>
  http.post<{ experiment: ABExperiment }>(`/analytics/ab-test/${experimentId}/start`);

export const endABExperiment = (experimentId: string, applyWinner?: boolean) =>
  http.post(`/analytics/ab-test/${experimentId}/end`, { applyWinner });

export const applyABWinner = (experimentId: string) =>
  http.post(`/analytics/ab-test/${experimentId}/apply`);

// 召回相关
export interface RecallCandidate {
  userId: string;
  agentId: { _id: string; name: string };
  intimacy: number;
  totalMessages: number;
  aiAnalysis?: {
    spending?: { ltv: number; ltvTier: string };
    behavior?: { daysSinceLastActive: number; churnRisk: string };
  };
  recallPriority: number;
  suggestedRecallType: string;
}

export const getRecallCandidates = (params?: { minDays?: number; maxDays?: number; limit?: number }) =>
  http.get<{ count: number; candidates: RecallCandidate[] }>('/analytics/recall/candidates', { params });

export const executeRecall = (limit?: number) =>
  http.post<{ sent: number; skipped: number; total: number }>('/analytics/recall/execute', { limit });

export const getRecallEffectiveness = (days?: number) =>
  http.get<{ totalSent: number; returned: number; returnRate: number; byType: Record<string, { sent: number; returned: number; returnRate: number }> }>('/analytics/recall/effectiveness', { params: { days } });

// 用户分析
export const getUserSegmentation = () =>
  http.get<{
    byLTV: Record<string, number>;
    byActivity: Record<string, number>;
    byChurnRisk: Record<string, number>;
    total: number;
  }>('/analytics/users/segmentation');

export const getHighChurnRiskUsers = (limit?: number) =>
  http.get<{ count: number; users: unknown[] }>('/analytics/users/churn-risk', { params: { limit } });

// 内容分析
export const getContentOverview = (agentId: string) =>
  http.get<{
    total: number;
    byStatus: Record<string, number>;
    avgScore: number;
    topContent: unknown[];
  }>(`/analytics/content/overview/${agentId}`);

// 对话质量
export const getConversationScores = (agentId: string, days?: number) =>
  http.get(`/analytics/conversation/scores/${agentId}`, { params: { days } });

// 手动触发任务
export const getAvailableTasks = () =>
  http.get<{ tasks: { name: string; description: string }[] }>('/analytics/tasks/list');

export const runTask = (taskName: string) =>
  http.post<{ task: string; result: unknown }>('/analytics/tasks/run', { taskName });

// ==================== 用户创建角色 API ====================

export interface UserAgent {
  _id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  style?: 'realistic' | 'anime';
  description?: string;
  avatarUrls?: string[];
  systemPrompt?: string;
  voiceId?: string;
  defaultGreeting?: string;
  visibility: 'private' | 'pending' | 'public' | 'rejected';
  creatorType: 'official' | 'user';
  creatorId?: string;
  status?: 'online' | 'offline';
  stats?: {
    totalChats: number;
    uniqueUsers: number;
    avgRating: number;
    totalRatings: number;
  };
  reviewStatus?: {
    submittedAt?: string;
    reviewedAt?: string;
    reviewerId?: string;
    rejectReason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserAgentData {
  name: string;
  gender?: 'male' | 'female' | 'other';
  style?: 'realistic' | 'anime';
  description?: string;
  avatarUrls?: string[];
  systemPrompt?: string;
  voiceId?: string;
  defaultGreeting?: string;
}

// 创建我的角色
export const createUserAgent = (data: CreateUserAgentData) =>
  http.post<UserAgent>('/user-agents/create', data);

// 获取我的角色列表
export const getMyAgents = () =>
  http.get<UserAgent[]>('/user-agents/my-agents');

// 获取我的角色详情
export const getUserAgent = (id: string) =>
  http.get<UserAgent>(`/user-agents/${id}`);

// 编辑我的角色
export const updateUserAgent = (id: string, data: Partial<CreateUserAgentData>) =>
  http.put<UserAgent>(`/user-agents/${id}`, data);

// 删除我的角色
export const deleteUserAgent = (id: string) =>
  http.delete(`/user-agents/${id}`);

// 提交审核
export const submitAgentForReview = (id: string) =>
  http.post<UserAgent>(`/user-agents/${id}/submit-review`);

// 撤回审核
export const withdrawAgentReview = (id: string) =>
  http.post<UserAgent>(`/user-agents/${id}/withdraw-review`);

// ==================== 管理员审核 API ====================

export interface ReviewAgent extends Omit<UserAgent, 'creatorId'> {
  creatorId?: {
    _id: string;
    username: string;
    email?: string;
    avatar?: string;
  } | string;
}

export interface PendingReviewResponse {
  agents: ReviewAgent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AllReviewAgentsResponse {
  agents: ReviewAgent[];
  stats: {
    private: number;
    pending: number;
    public: number;
    rejected: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// 获取待审核列表
export const getPendingReviewAgents = (params?: { page?: number; limit?: number }) =>
  http.get<PendingReviewResponse>('/admin/review/pending', { params });

// 获取所有用户创建的角色
export const getAllUserAgents = (params?: { 
  page?: number; 
  limit?: number; 
  visibility?: string;
  creatorId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) =>
  http.get<AllReviewAgentsResponse>('/admin/review/all', { params });

// 获取审核详情
export const getReviewAgentDetail = (id: string) =>
  http.get<ReviewAgent>(`/admin/review/${id}`);

// 审核通过
export const approveAgent = (id: string) =>
  http.post<ReviewAgent>(`/admin/review/${id}/approve`);

// 审核拒绝
export const rejectAgent = (id: string, reason: string) =>
  http.post<ReviewAgent>(`/admin/review/${id}/reject`, { reason });

// 设置可见性（管理员强制操作）
export const setAgentVisibility = (id: string, visibility: 'private' | 'public' | 'rejected', reason?: string) =>
  http.post<ReviewAgent>(`/admin/review/${id}/set-visibility`, { visibility, reason });

// ==================== 论坛式剧情模式 API ====================

export interface StoryState {
  scene: string;
  time: string;
  mood: string;
  action?: string;
  clothes: string;
  expression?: string;
  lastAction: string;
}

export interface StoryAffection {
  level: number;       // 0-100
  stage: '陌生' | '熟悉' | '暧昧' | '热恋' | '深爱';
  lastChange: number;  // 上次变化值（如 +5）
}

export interface StoryParagraph {
  content: string;
  imageUrl?: string;      // 每层楼的配图
  imagePrompt?: string;   // 图片生成使用的 prompt
  source: 'ai' | 'user_input';
  userInput?: string;
  createdAt: string;
}

export interface StorySession {
  sessionId: string;
  agentId: string;
  agentName?: string;
  agentAvatar?: string;
  progress: number;
  state: StoryState;
  paragraphs: StoryParagraph[];
  totalParagraphs: number;
  status: 'active' | 'completed' | 'abandoned';
  isExisting?: boolean;
}

export interface StoryStartResponse {
  sessionId: string;
  opening: string;
  openingImageUrl?: string | null;  // 开场配图
  progress: number;
  state: StoryState;
  affection: StoryAffection;  // 好感度数据
  paragraphs: StoryParagraph[];
  isExisting: boolean;
  imageGenerating?: boolean; // 是否有图片正在生成
}

export interface StoryContinueResponse {
  content: string;
  imageUrl?: string | null;  // 图片 URL（异步生成时为 null）
  imagePrompt?: string;      // 图片生成使用的 prompt
  paragraphIndex?: number;   // 段落索引（用于轮询图片）
  progress: number;
  state: StoryState;
  affection?: StoryAffection;  // 好感度数据
  isEnding: boolean;
  balance?: number;
  cost?: number;
  imageGenerating?: boolean; // 是否有图片正在生成
}

export interface StoryPhotoResponse {
  imageUrl: string;
  prompt: string;
  balance?: number;
  cost?: number;
}

export interface ParagraphImageResponse {
  imageUrl: string | null;
  imageReady: boolean;
}

// 开始新故事
export const startStory = (agentId: string) =>
  http.post<StoryStartResponse>('/story/start', { agentId });

// AI 自动推进剧情
export const continueStory = (sessionId: string) =>
  http.post<StoryContinueResponse>('/story/continue', { sessionId });

// 用户输入推进剧情
export const inputStory = (sessionId: string, userInput: string) =>
  http.post<StoryContinueResponse>('/story/input', { sessionId, userInput });

// 获取故事状态
export const getStoryState = (sessionId: string) =>
  http.get<StorySession>(`/story/${sessionId}`);

// 重新开始故事
export const restartStory = (agentId: string) =>
  http.post<StoryStartResponse>('/story/restart', { agentId });

// 获取用户所有活跃故事
export const getUserStorySessions = () =>
  http.get<{ agentId: { _id: string; name: string; avatarUrls: string[] }; progress: number; updatedAt: string }[]>('/story/user/sessions');

// 生成角色写真
export const generateStoryPhoto = (sessionId: string) =>
  http.post<StoryPhotoResponse>('/story/photo', { sessionId });

// 获取段落图片状态（用于轮询）
export const getParagraphImage = (sessionId: string, paragraphIndex: number) =>
  http.get<ParagraphImageResponse>(`/story/${sessionId}/image/${paragraphIndex}`);
