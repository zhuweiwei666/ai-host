import React from 'react';
import { normalizeImageUrl } from '../utils/imageUrl';

interface MediaPair {
  imageUrl: string;
  videoUrl: string;
}

type VideoMeta = { 
  id?: string; 
  tags?: string[]; 
  assetType?: 'idle' | 'reaction' | 'transition' | 'speak';
  emotionId?: string;
} | null | undefined;

// ========== FSM 资产类型 ==========
const ASSET_TYPES: { id: string; label: string; color: string }[] = [
  { id: 'idle', label: 'IDLE 待机', color: 'blue' },
  { id: 'reaction', label: 'REACTION 反应', color: 'green' },
  { id: 'transition', label: 'TRANSITION 过渡', color: 'yellow' },
  { id: 'speak', label: 'SPEAK 说话', color: 'purple' },
];

// 20个情绪标签 - 中文映射
const TAG_LABELS: Record<string, string> = {
  // 基础状态 (4)
  idle: '待机',
  loopable: '循环',
  talk: '说话',
  listen: '倾听',
  // 正向情绪 (6)
  happy: '开心',
  excited: '兴奋',
  flirty: '撩人',
  shy: '害羞',
  love: '心动',
  proud: '得意',
  // 负向/中性情绪 (6)
  sad: '难过',
  angry: '生气',
  surprised: '惊讶',
  scared: '害怕',
  confused: '困惑',
  bored: '无聊',
  // 镜头/构图 (4)
  closeup: '特写',
  halfbody: '半身',
  fullbody: '全身',
  source: '原始',
};

// 情绪标签（用于 reaction 类型）
const EMOTION_TAGS = ['happy', 'excited', 'flirty', 'shy', 'love', 'proud', 'sad', 'angry', 'surprised', 'scared', 'confused', 'bored'];

// 标签分类
const TAG_CATEGORIES: { name: string; color: string; tags: string[] }[] = [
  { name: '状态', color: 'blue', tags: ['idle', 'loopable', 'talk', 'listen'] },
  { name: '正向', color: 'green', tags: ['happy', 'excited', 'flirty', 'shy', 'love', 'proud'] },
  { name: '其他', color: 'orange', tags: ['sad', 'angry', 'surprised', 'scared', 'confused', 'bored'] },
  { name: '镜头', color: 'purple', tags: ['closeup', 'halfbody', 'fullbody', 'source'] },
];

interface MediaItemProps {
  pair: MediaPair;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onPreview: (url: string) => void;
  getVideoMeta?: (videoUrl: string) => VideoMeta;
  onSetVideoTags?: (videoId: string, tags: string[]) => Promise<void> | void;
  onSetAssetType?: (videoId: string, assetType: string, emotionId?: string) => Promise<void> | void;
  tagQuickOptions?: string[];
}

