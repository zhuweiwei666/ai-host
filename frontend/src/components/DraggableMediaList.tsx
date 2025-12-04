import React from 'react';
import { normalizeImageUrl } from '../utils/imageUrl';

interface MediaPair {
  imageUrl: string;
  videoUrl: string;
}

interface MediaItemProps {
  pair: MediaPair;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onPreview: (url: string) => void;
}

const MediaItem: React.FC<MediaItemProps> = ({ 
  pair, 
  index, 
  total, 
  onMoveUp, 
  onMoveDown, 
  onDelete, 
  onPreview 
}) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;

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
}

const DraggableMediaList: React.FC<DraggableMediaListProps> = ({
  imageUrls,
  videoUrls,
  onReorder,
  onDelete,
  onPreview,
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
