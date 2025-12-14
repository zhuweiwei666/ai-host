import React from 'react';
import { normalizeImageUrl } from '../utils/imageUrl';

interface MediaPair {
  imageUrl: string;
  videoUrl: string;
}

type VideoMeta = { id?: string; tags?: string[] } | null | undefined;

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
  tagQuickOptions = [],
}) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const meta = pair.videoUrl && getVideoMeta ? getVideoMeta(pair.videoUrl) : null;
  const videoId = meta?.id;
  const [tagDraft, setTagDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>(Array.isArray(meta?.tags) ? meta!.tags! : []);

  React.useEffect(() => {
    setTags(Array.isArray(meta?.tags) ? meta!.tags! : []);
  }, [meta?.tags?.join(',')]);

  const toggleTag = async (t: string) => {
    if (!videoId || !onSetVideoTags) return;
    const next = tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t];
    setTags(next);
    try {
      setSaving(true);
      await onSetVideoTags(videoId, next);
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
    const next = [...tags, t];
    setTags(next);
    setTagDraft('');
    try {
      setSaving(true);
      await onSetVideoTags(videoId, next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-2 p-2 rounded-lg border-2 border-gray-200 bg-white">
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

      {/* 图片预览 */}
      <div className="relative">
        <img
          src={normalizeImageUrl(pair.imageUrl)}
          alt={`图片 ${index + 1}`}
          className="w-20 h-20 rounded-md object-cover border border-gray-300 cursor-pointer hover:opacity-80"
          onClick={() => onPreview(normalizeImageUrl(pair.imageUrl))}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=No+Image';
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs text-center py-0.5 rounded-b-md">
          图片
        </div>
      </div>

      {/* 视频预览 */}
      <div className="relative">
        <video
          src={pair.videoUrl}
          className="w-20 h-20 rounded-md object-cover border border-blue-300"
          muted
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-blue-600 bg-opacity-75 text-white text-xs text-center py-0.5 rounded-b-md">
          视频
        </div>
      </div>

      {/* 视频标签（LiveSkin） */}
      {pair.videoUrl ? (
        <div className="w-20">
          {videoId ? (
            <div className="space-y-1">
              <div className="flex flex-wrap gap-1">
                {tagQuickOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleTag(t)}
                    className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                      tags.includes(t)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                    }`}
                    title="点击切换标签"
                  >
                    {t.replace('react_', 'r_')}
                  </button>
                ))}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-700">
                      {t}
                      {onSetVideoTags ? (
                        <button type="button" className="text-gray-500 hover:text-red-600" onClick={() => toggleTag(t)} title="移除">
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}

              {onSetVideoTags ? (
                <div className="flex items-center gap-1">
                  <input
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="tag"
                    className="w-12 px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-gray-200 hover:bg-gray-300"
                    disabled={saving}
                    title="添加"
                  >
                    +
                  </button>
                  {saving ? <span className="text-[10px] text-gray-400">…</span> : null}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1">
              需迁移后打标签
            </div>
          )}
        </div>
      ) : null}

      {/* 上下移动按钮 */}
      <div className="flex justify-center gap-1 mt-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={`w-8 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors ${
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
          className={`w-8 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors ${
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
            tagQuickOptions={tagQuickOptions}
          />
        ))}
      </div>

      <p className="text-xs text-gray-500">
        💡 提示：点击 ↑ 上移，点击 ↓ 下移，图片和视频会一起移动
      </p>
    </div>
  );
};

export default DraggableMediaList;
