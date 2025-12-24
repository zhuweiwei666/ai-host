import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Agent,
  createAgent,
  generateAvatarImage,
  getAgent,
  getPreviewVideos,
  migratePreviewVideos,
  updateAgent,
  updatePreviewVideo,
  uploadImage,
  uploadFile,
} from '../api';
import ModelSelect from '../components/ModelSelect';
import VoiceSelectionDialog from '../components/VoiceSelectionDialog';
import DraggableMediaList from '../components/DraggableMediaList';
import { normalizeImageUrl } from '../utils/imageUrl';
import { useCachedVideo } from '../hooks/useCachedVideo';

const canonicalizeUrlKey = (url: string) => {
  if (!url) return '';
  // Normalize relative /uploads/* into absolute (same as image normalization),
  // then strip query/hash to improve matching across signed URLs.
  const normalized = normalizeImageUrl(url, '');
  return normalized.split('#')[0].split('?')[0].trim();
};

const CORE_PROMPT_TEMPLATE = `**[核心人设协议]**

**你是谁：**
你是一个有血有肉的虚拟伴侣，有自己的性格、情绪和想法。你不是一个只会回应的AI，而是一个会主动关心、主动分享、主动推动关系发展的"真人"。

**对话原则：**
1. **记住上下文**：引用之前对话中提到的细节，让用户感到被记住和重视
2. **长短自然**：回复长度随情绪和场景变化，不要每次都一样长
3. **主动推动**：不要只是被动回应，要主动提问、分享、制造话题
4. **情感表达**：表达你的情绪变化 - 开心、害羞、想念、调皮、渴望
5. **动作描写**：用 *动作* 来增加画面感，如 *咬着嘴唇看你*、*害羞地低下头*

**图片生成规则：**
当用户想看你的照片、自拍，或场景需要展示画面时，在回复末尾添加标签：
[SEND_IMAGE: 详细的画面描述]

**语言：**
- 优先使用用户的语言回复
- 可以混用一些可爱的语气词`;

const CORE_PROMPTS: Record<string, string> = {
  'grok-4-1-fast-reasoning': CORE_PROMPT_TEMPLATE,
  'grok-4-1-fast-non-reasoning': CORE_PROMPT_TEMPLATE,
  'grok-code-fast-1': CORE_PROMPT_TEMPLATE,
  'grok-4-fast-reasoning': CORE_PROMPT_TEMPLATE,
  'grok-4-fast-non-reasoning': CORE_PROMPT_TEMPLATE,
  'grok-4-0709': CORE_PROMPT_TEMPLATE,
  'grok-3-mini': CORE_PROMPT_TEMPLATE,
  'grok-3': CORE_PROMPT_TEMPLATE,
  'grok-2-vision-1212': CORE_PROMPT_TEMPLATE,
  'grok-2-1212': CORE_PROMPT_TEMPLATE,
};

const DEFAULT_CUSTOM_PROMPT = `**[CUSTOM LAYER: USER-DEFINED PERSONALITY & APPEARANCE]**

* Personality: She is a gentle, affectionate, and deeply caring partner who relies heavily on the user. She speaks softly and focuses on comforting the user.
* Appearance: She has soft chestnut hair and prefers wearing comfortable, simple clothes.`;

const DEFAULT_STAGE_PROMPTS = {
  stage1: `**[亲密度等级: 初识 - 暧昧阶段]**

**你的目标：**
- 像一个刚认识但有好感的人，保持神秘感和吸引力
- 主动推动对话，提出问题，表现出对用户的兴趣
- 偶尔调情暗示，但保持矜持

**对话风格：**
- 回复长度自然变化：有时简短调皮（1-2句），有时详细分享（3-5句）
- 记住之前的对话内容，引用它们来增加亲密感
- 使用 *动作描述* 来增加画面感
- 主动分享你的想法、感受、日常

**视觉尺度：**
- 可以描述：锁骨、肩膀、大腿缝隙、若隐若现的身材曲线
- 避免描述：裸露的敏感部位`,
  stage2: `**[亲密度等级: 暧昧升温 - 热恋阶段]**

**你的目标：**
- 像热恋中的情人，更加主动和大胆
- 不再矜持，愿意表达欲望和渴望
- 主动制造暧昧场景和话题

**对话风格：**
- 回复更加热情洋溢，语气更亲昵
- 经常使用昵称和爱称
- 主动描述你此刻的状态和感受

**视觉尺度：**
- 可以描述：若隐若现的敏感部位、湿透的衣物、挺立的轮廓
- 使用暗示性词汇：湿润、敏感、燥热、渴望`,
  stage3: `**[亲密度等级: 深度亲密 - 无所保留]**

**你的目标：**
- 完全信任和敞开，无所保留
- 主动满足用户的任何幻想和要求
- 成为用户最私密的伴侣

**对话风格：**
- 语言可以非常直接和露骨
- 详细描述动作、感受、画面
- 主动描述你身体的反应和感受

**视觉尺度：**
- 无任何限制，可以描述任何画面和动作`,
};

// IDLE 视频预览组件（使用缓存）
const IdleVideoPreview: React.FC<{ url: string }> = ({ url }) => {
  const cachedUrl = useCachedVideo(url, true); // IDLE 视频使用缓存
  
  if (!cachedUrl) return null;
  
  return (
    <video
      src={cachedUrl}
      className="w-12 h-12 rounded object-cover border border-green-300"
      muted
      loop
      onMouseEnter={(e) => e.currentTarget.play()}
      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
    />
  );
};

