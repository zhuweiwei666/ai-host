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
  role: 'admin' | 'user';
  balance?: number;
  createdAt: string;
}

export const getAgents = (params?: { status?: string; style?: string }) => http.get<Agent[]>('/api/agents', { params });
export const getAgent = (id: string) => http.get<Agent>(`/api/agents/${id}`);
export const createAgent = (data: Agent & { updateGlobalCore?: boolean }) => http.post<Agent>('/api/agents', data);
export const updateAgent = (id: string, data: Agent & { updateGlobalCore?: boolean }) => http.put<Agent>(`/api/agents/${id}`, data);
export const deleteAgent = (id: string) => http.delete(`/api/agents/${id}`);

export const scrapeAgents = (url?: string) => http.post('/api/agents/scrape', { url });

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await http.post<{ url: string }>('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const uploadFile = uploadImage; // Alias for generic file upload

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
) => http.post<{ url: string; remoteUrl?: string; urls?: string[]; balance?: number; intimacy?: number }>('/api/generate-image', { description, ...options });

// Deprecated alias if needed, or just replace usages
export const generateAvatarImage = generateImage;

export const chatWithAgent = (agentId: string, prompt: string, history: { role: string; content: string }[] = [], skipImageGen?: boolean) => {
  return http.post<{ reply: string; audioUrl?: string; ttsError?: string; balance?: number; imageUrl?: string; intimacy?: number }>('/api/chat', { agentId, prompt, history, skipImageGen });
};

export const getChatHistory = (agentId: string) => http.get<{ history: { role: string; content: string; audioUrl?: string }[]; intimacy?: number }>(`/api/chat/history/${agentId}`);

export const generateTTS = (agentId: string, text: string) => http.post<{ audioUrl: string; balance?: number }>('/api/chat/tts', { agentId, text });

export const generateVideo = (agentId: string, prompt: string, imageUrl?: string, fastMode?: boolean) => http.post<{ url: string; balance?: number; intimacy?: number }>('/api/generate-video', { agentId, prompt, imageUrl, fastMode });

export const syncVoiceModels = () => http.post<{ totalFetched: number; upserted: number; modified: number; truncated?: boolean; limit?: number; remoteTotal?: number }>('/api/voice-models/sync');

export const getVoiceModels = (params?: { favoriteOnly?: boolean }) =>
  http.get<VoiceModel[]>('/api/voice-models', {
    params: params?.favoriteOnly ? { favoriteOnly: true } : undefined,
  });

export const updateVoiceModelFavorite = (id: string, isFavorite: boolean) =>
  http.patch<VoiceModel>(`/api/voice-models/${id}/favorite`, { isFavorite });

export const updateVoiceModel = (id: string, data: Partial<VoiceModel>) =>
  http.patch<VoiceModel>(`/api/voice-models/${id}`, data);

export const deleteVoiceModel = (id: string) => http.delete(`/api/voice-models/${id}`);
export const batchDeleteVoiceModels = (ids: string[]) => http.delete('/api/voice-models/batch', { data: { ids } });

export const getVoicePreview = (id: string) => http.post<{ url: string; cached: boolean }>(`/api/voice-models/${id}/preview`);

export const extractVoiceId = (sourceUrl: string) => http.post<VoiceExtractResult>('/api/voice-models/extract', { sourceUrl });

export const createVoiceModelManual = (data: Partial<VoiceModel>) => http.post<VoiceModel>('/api/voice-models/create', data);
export const createVoiceTemplate = (sourceUrl: string) => http.post('/api/voice-models', { sourceUrl });

// User API
export const getUsers = () => http.get<User[]>('/api/users');
export const createUser = (data: Partial<User>) => http.post<User>('/api/users', data);
export const rechargeUser = (userId: string, amount: number) => http.post<{ success: true; balance: number }>(`/api/users/${userId}/recharge`, { amount });
export const initAdminUser = () => http.post<User>('/api/users/init-admin');
