import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { normalizeImageUrl } from '../utils/imageUrl';

interface MediaPair {
  id: string;
  imageUrl: string;
  videoUrl: string;
}

interface SortableMediaItemProps {
  pair: MediaPair;
  index: number;
  onDelete: (index: number) => void;
  onPreview: (url: string) => void;
}

const SortableMediaItem: React.FC<SortableMediaItemProps> = ({ pair, index, onDelete, onPreview }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pair.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col gap-2 p-2 rounded-lg border-2 ${
        isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
      } cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      {/* 序号标签 */}
      <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
        {index + 1}
      </div>

      {/* 删除按钮 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(index);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 z-10"
        title="删除"
      >
        ×
      </button>

      {/* 图片预览 */}
      <div className="relative group">
        <img
          src={normalizeImageUrl(pair.imageUrl)}
          alt={`图片 ${index + 1}`}
          className="w-20 h-20 rounded-md object-cover border border-gray-300"
          onClick={(e) => {
            e.stopPropagation();
            onPreview(normalizeImageUrl(pair.imageUrl));
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80?text=No+Image';
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs text-center py-0.5 rounded-b-md">
          图片
        </div>
      </div>

      {/* 视频预览 */}
      <div className="relative group">
        <video
          src={pair.videoUrl}
          className="w-20 h-20 rounded-md object-cover border border-blue-300"
          muted
          onMouseEnter={(e) => e.currentTarget.play()}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-blue-600 bg-opacity-75 text-white text-xs text-center py-0.5 rounded-b-md">
          视频
        </div>
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 需要移动 5px 才开始拖动，避免点击误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 创建配对数据（图片和视频一一对应）
  const pairs: MediaPair[] = [];
  const maxLength = Math.max(imageUrls.length, videoUrls.length);
  
  for (let i = 0; i < maxLength; i++) {
    pairs.push({
      id: `pair-${i}`,
      imageUrl: imageUrls[i] || '',
      videoUrl: videoUrls[i] || '',
    });
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pairs.findIndex((p) => p.id === active.id);
      const newIndex = pairs.findIndex((p) => p.id === over.id);

      const newPairs = arrayMove(pairs, oldIndex, newIndex);
      
      // 提取重排后的 URL 数组
      const newImageUrls = newPairs.map((p) => p.imageUrl).filter(Boolean);
      const newVideoUrls = newPairs.map((p) => p.videoUrl).filter(Boolean);

      onReorder(newImageUrls, newVideoUrls);
    }
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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
        <span>拖动排序（视频和首帧图自动同步）</span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pairs.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[150px]">
            {pairs.map((pair, index) => (
              <SortableMediaItem
                key={pair.id}
                pair={pair}
                index={index}
                onDelete={onDelete}
                onPreview={onPreview}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="text-xs text-gray-500">
        💡 提示：拖动任意一对（图片+视频）即可调整顺序，两者会保持绑定关系
      </p>
    </div>
  );
};

export default DraggableMediaList;