const MediaItem: React.FC<MediaItemProps> = ({ 
  pair, 
  index, 
  total, 
  onMoveUp, 
  onMoveDown, 
  onDelete, 
  onPreview,
  getVideoMeta,
  onSetVideoTags,
  onSetAssetType,
}) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const taggingEnabled = !!(getVideoMeta && onSetVideoTags);
  const meta = pair.videoUrl && getVideoMeta ? getVideoMeta(pair.videoUrl) : null;
  const videoId = meta?.id;
  const [tagDraft, setTagDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>(Array.isArray(meta?.tags) ? meta!.tags! : []);
  const [assetType, setAssetType] = React.useState<string>(meta?.assetType || 'idle');
  const [emotionId, setEmotionId] = React.useState<string>(meta?.emotionId || '');

  React.useEffect(() => {
    setTags(Array.isArray(meta?.tags) ? meta!.tags! : []);
    setAssetType(meta?.assetType || 'idle');
    setEmotionId(meta?.emotionId || '');
  }, [meta?.tags?.join(','), meta?.assetType, meta?.emotionId]);

  // 更新资产类型
  const handleAssetTypeChange = async (newType: string) => {
    if (!videoId || !onSetAssetType) return;
    const prevType = assetType;
    const prevEmotion = emotionId;
    setAssetType(newType);
    // 如果切换到非 reaction 类型，清空 emotionId
    if (newType !== 'reaction') {
      setEmotionId('');
    }
    try {
      setSaving(true);
      await onSetAssetType(videoId, newType, newType === 'reaction' ? emotionId : undefined);
    } catch (e) {
      console.error('[DraggableMediaList] Failed to save assetType:', e);
      setAssetType(prevType);
      setEmotionId(prevEmotion);
    } finally {
      setSaving(false);
    }
  };

  // 更新情绪 ID
  const handleEmotionChange = async (newEmotion: string) => {
    if (!videoId || !onSetAssetType || assetType !== 'reaction') return;
    const prevEmotion = emotionId;
    setEmotionId(newEmotion);
    try {
      setSaving(true);
      await onSetAssetType(videoId, assetType, newEmotion);
    } catch (e) {
      console.error('[DraggableMediaList] Failed to save emotionId:', e);
      setEmotionId(prevEmotion);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = async (t: string) => {
    if (!videoId || !onSetVideoTags) return;
    const prev = tags;
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setTags(next);
    try {
      setSaving(true);
      await onSetVideoTags(videoId, next);
    } catch (e) {
      console.error('[DraggableMediaList] Failed to save tags:', e);
      setTags(prev);
      alert('保存标签失败，请确认已保存 Agent 并稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const addTag = async () => {
    if (!videoId || !onSetVideoTags) return;
    const t = tagDraft.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagDraft('');
      return;
    }
    const prev = tags;
    const next = [...tags, t];
    setTags(next);
    setTagDraft('');
    try {
      setSaving(true);
      await onSetVideoTags(videoId, next);
    } catch (e) {
      console.error('[DraggableMediaList] Failed to add tag:', e);
      setTags(prev);
      alert('保存标签失败，请确认已保存 Agent 并稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  // 获取标签按钮样式
  const getTagStyle = (_t: string, isSelected: boolean, catColor: string) => {
    const colorMap: Record<string, { selected: string; normal: string }> = {
      blue: {
        selected: 'bg-blue-500 text-white border-blue-500',
        normal: 'bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400 hover:bg-blue-100',
      },
      green: {
        selected: 'bg-green-500 text-white border-green-500',
        normal: 'bg-green-50 text-green-700 border-green-200 hover:border-green-400 hover:bg-green-100',
      },
      orange: {
        selected: 'bg-orange-500 text-white border-orange-500',
        normal: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400 hover:bg-orange-100',
      },
      yellow: {
        selected: 'bg-yellow-500 text-white border-yellow-500',
        normal: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-100',
      },
      purple: {
        selected: 'bg-purple-500 text-white border-purple-500',
        normal: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-400 hover:bg-purple-100',
      },
    };
    return colorMap[catColor]?.[isSelected ? 'selected' : 'normal'] || '';
  };

  return (
    <div className="relative flex gap-3 p-3 rounded-lg border-2 border-gray-200 bg-white min-w-[320px]">
      {/* 序号标签 */}
      <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
        {index + 1}
      </div>

      {/* 删除按钮 */}
      <button
        type="button"
        onClick={onDelete}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
        title="删除"
      >
        ×
      </button>

      {/* 左侧：媒体预览 */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {/* 图片预览 */}
        <div className="relative">
          <img
            src={normalizeImageUrl(pair.imageUrl)}
            alt={`图片 ${index + 1}`}
            className="w-16 h-16 rounded-md object-cover border border-gray-300 cursor-pointer hover:opacity-80"
            onClick={() => onPreview(normalizeImageUrl(pair.imageUrl))}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64?text=No';
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[9px] text-center py-0.5 rounded-b-md">
            图片
          </div>
        </div>

        {/* 视频预览 */}
        <div className="relative">
          <video
            src={normalizeImageUrl(pair.videoUrl, '')}
            className="w-16 h-16 rounded-md object-cover border border-blue-300"
            muted
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => {
              e.currentTarget.pause();
              e.currentTarget.currentTime = 0;
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-blue-600 bg-opacity-75 text-white text-[9px] text-center py-0.5 rounded-b-md">
            视频
          </div>
        </div>

        {/* 上下移动按钮 */}
        <div className="flex justify-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className={`w-7 h-5 flex items-center justify-center rounded text-[10px] font-bold transition-colors ${
              isFirst 
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                : 'bg-gray-200 text-gray-700 hover:bg-indigo-500 hover:text-white'
            }`}
            title="上移"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className={`w-7 h-5 flex items-center justify-center rounded text-[10px] font-bold transition-colors ${
              isLast 
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                : 'bg-gray-200 text-gray-700 hover:bg-indigo-500 hover:text-white'
            }`}
            title="下移"
          >
            ↓
          </button>
        </div>
      </div>

      {/* 右侧：标签区域 */}

      {/* 视频标签（LiveSkin FSM）*/}
      {pair.videoUrl && taggingEnabled ? (
        <div className="w-52 min-w-[13rem]">
          {videoId ? (
            <div className="space-y-2">
              {/* FSM 资产类型选择器 */}
              {onSetAssetType && (
                <div className="pb-1.5 border-b border-gray-200">
                  <div className="text-[10px] text-gray-500 mb-1 font-medium">FSM 类型:</div>
                  <div className="flex flex-wrap gap-1">
                    {ASSET_TYPES.map((at) => {
                      const isSelected = assetType === at.id;
                      const style = getTagStyle('', isSelected, at.color);
                      return (
                        <button
                          key={at.id}
                          type="button"
                          onClick={() => handleAssetTypeChange(at.id)}
                          className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${style}`}
                          title={at.label}
                        >
                          {at.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                  {/* 情绪选择（仅 reaction 类型显示） */}
                  {assetType === 'reaction' && (
                    <div className="mt-1.5">
                      <div className="text-[9px] text-gray-500 mb-0.5">情绪:</div>
                      <div className="flex flex-wrap gap-0.5">
                        {EMOTION_TAGS.map((em) => {
                          const isSelected = emotionId === em;
                          return (
                            <button
                              key={em}
                              type="button"
                              onClick={() => handleEmotionChange(em)}
                              className={`px-1 py-0.5 rounded text-[9px] border transition-all ${
                                isSelected 
                                  ? 'bg-green-500 text-white border-green-500' 
                                  : 'bg-green-50 text-green-700 border-green-200 hover:border-green-400'
                              }`}
                              title={TAG_LABELS[em]}
                            >
                              {TAG_LABELS[em]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 已选标签展示 */}
              {tags.length > 0 && (
                <div className="pb-1.5 border-b border-gray-200">
                  <div className="text-[10px] text-gray-500 mb-1">已选 ({tags.length}):</div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] text-indigo-700 font-medium">
                        {TAG_LABELS[t] || t}
                        <button 
                          type="button" 
                          className="text-indigo-400 hover:text-red-600 ml-0.5" 
                          onClick={() => toggleTag(t)} 
                          title="移除"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 分类标签选择 - 20个情绪标签 */}
              <div className="space-y-1.5">
                {TAG_CATEGORIES.map((cat) => (
                  <div key={cat.name}>
                    <div className="text-[9px] text-gray-500 mb-0.5 font-medium">{cat.name}:</div>
                    <div className="flex flex-wrap gap-0.5">
                      {cat.tags.map((t) => {
                        const isSelected = tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTag(t)}
                            className={`px-1.5 py-0.5 rounded text-[10px] border transition-all ${getTagStyle(t, isSelected, cat.color)}`}
                            title={`${TAG_LABELS[t]} (${t})`}
                          >
                            {TAG_LABELS[t]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* 自定义标签输入 */}
              <div className="flex items-center gap-1 pt-1.5 border-t border-gray-200">
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="自定义标签..."
                  className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-300 rounded focus:border-indigo-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-2 py-0.5 text-[10px] rounded bg-gray-200 hover:bg-indigo-500 hover:text-white transition-colors"
                  disabled={saving}
                  title="添加自定义标签"
                >
                  +
                </button>
                {saving && <span className="text-[10px] text-indigo-500">保存中…</span>}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
              ⚠️ 未入库：请先 Save 保存后点"刷新"
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

interface DraggableMediaListProps {
  imageUrls: string[];
  videoUrls: string[];
  onReorder: (newImageUrls: string[], newVideoUrls: string[]) => void;
  onDelete: (index: number) => void;
  onPreview: (url: string) => void;
  getVideoMeta?: (videoUrl: string) => VideoMeta;
  onSetVideoTags?: (videoId: string, tags: string[]) => Promise<void> | void;
  onSetAssetType?: (videoId: string, assetType: string, emotionId?: string) => Promise<void> | void;
  tagQuickOptions?: string[];
}

const DraggableMediaList: React.FC<DraggableMediaListProps> = ({
  imageUrls,
  videoUrls,
  onReorder,
  onDelete,
  onPreview,
  getVideoMeta,
  onSetVideoTags,
  onSetAssetType,
  tagQuickOptions,
}) => {
  // 创建配对数据（图片和视频一一对应）
  const pairs: MediaPair[] = [];
  const maxLength = Math.max(imageUrls.length, videoUrls.length);
  
  for (let i = 0; i < maxLength; i++) {
    pairs.push({
      imageUrl: imageUrls[i] || '',
      videoUrl: videoUrls[i] || '',
    });
  }

  const handleSwap = (indexA: number, indexB: number) => {
    if (indexB < 0 || indexB >= pairs.length) return;

    const newImageUrls = [...imageUrls];
    const newVideoUrls = [...videoUrls];

    // 交换图片
    if (newImageUrls[indexA] !== undefined && newImageUrls[indexB] !== undefined) {
      [newImageUrls[indexA], newImageUrls[indexB]] = [newImageUrls[indexB], newImageUrls[indexA]];
    }

    // 交换视频
    if (newVideoUrls[indexA] !== undefined && newVideoUrls[indexB] !== undefined) {
      [newVideoUrls[indexA], newVideoUrls[indexB]] = [newVideoUrls[indexB], newVideoUrls[indexA]];
    }

    onReorder(newImageUrls, newVideoUrls);
  };

  if (pairs.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 border border-dashed border-gray-300 rounded-lg">
        暂无媒体文件，请上传视频
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>点击 ↑↓ 按钮调整顺序（视频和首帧图自动同步）</span>
      </div>

      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[150px]">
        {pairs.map((pair, index) => (
          <MediaItem
            key={index}
            pair={pair}
            index={index}
            total={pairs.length}
            onMoveUp={() => handleSwap(index, index - 1)}
            onMoveDown={() => handleSwap(index, index + 1)}
            onDelete={() => onDelete(index)}
            onPreview={onPreview}
            getVideoMeta={getVideoMeta}
            onSetVideoTags={onSetVideoTags}
            onSetAssetType={onSetAssetType}
            tagQuickOptions={tagQuickOptions}
          />
        ))}
      </div>

      <p className="text-xs text-gray-500">
        💡 提示：点击 ↑ 上移，点击 ↓ 下移，图片和视频会一起移动 | 标签支持多选，点击即保存
      </p>
    </div>
  );
};

export default DraggableMediaList;
