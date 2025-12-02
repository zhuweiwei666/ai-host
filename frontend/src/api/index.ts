import { http } from './http';
export { http };

export interface Agent {
  _id?: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  style?: 'realistic' | 'anime';
  avatarUrl: string;
  coverVideoUrl?: string; // Video preview on hover
  privatePhotoUrl?: string; // Added for NSFW/Paid variant
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
  _id: string;
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

export const scrapeAgents = (url?: string) => http.post('/agents/scrape', { url });

// OSS direct upload - imports from utils
import { uploadToOSS } from '../utils/ossUpload';

/**
 * Upload image file directly to OSS
 * @returns Object with url property containing the OSS public URL
 */
export const uploadImage = async (file: File) => {
  const url = await uploadToOSS(file);
  return { url };
};

/**
 * Upload file directly to OSS (generic, supports any file type)
 * @returns Object with url property containing the OSS public URL
 */
export const uploadFile = async (file: File) => {
  const url = await uploadToOSS(file);
  return { url };
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
  return http.post<{ reply: string; audioUrl?: string; ttsError?: string; balance?: number; imageUrl?: string; intimacy?: number }>('/chat', { agentId, prompt, history, skipImageGen });
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
export const registerChannelUser = (data: { username: string; password: string; email?: string; phone?: string; platform?: 'web' | 'android' | 'ios' }) => 
  http.post<{ user: User; token: string }>('/users/register', data);
export const loginChannelUser = (data: { username: string; password: string }) => 
  http.post<{ user: User; token: string; balance: number }>('/users/login', data);