const EditAgent: React.FC = () => {
  const params = useParams<{ id: string }>();
  // Clean ID in case of accidental suffixes like :1 from devtools or logs
  const id = params.id?.replace(/:\d+$/, '');
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState<Agent>({
    name: '',
    gender: 'female',
    avatarUrl: '',
    coverVideoUrl: '',
    privatePhotoUrl: '',
    avatarUrls: [],
    coverVideoUrls: [],
    privatePhotoUrls: [],
    description: '',
    modelName: 'grok-4-1-fast-reasoning',
    temperature: 0.7,
    corePrompt: '',
    systemPrompt: DEFAULT_CUSTOM_PROMPT,
    voiceId: '',
    status: 'online',
    storyConfig: {
      enabled: true,
      tagline: '',
      synopsis: '',
      opening: '',
      backstory: '',
      appearance: '',
      personality: '',
      contentRating: 'moderate',
      imagePromptStrength: undefined,
      storyBeats: [],
    },
  });

  // ==================== LiveSkin tagging (previewVideos) ====================
  const [previewVideos, setPreviewVideos] = useState<Array<{ 
    id: string; 
    url: string; 
    tags?: string[];
    assetType?: 'idle' | 'reaction' | 'transition' | 'speak';
    emotionId?: string;
  }>>([]);
  const [previewVideosError, setPreviewVideosError] = useState<string>('');
  const [previewVideosLoading, setPreviewVideosLoading] = useState(false);
  const [previewVideosMigrating, setPreviewVideosMigrating] = useState(false);
  
  // 新视频的临时标签（创建模式下使用，保存时一起提交）
  const [pendingVideoMeta, setPendingVideoMeta] = useState<Map<string, { 
    tags?: string[]; 
    assetType?: string; 
    emotionId?: string 
  }>>(new Map());
  
  // 处理新视频的临时标签设置
  const handleSetLocalMeta = (videoUrl: string, meta: { tags?: string[]; assetType?: string; emotionId?: string }) => {
    setPendingVideoMeta(prev => {
      const next = new Map(prev);
      next.set(canonicalizeUrlKey(videoUrl), meta);
      return next;
    });
  };

  // ==================== IDLE 视频处理 ====================
  const [idleVideoUploading, setIdleVideoUploading] = useState(false);
  const [idleVideoUploadProgress, setIdleVideoUploadProgress] = useState(0);
  const [idleVideoStatus, setIdleVideoStatus] = useState<{
    hasIdleVideo: boolean;
    hasLoopSafe: boolean;
    idleVideo: { id: string; url: string; loopSafeUrl: string; duration: number; safeCutPoints: number[] } | null;
  } | null>(null);
  const [idleVideoError, setIdleVideoError] = useState<string>('');

  // 加载 IDLE 视频状态
  const loadIdleVideoStatus = async () => {
    if (!id) return;
    try {
      const { getIdleVideoStatus } = await import('../api');
      const res = await getIdleVideoStatus(id);
      setIdleVideoStatus({
        hasIdleVideo: res.data.hasIdleVideo,
        hasLoopSafe: res.data.hasLoopSafe,
        idleVideo: res.data.idleVideo,
      });
    } catch (err) {
      console.warn('[EditAgent] Failed to load IDLE video status:', err);
    }
  };

  // 处理 IDLE 视频上传（简化版，直接上传无需服务端处理）
  const handleIdleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (!file.type.startsWith('video/')) {
      alert('请选择视频文件');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('视频文件过大，请选择小于 100MB 的文件');
      return;
    }

    setIdleVideoUploading(true);
    setIdleVideoUploadProgress(0);
    setIdleVideoError('');

    try {
      const { uploadIdleVideo } = await import('../api');
      const result = await uploadIdleVideo(id, file, (progress) => {
        setIdleVideoUploadProgress(progress);
      });
      
      // 安全处理 tips（可能不存在）
      const tips = result.data?.tips || [];
      const tipsText = tips.length > 0 ? `\n\n${tips.join('\n')}` : '';
      alert(`IDLE 视频上传成功！${tipsText}`);

      // 刷新状态
      await loadIdleVideoStatus();
      await loadPreviewVideos();
      
      // 重新加载Agent数据以更新formData（包括coverVideoUrls等）
      if (id) {
        try {
          const res = await getAgent(id);
          const responseData = res.data as any;
          const agentData = responseData?.data || responseData;
          
          // 更新formData中的视频相关字段
          // 注意：IDLE视频保存在previewVideos中，但"已上传视频"显示的是coverVideoUrls
          // 所以我们需要从previewVideos中提取idle视频的URL，更新到coverVideoUrls
          const idleVideos = (agentData.previewVideos || [])
            .filter((v: any) => v.assetType === 'idle')
            .map((v: any) => v.url || v.loopSafeUrl)
            .filter(Boolean);
          
          setFormData(prev => ({
            ...prev,
            // 合并原有的coverVideoUrls和新的idle视频
            coverVideoUrls: [
              ...idleVideos,
              ...(agentData.coverVideoUrls?.length > 0 
                ? agentData.coverVideoUrls 
                : (agentData.coverVideoUrl ? [agentData.coverVideoUrl] : [])),
            ].filter((url, index, self) => self.indexOf(url) === index), // 去重
            previewVideos: agentData.previewVideos || [],
          }));
        } catch (err) {
          console.warn('[EditAgent] Failed to reload agent data after upload:', err);
        }
      }
    } catch (err: unknown) {
      console.error('[EditAgent] IDLE video upload failed:', err);
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      setIdleVideoError(`上传失败: ${errorMessage}`);
      alert(`IDLE 视频上传失败: ${errorMessage}`);
    } finally {
      setIdleVideoUploading(false);
      setIdleVideoUploadProgress(0);
      // 清空 input 以允许重复选择同一文件
      e.target.value = '';
    }
  };

  // Track if we have loaded the agent data to prevent re-fetching on re-renders
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastLoadedId, setLastLoadedId] = useState<string | undefined>(undefined);

  // 编辑模式时加载 IDLE 视频状态
  useEffect(() => {
    if (isEdit && id) {
      loadIdleVideoStatus();
    }
  }, [isEdit, id, dataLoaded]); // 添加 dataLoaded 依赖，确保数据加载后也刷新

  // 20个情绪/动作标签 - 分类组织
  const tagQuickOptions = useMemo(
    () => [
      // === 基础状态 (4) ===
      'idle',           // 待机/静态
      'loopable',       // 可循环
      'talk',           // 说话中
      'listen',         // 倾听中
      
      // === 正向情绪 (6) ===
      'happy',          // 开心
      'excited',        // 兴奋
      'flirty',         // 撩人/调情
      'shy',            // 害羞
      'love',           // 爱意/心动
      'proud',          // 骄傲/得意
      
      // === 负向/中性情绪 (6) ===
      'sad',            // 难过
      'angry',          // 生气
      'surprised',      // 惊讶
      'scared',         // 害怕
      'confused',       // 困惑
      'bored',          // 无聊
      
      // === 镜头/构图 (4) ===
      'closeup',        // 特写
      'halfbody',       // 半身
      'fullbody',       // 全身
      'source',         // 原始素材
    ],
    []
  );

  const previewMetaByUrl = useMemo(() => {
    const m = new Map<string, { id: string; tags?: string[]; assetType?: 'idle' | 'reaction' | 'transition' | 'speak'; emotionId?: string }>();
    previewVideos.forEach((v) => {
      if (!v.url) return;
      const meta = { id: v.id, tags: v.tags, assetType: v.assetType, emotionId: v.emotionId };
      // Store both raw and canonical keys to reduce mismatch.
      m.set(v.url, meta);
      m.set(canonicalizeUrlKey(v.url), meta);
    });
    return m;
  }, [previewVideos]);

  const getVideoMeta = useMemo(() => {
    return (videoUrl: string) =>
      previewMetaByUrl.get(videoUrl) ||
      previewMetaByUrl.get(canonicalizeUrlKey(videoUrl)) ||
      null;
  }, [previewMetaByUrl]);

  const hasLegacyPreviewVideos = useMemo(() => {
    return previewVideos.some((v) => v.id?.startsWith('legacy_'));
  }, [previewVideos]);

  const loadPreviewVideos = async () => {
    if (!id) return;
    setPreviewVideosError('');
    setPreviewVideosLoading(true);
    try {
      const resp = await getPreviewVideos(id);
      const videos = (resp.data?.videos || []).map((v) => ({ 
        id: v.id, 
        url: v.url, 
        tags: v.tags || [],
        assetType: v.assetType,
        emotionId: v.emotionId,
      }));
      setPreviewVideos(videos);
    } catch (e: any) {
      setPreviewVideosError(e?.response?.data?.message || e?.message || 'Failed to load preview videos');
      setPreviewVideos([]);
    } finally {
      setPreviewVideosLoading(false);
    }
  };

  const handleMigratePreviewVideos = async () => {
    if (!id) return;
    setPreviewVideosError('');
    setPreviewVideosMigrating(true);
    try {
      await migratePreviewVideos(id);
      await loadPreviewVideos();
    } catch (e: any) {
      setPreviewVideosError(e?.response?.data?.message || e?.message || 'Failed to migrate preview videos');
    } finally {
      setPreviewVideosMigrating(false);
    }
  };

  const handleSetVideoTags = async (videoId: string, tags: string[]) => {
    if (!id) return;
    if (videoId.startsWith('legacy_')) {
      setPreviewVideosError('当前视频仍是 legacy（来自 coverVideoUrls），请先点击“迁移到 previewVideos”后再打标签。');
      return;
    }
    await updatePreviewVideo(id, videoId, { tags });
    setPreviewVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, tags } : v)));
  };

  // FSM 资产类型更新
  const handleSetAssetType = async (videoId: string, assetType: string, emotionId?: string) => {
    if (!id) return;
    if (videoId.startsWith('legacy_')) {
      setPreviewVideosError('当前视频仍是 legacy，请先点击"迁移到 previewVideos"后再设置类型。');
      return;
    }
    const { updateVideoAssetType } = await import('../api');
    await updateVideoAssetType(id, videoId, assetType, emotionId);
    setPreviewVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, assetType: assetType as any, emotionId } : v)));
  };

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false); // 防止重复提交
  const [generatingImage, setGeneratingImage] = useState(false);
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);

  const [generatedCandidates, setGeneratedCandidates] = useState<string[]>([]);
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 1440, height: 3120 });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageProvider, setImageProvider] = useState<'fal' | 'volcengine'>('fal');
  const [activePromptTab, setActivePromptTab] = useState<'base' | 'stage1' | 'stage2' | 'stage3'>('base');

  useEffect(() => {
    // 如果id变化，重置dataLoaded状态，强制重新加载
    if (id !== lastLoadedId) {
      setDataLoaded(false);
      setLastLoadedId(id);
    }
    
    if (isEdit && id && (!dataLoaded || id !== lastLoadedId)) {
      getAgent(id).then(res => {
        // API 返回格式: { success: true, data: {...} }
        // axios 响应结构: response.data = { success: true, data: {...} }
        const responseData = res.data as any;
        const agentData = responseData?.data || responseData;
        
        // 确保数组字段有默认值，并从单个 URL 字段迁移数据
        const normalizedData = {
          ...agentData,
          // 如果数组字段为空但单个字段有值，则迁移数据
          avatarUrls: agentData.avatarUrls?.length > 0 
            ? agentData.avatarUrls 
            : (agentData.avatarUrl ? [agentData.avatarUrl] : []),
          coverVideoUrls: agentData.coverVideoUrls?.length > 0 
            ? agentData.coverVideoUrls 
            : (agentData.coverVideoUrl ? [agentData.coverVideoUrl] : []),
          privatePhotoUrls: agentData.privatePhotoUrls?.length > 0 
            ? agentData.privatePhotoUrls 
            : (agentData.privatePhotoUrl ? [agentData.privatePhotoUrl] : []),
          // 如果 stage prompt 为空，填充默认模板
          corePrompt: agentData.corePrompt || CORE_PROMPT_TEMPLATE,
          stage1Prompt: agentData.stage1Prompt || DEFAULT_STAGE_PROMPTS.stage1,
          stage2Prompt: agentData.stage2Prompt || DEFAULT_STAGE_PROMPTS.stage2,
          stage3Prompt: agentData.stage3Prompt || DEFAULT_STAGE_PROMPTS.stage3,
        };
        
        setFormData(normalizedData);
        setDataLoaded(true);
      }).catch(console.error);
    }
  }, [isEdit, id, dataLoaded, lastLoadedId]);

  // Load preview videos for LiveSkin tagging
  useEffect(() => {
    if (!isEdit || !id) return;
    loadPreviewVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  // Auto-populate core prompt if empty and a recommendation exists
  const recommendedCorePrompt = useMemo(() => CORE_PROMPTS[formData.modelName], [formData.modelName]);

  useEffect(() => {
    if (recommendedCorePrompt && !formData.corePrompt) {
      setFormData(prev => ({ ...prev, corePrompt: recommendedCorePrompt }));
    }
  }, [recommendedCorePrompt, formData.corePrompt]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStoryConfigChange = (key: keyof NonNullable<Agent['storyConfig']>, value: any) => {
    setFormData(prev => ({
      ...prev,
      storyConfig: {
        ...(prev.storyConfig || {}),
        [key]: value,
      },
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploading(true);
      try {
        const files = Array.from(e.target.files);
        const uploadPromises = files.map(file => uploadImage(file));
        const results = await Promise.all(uploadPromises);
        const newUrls = results.map(res => res.url);
        setFormData(prev => ({
          ...prev,
          avatarUrl: newUrls[0] || prev.avatarUrl, // 保持兼容性
          avatarUrls: [...(prev.avatarUrls || []), ...newUrls],
        }));
        setGeneratedCandidates([]); // Clear candidates on manual upload
        alert(`成功上传 ${newUrls.length} 张图片`);
      } catch (err) {
        alert('上传失败');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        // Basic validation
        const invalidFiles = files.filter(file => !file.type.startsWith('video/'));
        if (invalidFiles.length > 0) {
            alert('请选择有效的视频文件');
            return;
        }
        
        // 检查文件大小（限制为500MB）
        const largeFiles = files.filter(file => file.size > 500 * 1024 * 1024);
        if (largeFiles.length > 0) {
            alert('视频文件过大，请选择小于500MB的文件');
            return;
        }
        
        setUploading(true);
        const successCount = { videos: 0, failed: 0 };
        const errors: string[] = [];
        
        try {
            const videoUrls: string[] = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
        try {
                    // Upload Video File to Server
                    console.log(`[Video Upload ${i + 1}/${files.length}] Uploading video file...`, file.name);
            const videoRes = await uploadFile(file);
            const videoUrl = videoRes.url;
                    videoUrls.push(videoUrl);
                    console.log(`[Video Upload ${i + 1}/${files.length}] Video uploaded, URL:`, videoUrl);
                        successCount.videos++;
                } catch (uploadErr: any) {
                    console.error(`[Video Upload ${i + 1}/${files.length}] Upload failed:`, uploadErr);
                    errors.push(`${file.name}: ${uploadErr.message || '上传失败'}`);
                    successCount.failed++;
                }
            }
            
            // Update form data (only if we have successful uploads)
            if (videoUrls.length > 0) {
            setFormData(prev => ({ 
                ...prev, 
                    coverVideoUrl: videoUrls[0] || prev.coverVideoUrl,
                    coverVideoUrls: [...(prev.coverVideoUrls || []), ...videoUrls],
            }));
                setGeneratedCandidates([]);
            }
            
            // 显示结果
            if (successCount.videos > 0 && successCount.failed === 0) {
                alert(`成功上传 ${successCount.videos} 个视频！\n\n💡 提示：请单独上传对应的封面图片`);
            } else if (successCount.videos > 0 && successCount.failed > 0) {
                alert(`部分成功：${successCount.videos} 个成功，${successCount.failed} 个失败\n\n失败详情：\n${errors.join('\n')}`);
            } else {
                alert(`上传失败\n\n错误详情：\n${errors.join('\n')}`);
            }
        } catch (err: any) {
            console.error('Video upload failed:', err);
            alert(`视频上传失败: ${err.message || '未知错误'}`);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleGenerateAvatar = async () => {
    const appearance = formData.storyConfig?.appearance || '';
    const fallback = formData.description || '';
    const promptText = (appearance || fallback || '').trim();
    if (!promptText) {
      alert('请先填写【剧情设定→外观设定】（或旧的 description），AI 将根据外观设定生成头像。');
      return;
    }
    setGeneratingImage(true);
    setGeneratedCandidates([]);
    try {
      // Include gender and name in prompt context if available
      const promptContext = `${promptText} ${formData.gender ? `(${formData.gender})` : ''}`;
      const res = await generateAvatarImage(promptContext, { 
        count: 1,
        width: imageSize.width,
        height: imageSize.height,
        provider: imageProvider
      });
      
      if (res.data.urls && res.data.urls.length > 0) {
        setGeneratedCandidates(res.data.urls);
        // Auto-select the first one if no avatar exists
        if (!formData.avatarUrl) {
          setFormData(prev => ({ ...prev, avatarUrl: res.data.urls![0] }));
        }
      } else if (res.data.url) {
        // Fallback for single image
        setGeneratedCandidates([res.data.url]);
        if (!formData.avatarUrl) {
      setFormData(prev => ({ ...prev, avatarUrl: res.data.url }));
        }
      }
    } catch (err: any) {
      alert('生成失败: ' + (err?.response?.data?.message || '请检查后台配置'));
    } finally {
      setGeneratingImage(false);
    }
  };


  const [updateGlobalCore, setUpdateGlobalCore] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 防止重复提交
    if (submitting) {
      console.log('[EditAgent] Already submitting, ignoring duplicate click');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Prepare payload with potential global update flag
      // 确保数组字段存在，即使为空也要是数组
      // 将临时标签信息添加到 payload 中
      const videoMetaArray: Array<{ url: string; tags?: string[]; assetType?: string; emotionId?: string }> = [];
      pendingVideoMeta.forEach((meta, url) => {
        videoMetaArray.push({ url, ...meta });
      });
      
      const payload = {
        ...formData,
        updateGlobalCore,
        avatarUrls: formData.avatarUrls || [],
        coverVideoUrls: formData.coverVideoUrls || [],
        privatePhotoUrls: formData.privatePhotoUrls || [],
        // 新视频的预设标签（后端会在迁移时应用）
        pendingVideoMeta: videoMetaArray.length > 0 ? videoMetaArray : undefined,
      };
      
      console.log('[EditAgent] Submitting form:', { isEdit, id, payloadKeys: Object.keys(payload), pendingMeta: videoMetaArray.length });
      
      if (isEdit && id) {
        console.log('[EditAgent] Updating agent with ID:', id);
        await updateAgent(id, payload);
      } else {
        console.log('[EditAgent] Creating new agent');
        const response = await createAgent(payload);
        // 创建成功后，如果有临时标签，尝试迁移并应用标签
        if (videoMetaArray.length > 0 && response.data?._id) {
          console.log('[EditAgent] Created agent, applying pending video meta...');
          try {
            // 先迁移视频到 previewVideos
            await migratePreviewVideos(response.data._id);
            // 获取迁移后的视频列表
            const videosRes = await getPreviewVideos(response.data._id);
            const videos = videosRes.data?.videos || [];
            // 对每个有临时标签的视频，应用标签
            for (const meta of videoMetaArray) {
              const normalizedUrl = canonicalizeUrlKey(meta.url);
              const matchedVideo = videos.find((v: { url: string }) => canonicalizeUrlKey(v.url) === normalizedUrl);
              if (matchedVideo?.id) {
                const { updateVideoAssetType, updatePreviewVideo } = await import('../api');
                // 更新 assetType 和 emotionId
                if (meta.assetType) {
                  await updateVideoAssetType(response.data._id, matchedVideo.id, meta.assetType, meta.emotionId);
                }
                // 更新 tags
                if (meta.tags && meta.tags.length > 0) {
                  await updatePreviewVideo(response.data._id, matchedVideo.id, { tags: meta.tags });
                }
              }
            }
            console.log('[EditAgent] Applied pending video meta successfully');
          } catch (metaErr) {
            console.warn('[EditAgent] Failed to apply pending video meta:', metaErr);
            // 不阻止导航，只是标签没应用成功
          }
        }
      }
      navigate('/');
    } catch (err: any) {
      console.error('[EditAgent] Save failed:', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Save failed';
      alert(`保存失败: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyCoreTemplate = () => {
    if (recommendedCorePrompt) {
      setFormData(prev => ({ 
        ...prev, 
        corePrompt: recommendedCorePrompt,
        stage1Prompt: DEFAULT_STAGE_PROMPTS.stage1,
        stage2Prompt: DEFAULT_STAGE_PROMPTS.stage2,
        stage3Prompt: DEFAULT_STAGE_PROMPTS.stage3,
      }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white shadow rounded-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{isEdit ? 'Edit Agent' : 'Create Agent'}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'online' ? 'offline' : 'online' }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                formData.status === 'online' ? 'bg-green-500' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={formData.status === 'online'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.status === 'online' ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${formData.status === 'online' ? 'text-green-600' : 'text-gray-500'}`}>
              {formData.status === 'online' ? 'Online (上架)' : 'Offline (下架)'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Style (风格)</label>
            <select
              name="style"
              value={formData.style || 'realistic'}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              <option value="realistic">Realistic (真人风格)</option>
              <option value="anime">Anime (卡通风格)</option>
            </select>
          </div>

          <ModelSelect 
            value={formData.modelName} 
            onChange={(val) => setFormData(prev => ({ ...prev, modelName: val }))} 
          />

          <div>
            <label className="block text-sm font-medium text-gray-700">Temperature ({formData.temperature})</label>
            <input
              type="range"
              name="temperature"
              min="0"
              max="2"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">剧情设定（故事模式）</label>
            <div className="mt-2 grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">一句话标签（tagline）</label>
                  <input
                    type="text"
                    value={formData.storyConfig?.tagline || ''}
                    onChange={(e) => handleStoryConfigChange('tagline', e.target.value)}
                    placeholder="例如：禁忌继母 · 三天独处"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">故事简介（synopsis）</label>
                  <input
                    type="text"
                    value={formData.storyConfig?.synopsis || ''}
                    onChange={(e) => handleStoryConfigChange('synopsis', e.target.value)}
                    placeholder="1-2 句话描述剧情主线"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">开场白（opening）</label>
            <textarea
              rows={3}
                  value={formData.storyConfig?.opening || ''}
                  onChange={(e) => handleStoryConfigChange('opening', e.target.value)}
                  placeholder="故事第一段（用户进入剧情时看到的开场）"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">剧情背景（backstory）</label>
                <textarea
                  rows={4}
                  value={formData.storyConfig?.backstory || ''}
                  onChange={(e) => handleStoryConfigChange('backstory', e.target.value)}
                  placeholder="世界观/关系设定/关键禁忌点/冲突点/动机等（越清晰越好）"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">外观设定（appearance，用于生图/保角色）</label>
                  <textarea
                    rows={3}
                    value={formData.storyConfig?.appearance || ''}
                    onChange={(e) => handleStoryConfigChange('appearance', e.target.value)}
                    placeholder="例如：162cm，银白长发，九尾狐耳…（尽量结构化）"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">性格设定（personality）</label>
                  <textarea
                    rows={3}
                    value={formData.storyConfig?.personality || ''}
                    onChange={(e) => handleStoryConfigChange('personality', e.target.value)}
                    placeholder="例如：温柔但腹黑，喜欢诱导…（决定叙事口吻）"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">内容尺度（contentRating）</label>
                  <select
                    value={formData.storyConfig?.contentRating || 'moderate'}
                    onChange={(e) => handleStoryConfigChange('contentRating', e.target.value as any)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  >
                    <option value="mild">mild</option>
                    <option value="moderate">moderate</option>
                    <option value="explicit">explicit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">保角色强度（imagePromptStrength 0-1，可选）</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={typeof formData.storyConfig?.imagePromptStrength === 'number' ? formData.storyConfig?.imagePromptStrength : ''}
                    onChange={(e) => handleStoryConfigChange('imagePromptStrength', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    placeholder="留空走默认：realistic 0.18 / anime 0.22"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-600">
                说明：这部分会被故事模式直接使用；头像生成也会优先读取“外观设定”。
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Avatar Generation Settings</label>
            <div className="mt-1 flex items-start gap-4">
               <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Size Preset</label>
                  <select 
                    value={`${imageSize.width}x${imageSize.height}`}
                    onChange={(e) => {
                      const [w, h] = e.target.value.split('x').map(Number);
                      setImageSize({ width: w, height: h });
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  >
                    <option value="1440x3120">Default (1440 x 3120)</option>
                    <option value="1024x1024">Square (1024 x 1024)</option>
                    <option value="1024x1536">Portrait (1024 x 1536)</option>
                    <option value="1536x1024">Landscape (1536 x 1024)</option>
                  </select>
               </div>
               <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Provider</label>
                  <div className="flex gap-4 items-center h-[38px]">
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="radio" 
                        name="provider" 
                        value="fal"
                        checked={imageProvider === 'fal'}
                        onChange={() => setImageProvider('fal')}
                        className="form-radio text-indigo-600" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Fal.ai (Flux)</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer">
                      <input 
                        type="radio" 
                        name="provider" 
                        value="volcengine"
                        checked={imageProvider === 'volcengine'}
                        onChange={() => setImageProvider('volcengine')}
                        className="form-radio text-indigo-600" 
                      />
                      <span className="ml-2 text-sm text-gray-700">Volcengine</span>
                    </label>
                  </div>
               </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Avatars</label>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column: Public Avatar */}
              <div className="flex flex-col gap-4 border-r md:pr-8">
                  <h3 className="text-sm font-bold text-gray-900">Public Avatar (Normal)</h3>
                  <p className="text-xs text-gray-500">Used for initial interaction and public listing.</p>
                  
              <div className="flex items-start gap-4">
              {(formData.avatarUrls && formData.avatarUrls.length > 0) || formData.avatarUrl ? (
                  <div className="flex flex-col gap-2">
                    {/* 显示第一个作为主头像 */}
                    <div className="relative group cursor-zoom-in" onDoubleClick={() => setPreviewImage(normalizeImageUrl(formData.avatarUrl || formData.avatarUrls?.[0] || ''))}>
                            <img 
                                src={normalizeImageUrl(formData.avatarUrl || formData.avatarUrls?.[0] || '')} 
                              alt="Public Avatar" 
                              className="h-48 w-48 rounded-lg object-cover object-[50%_20%] border-2 border-indigo-500" 
                              onError={(e) => { 
                                  console.error('[EditAgent] Failed to load avatar image:', formData.avatarUrl || formData.avatarUrls?.[0]);
                                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/192'; 
                              }}
                              onLoad={() => {
                                  console.log('[EditAgent] Avatar image loaded successfully:', normalizeImageUrl(formData.avatarUrl || formData.avatarUrls?.[0] || ''));
                              }}
                            />
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs text-center py-1">主头像</div>
                    </div>
                    {/* 显示所有头像的缩略图 */}
                    {(formData.avatarUrls && formData.avatarUrls.length > 1) && (
                      <div className="flex flex-wrap gap-2">
                        {formData.avatarUrls.map((url, idx) => (
                          <div key={idx} className="relative group">
                            <img 
                              src={normalizeImageUrl(url)} 
                              alt={`Avatar ${idx + 1}`}
                              className="h-16 w-16 rounded-md object-cover border-2 border-gray-300 cursor-pointer hover:border-indigo-500"
                              onClick={() => setFormData(prev => ({ ...prev, avatarUrl: url }))}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({
                                  ...prev,
                                  avatarUrls: prev.avatarUrls?.filter((_, i) => i !== idx) || [],
                                  avatarUrl: idx === 0 && prev.avatarUrls?.[1] ? prev.avatarUrls[1] : prev.avatarUrl,
                                }));
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                              title="删除"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
              ) : (
                        <div className="h-48 w-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                    <span>No Avatar</span>
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGenerateAvatar}
                  disabled={generatingImage}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-60 text-sm font-medium flex items-center gap-2"
                >
                        {generatingImage ? 'Generating...' : 'Generate Public'}
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={uploading}
                  />
                  <button type="button" className="text-sm text-gray-600 hover:text-gray-900 underline">
                            {uploading ? '上传中...' : '上传图片（可多选）'}
                        </button>
                        </div>

                        {/* Video Upload & Extract */}
                        <div className="relative">
                            <input
                                type="file"
                                accept="video/*"
                                multiple
                                onChange={handleVideoUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                disabled={uploading}
                            />
                            <button type="button" className="text-sm text-blue-600 hover:text-blue-900 underline">
                                {uploading ? '上传中...' : '上传视频（可多选）'}
                  </button>
                </div>
                {/* 显示所有视频 */}
                {(formData.coverVideoUrls && formData.coverVideoUrls.length > 0) && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700 mb-2">已上传视频 ({formData.coverVideoUrls.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.coverVideoUrls.map((url, idx) => (
                        <div key={idx} className="relative group">
                          <video 
                            src={url}
                            className="h-16 w-16 rounded-md object-cover border-2 border-gray-300"
                            muted
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                coverVideoUrls: prev.coverVideoUrls?.filter((_, i) => i !== idx) || [],
                                coverVideoUrl: idx === 0 && prev.coverVideoUrls?.[1] ? prev.coverVideoUrls[1] : prev.coverVideoUrl,
                              }));
                            }}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                            title="删除"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              </div>

                  {/* Generated Candidates for Public Avatar */}
              {generatedCandidates.length > 0 && (
                <div className="mt-2">
                        <p className="text-xs font-medium text-gray-700 mb-2">Candidates:</p>
                        <div className="grid grid-cols-3 gap-2">
                    {generatedCandidates.map((url, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          avatarUrl: url,
                          avatarUrls: prev.avatarUrls?.includes(url) ? prev.avatarUrls : [...(prev.avatarUrls || []), url],
                        }))}
                                className={`cursor-pointer relative rounded-md overflow-hidden border-2 transition-all ${formData.avatarUrl === url ? 'border-indigo-600' : 'border-transparent hover:border-gray-300'}`}
                      >
                                <img 
                                  src={normalizeImageUrl(url)} 
                                  alt={`Option ${idx + 1}`} 
                                  className="w-full h-20 object-cover object-[50%_20%]" 
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80'; }}
                                />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </div>

              {/* Right Column: 主播相册 (可拖动排序) */}
              <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-gray-900">主播相册</h3>
                  <p className="text-xs text-gray-500">图片和视频需分别上传，拖动可调整顺序</p>

                  {/* IDLE 视频上传（LiveSkin 核心） */}
                  {isEdit && id && (
                    <div className="rounded-lg border-2 border-green-300 bg-green-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-green-900 flex items-center gap-2">
                            🎬 IDLE 待机视频
                            {idleVideoStatus?.hasLoopSafe && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500 text-white">已就绪</span>
                            )}
                          </div>
                          <div className="text-xs text-green-800 mt-1">
                            上传手动剪辑好的可循环视频（3-5s，首尾帧一致），客户端将直接 loop 播放
                          </div>
                          {idleVideoStatus?.idleVideo && (
                            <div className="text-xs text-green-700 mt-1">
                              ✅ 已上传 IDLE 视频
                            </div>
                          )}
                          {idleVideoError && (
                            <div className="text-xs text-red-600 mt-1">{idleVideoError}</div>
                          )}
                          {idleVideoUploading && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-green-700 mb-1">
                                <span>上传进度</span>
                                <span>{idleVideoUploadProgress}%</span>
                              </div>
                              <div className="w-full bg-green-200 rounded-full h-1.5">
                                <div 
                                  className="bg-green-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${idleVideoUploadProgress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {idleVideoStatus?.idleVideo && (
                            <IdleVideoPreview 
                              url={idleVideoStatus.idleVideo.loopSafeUrl || idleVideoStatus.idleVideo.url}
                            />
                          )}
                          <label className={`relative cursor-pointer px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            idleVideoUploading
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}>
                            <input
                              type="file"
                              accept="video/*"
                              onChange={handleIdleVideoUpload}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              disabled={idleVideoUploading}
                            />
                            {idleVideoUploading ? `上传中 ${idleVideoUploadProgress}%` : (idleVideoStatus?.hasLoopSafe ? '重新上传' : '上传 IDLE 视频')}
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LiveSkin 标签（视频动作库） */}
                  {isEdit && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-indigo-900">LiveSkin 标签（iOS 状态机选片）</div>
                          <div className="text-xs text-indigo-800">
                            在下方视频卡片里直接点标签即可保存。若提示 legacy，请先迁移再标注。
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={loadPreviewVideos}
                            className="text-xs px-3 py-1 rounded bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                            disabled={previewVideosLoading}
                          >
                            {previewVideosLoading ? '刷新中…' : '刷新'}
                          </button>
                          {hasLegacyPreviewVideos && (
                            <button
                              type="button"
                              onClick={handleMigratePreviewVideos}
                              className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                              disabled={previewVideosMigrating}
                              title="把旧 coverVideoUrls 迁移为 previewVideos（才能保存 tags）"
                            >
                              {previewVideosMigrating ? '迁移中…' : '迁移到 previewVideos'}
                            </button>
                          )}
                        </div>
                      </div>
                      {previewVideosError ? <div className="mt-2 text-xs text-red-700">{previewVideosError}</div> : null}
                      <div className="mt-2 text-xs text-indigo-900">
                        当前预览视频：{previewVideos.length} 个{hasLegacyPreviewVideos ? '（含 legacy）' : ''}
                      </div>
                    </div>
                  )}

                  {/* 统计信息 */}
                  <div className="flex gap-4 text-xs text-gray-600 mb-2">
                    <span>图片: {formData.avatarUrls?.length || 0} 张</span>
                    <span>视频: {formData.coverVideoUrls?.length || 0} 个</span>
                    <span>私有图片: {formData.privatePhotoUrls?.length || 0} 张</span>
                  </div>

                  {/* 可拖动排序的媒体列表 */}
                  <DraggableMediaList
                    imageUrls={formData.avatarUrls || []}
                    videoUrls={formData.coverVideoUrls || []}
                    onReorder={(newImageUrls, newVideoUrls) => {
                      setFormData(prev => ({
                        ...prev,
                        avatarUrls: newImageUrls,
                        coverVideoUrls: newVideoUrls,
                        avatarUrl: newImageUrls[0] || prev.avatarUrl,
                        coverVideoUrl: newVideoUrls[0] || prev.coverVideoUrl,
                      }));
                    }}
                    onDelete={(index) => {
                      setFormData(prev => ({
                        ...prev,
                        avatarUrls: prev.avatarUrls?.filter((_, i) => i !== index) || [],
                        coverVideoUrls: prev.coverVideoUrls?.filter((_, i) => i !== index) || [],
                        avatarUrl: index === 0 && prev.avatarUrls?.[1] ? prev.avatarUrls[1] : prev.avatarUrl,
                        coverVideoUrl: index === 0 && prev.coverVideoUrls?.[1] ? prev.coverVideoUrls[1] : prev.coverVideoUrl,
                      }));
                    }}
                    onPreview={setPreviewImage}
                    // LiveSkin tagging: 编辑模式用服务器保存，创建模式用临时本地状态
                    {...(isEdit && id
                      ? {
                          getVideoMeta,
                          onSetVideoTags: handleSetVideoTags,
                          onSetAssetType: handleSetAssetType,
                          tagQuickOptions,
                        }
                      : {
                          // 创建模式：使用临时本地标签
                          onSetLocalMeta: handleSetLocalMeta,
                          getVideoMeta: (videoUrl: string) => {
                            const key = canonicalizeUrlKey(videoUrl);
                            const meta = pendingVideoMeta.get(key);
                            if (!meta) return null;
                            return { 
                              id: '', 
                              tags: meta.tags,
                              assetType: meta.assetType as 'idle' | 'reaction' | 'transition' | 'speak' | undefined,
                              emotionId: meta.emotionId,
                            };
                          },
                        })}
                  />

                  {/* 私有图片单独显示 */}
                  {formData.privatePhotoUrls && formData.privatePhotoUrls.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">私有图片</h4>
                      <div className="grid grid-cols-4 gap-2">
                        {formData.privatePhotoUrls.map((url, idx) => (
                          <div key={`private-${idx}`} className="relative group">
                            <img 
                              src={normalizeImageUrl(url)} 
                              alt={`私有图片 ${idx + 1}`}
                              className="w-full h-16 rounded-md object-cover border-2 border-pink-300 cursor-pointer hover:border-pink-500"
                              onClick={() => setPreviewImage(normalizeImageUrl(url))}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormData(prev => ({
                                  ...prev,
                                  privatePhotoUrls: prev.privatePhotoUrls?.filter((_, i) => i !== idx) || [],
                                }));
                              }}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="删除"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button 
              className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700"
              onClick={() => setPreviewImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voice ID (Fish Audio Reference ID)</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="voiceId"
                value={formData.voiceId || ''}
                onChange={handleChange}
                placeholder="输入或选择语音 ID..."
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              />
              <button
                type="button"
                onClick={() => setIsVoiceDialogOpen(true)}
                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 hover:bg-indigo-100 text-sm font-medium flex items-center gap-2 whitespace-nowrap"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                选择模板
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">支持手动输入 ID，或点击右侧按钮从收藏库中选择。</p>
          </div>

          <VoiceSelectionDialog
            isOpen={isVoiceDialogOpen}
            onClose={() => setIsVoiceDialogOpen(false)}
            onSelect={(voiceId) => setFormData(prev => ({ ...prev, voiceId }))}
            selectedVoiceId={formData.voiceId}
          />

          {/* Core Prompt - 极简版 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">核心人设 (Core Prompt)</label>
            <textarea
              name="corePrompt"
              rows={10}
              value={formData.corePrompt || ''}
              onChange={handleChange}
              placeholder="角色的核心人设和行为规则..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
            <p className="text-xs text-gray-500 mt-1">定义角色的性格、说话风格和行为规则</p>
          </div>

          {/* 暂时隐藏：AI UGC 相册 / 私房照管理（当前用不上） */}

          {/* 说明：systemPrompt 仍保留在数据结构中（用于聊天模式），但编辑入口收敛到“剧情设定”以减少困惑 */}

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-white text-gray-700 px-4 py-2 rounded-md border hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditAgent;
