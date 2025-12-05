import React, { useState, useEffect, useCallback } from 'react';
import {
  UgcImage,
  UgcImageStats,
  getUgcImages,
  getUgcImageStats,
  addUgcImage,
  deleteUgcImage,
  toggleUgcImageActive,
  batchDeleteUgcImages,
  uploadImage,
} from '../api';
import { normalizeImageUrl } from '../utils/imageUrl';

interface UgcImageGalleryProps {
  agentId: string;
}

const UgcImageGallery: React.FC<UgcImageGalleryProps> = ({ agentId }) => {
  const [images, setImages] = useState<UgcImage[]>([]);
  const [stats, setStats] = useState<UgcImageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sfw' | 'nsfw'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageIsNsfw, setNewImageIsNsfw] = useState(false);

  // 加载数据
  const loadData = useCallback(async () => {
    if (!agentId) return;
    
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filter === 'sfw') params.isNsfw = false;
      if (filter === 'nsfw') params.isNsfw = true;
      if (activeFilter === 'active') params.isActive = true;
      if (activeFilter === 'inactive') params.isActive = false;

      const [imagesRes, statsRes] = await Promise.all([
        getUgcImages(agentId, params),
        getUgcImageStats(agentId),
      ]);

      const imagesData = (imagesRes.data as any)?.data || imagesRes.data;
      const statsData = (statsRes.data as any)?.data || statsRes.data;

      setImages(imagesData.images || []);
      setTotalPages(imagesData.pagination?.totalPages || 1);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load UGC images:', err);
    } finally {
      setLoading(false);
    }
  }, [agentId, filter, activeFilter, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 上传图片
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isNsfw: boolean) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          // 先上传图片到 OSS
          const uploadRes = await uploadImage(file);
          const imageUrl = uploadRes.url;

          // 然后添加到 UGC 相册
          await addUgcImage(agentId, { imageUrl, isNsfw });
          successCount++;
        } catch (err) {
          console.error('Failed to upload image:', err);
          failCount++;
        }
      }

      if (successCount > 0) {
        loadData();
      }
      
      if (failCount > 0) {
        alert(`上传完成：${successCount} 成功，${failCount} 失败`);
      }
    } finally {
      setUploading(false);
      e.target.value = ''; // 清空 input
    }
  };

  // 添加 URL 图片
  const handleAddUrl = async () => {
    if (!newImageUrl.trim()) {
      alert('请输入图片 URL');
      return;
    }

    try {
      await addUgcImage(agentId, { imageUrl: newImageUrl.trim(), isNsfw: newImageIsNsfw });
      setNewImageUrl('');
      setNewImageIsNsfw(false);
      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to add image:', err);
      alert('添加失败');
    }
  };

  // 删除单张图片
  const handleDelete = async (imageId: string) => {
    if (!confirm('确定删除这张图片？')) return;

    try {
      await deleteUgcImage(agentId, imageId);
      loadData();
    } catch (err) {
      console.error('Failed to delete image:', err);
      alert('删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 张图片？`)) return;

    try {
      await batchDeleteUgcImages(agentId, Array.from(selectedIds));
      setSelectedIds(new Set());
      loadData();
    } catch (err) {
      console.error('Failed to batch delete:', err);
      alert('批量删除失败');
    }
  };

  // 切换启用/禁用
  const handleToggleActive = async (image: UgcImage) => {
    try {
      await toggleUgcImageActive(agentId, image._id, !image.isActive);
      loadData();
    } catch (err) {
      console.error('Failed to toggle active:', err);
      alert('操作失败');
    }
  };

  // 切换选中
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map(img => img._id)));
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">AI UGC 相册</h3>
          <p className="text-xs text-gray-500 mt-1">
            AI 生成的图片会自动保存到此相册，其他用户请求图片时优先从相册获取
          </p>
        </div>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
              普通: {stats.sfwCount}/{stats.maxPerCategory}
            </span>
            <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded">
              NSFW: {stats.nsfwCount}/{stats.maxPerCategory}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
              总使用: {stats.totalUsage} 次
            </span>
          </div>
        )}
      </div>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        {/* 筛选 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">类型:</span>
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as any); setPage(1); }}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">全部</option>
            <option value="sfw">普通 (SFW)</option>
            <option value="nsfw">NSFW</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">状态:</span>
          <select
            value={activeFilter}
            onChange={(e) => { setActiveFilter(e.target.value as any); setPage(1); }}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">全部</option>
            <option value="active">已启用</option>
            <option value="inactive">已禁用</option>
          </select>
        </div>

        <div className="flex-1" />

        {/* 操作按钮 */}
        {selectedIds.size > 0 && (
          <button
            onClick={handleBatchDelete}
            className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600"
          >
            删除选中 ({selectedIds.size})
          </button>
        )}

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
        >
          添加 URL
        </button>

        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e, false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          <button
            className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:opacity-50"
            disabled={uploading}
          >
            {uploading ? '上传中...' : '上传普通图片'}
          </button>
        </div>

        <div className="relative">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e, true)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={uploading}
          />
          <button
            className="px-3 py-1.5 bg-pink-500 text-white text-sm rounded hover:bg-pink-600 disabled:opacity-50"
            disabled={uploading}
          >
            {uploading ? '上传中...' : '上传 NSFW 图片'}
          </button>
        </div>
      </div>

      {/* 图片列表 */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-500">
          加载中...
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
          <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>暂无图片</p>
          <p className="text-xs mt-1">用户聊天中生成的图片会自动添加到这里</p>
        </div>
      ) : (
        <>
          {/* 全选 */}
          <div className="flex items-center gap-2 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === images.length && images.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
              全选
            </label>
            <span className="text-xs text-gray-400">
              共 {images.length} 张图片
            </span>
          </div>

          {/* 图片网格 */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {images.map((image) => (
              <div
                key={image._id}
                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                  selectedIds.has(image._id) ? 'border-indigo-500' : 'border-transparent'
                } ${!image.isActive ? 'opacity-50' : ''}`}
              >
                <img
                  src={normalizeImageUrl(image.imageUrl)}
                  alt=""
                  className="w-full h-24 object-cover cursor-pointer"
                  onClick={() => setPreviewImage(normalizeImageUrl(image.imageUrl))}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96?text=Error';
                  }}
                />

                {/* 标签 */}
                <div className="absolute top-1 left-1 flex gap-1">
                  {image.isNsfw && (
                    <span className="px-1 py-0.5 bg-pink-500 text-white text-[10px] rounded">
                      NSFW
                    </span>
                  )}
                  {!image.isActive && (
                    <span className="px-1 py-0.5 bg-gray-500 text-white text-[10px] rounded">
                      禁用
                    </span>
                  )}
                </div>

                {/* 使用次数 */}
                <div className="absolute bottom-1 left-1">
                  <span className="px-1 py-0.5 bg-black bg-opacity-50 text-white text-[10px] rounded">
                    {image.usageCount} 次
                  </span>
                </div>

                {/* 选择框 */}
                <div className="absolute top-1 right-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(image._id)}
                    onChange={() => toggleSelect(image._id)}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                {/* 悬浮操作 */}
                <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleActive(image); }}
                    className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                    title={image.isActive ? '禁用' : '启用'}
                  >
                    {image.isActive ? (
                      <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(image._id); }}
                    className="p-1.5 bg-white rounded-full hover:bg-gray-100"
                    title="删除"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
          <button
            className="absolute top-4 right-4 text-white bg-gray-800 rounded-full p-2 hover:bg-gray-700"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 添加 URL 弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-bold mb-4">添加图片 URL</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">图片 URL</label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newImageIsNsfw}
                    onChange={(e) => setNewImageIsNsfw(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">这是 NSFW 图片</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setNewImageUrl(''); setNewImageIsNsfw(false); }}
                className="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddUrl}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UgcImageGallery;
