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
export const getAgent = (id: string) => http.get<Agent>(`/agents/${id}`);
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

export const getChatHistory = (agentId: string) => http.get<{ history: { role: string; content: string; audioUrl?: string }[]; intimacy?: number }>(`/chat/history/${agentId}`);

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
