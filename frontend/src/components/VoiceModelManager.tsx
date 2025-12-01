import React, { useEffect, useState } from 'react';
import {
  VoiceModel,
  getVoiceModels,
  syncVoiceModels,
  updateVoiceModelFavorite,
  updateVoiceModel,
  deleteVoiceModel,
  batchDeleteVoiceModels, // Import batch delete
  getVoicePreview,
} from '../api';
import ManualAddVoice from './ManualAddVoice';

const VoiceModelManager: React.FC = () => {
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadModels = async (favoriteOnly: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getVoiceModels(
        favoriteOnly ? { favoriteOnly: true } : undefined
      );
      setModels(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || '无法获取语音模型列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels(showFavorites);
  }, [showFavorites]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await syncVoiceModels();
      const { fetched, upserted, remoteTotal, truncated, limit } = res.data as any;
      let info = `已同步 ${fetched} 个模型，新增 ${upserted} 个。`;
      if (truncated && remoteTotal) {
        info += `（Fish Audio 共 ${remoteTotal} 个，当前只抓取前 ${limit || fetched} 个，可在后台配置 FISH_AUDIO_SYNC_LIMIT 调整）`;
      }
      setMessage(info);
      loadModels(showFavorites);
    } catch (err: any) {
      setError(err?.response?.data?.message || '同步失败，请确认已配置 FISH_AUDIO_API_TOKEN');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleFavorite = async (model: VoiceModel) => {
    try {
      await updateVoiceModelFavorite(model._id, !model.isFavorite);
      loadModels(showFavorites);
    } catch (err) {
      alert('更新收藏状态失败，请稍后重试');
    }
  };

  const handleManualSuccess = () => {
    loadModels(showFavorites);
  };

  const handleGenderChange = async (modelId: string, gender: 'male' | 'female' | 'other' | '') => {
    try {
      await updateVoiceModel(modelId, { gender });
      setModels(prev => prev.map(m => m._id === modelId ? { ...m, gender } : m));
    } catch (err) {
      alert('更新性别失败，请稍后重试');
      loadModels(showFavorites);
    }
  };

  const handleDelete = async (modelId: string) => {
    if (!confirm('确定要删除这个语音模型吗？此操作不可恢复。')) return;
    try {
      await deleteVoiceModel(modelId);
      setModels(prev => prev.filter(m => m._id !== modelId));
    } catch (err) {
      alert('删除失败，请稍后重试');
    }
  };

  const handlePreview = async (model: VoiceModel) => {
    if (playingPreview === model._id) return; // Already playing (or loading) logic could be improved with audio ref
    
    setPlayingPreview(model._id);
    try {
      // If model already has cached URL locally (in state), use it? 
      // The backend might update it, but let's just call API which handles cache check.
      const res = await getVoicePreview(model._id);
      
      const audio = new Audio(res.data.url);
      audio.onended = () => setPlayingPreview(null);
      audio.onerror = () => {
        alert('播放预览失败');
        setPlayingPreview(null);
      };
      await audio.play();
      
      // Update local model state if it didn't have url before (for UI if we showed it)
      if (!model.previewAudioUrl) {
         setModels(prev => prev.map(m => m._id === model._id ? { ...m, previewAudioUrl: res.data.url } : m));
      }
    } catch (err) {
      console.error(err);
      alert('获取预览音频失败');
      setPlayingPreview(null);
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
        newSelected.delete(id);
    } else {
        newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === models.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(models.map(m => m._id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个模型吗？`)) return;

    try {
        await batchDeleteVoiceModels(Array.from(selectedIds));
        setModels(prev => prev.filter(m => !selectedIds.has(m._id)));
        setSelectedIds(new Set());
        setMessage(`成功删除 ${selectedIds.size} 个模型`);
    } catch (err: any) {
        alert('批量删除失败: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-6 mb-8">
      <ManualAddVoice onSuccess={handleManualSuccess} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t pt-6 border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Fish Audio 语音模型库</h2>
          <p className="text-sm text-gray-500">
            通过 API 同步模型并收藏常用 voiceId，创建主播时可一键选择。
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mr-2 bg-red-50 px-3 py-1 rounded-md border border-red-100">
                <span className="text-sm text-red-700">已选 {selectedIds.size} 项</span>
                <button 
                    onClick={handleBatchDelete}
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
                >
                    批量删除
                </button>
            </div>
          )}

          <div className="flex rounded-md border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={handleSelectAll}
              className={`px-3 py-1 text-sm border-r border-gray-200 ${
                selectedIds.size > 0 && selectedIds.size === models.length 
                    ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                    : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => setShowFavorites(false)}
              className={`px-3 py-1 text-sm ${
                !showFavorites ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setShowFavorites(true)}
              className={`px-3 py-1 text-sm ${
                showFavorites ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              我的收藏
            </button>
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {syncing ? '同步中...' : '同步 Fish Audio 模型'}
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className="mt-4">
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-gray-500">加载模型中...</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-gray-500">
            {showFavorites ? '还没有收藏的模型，先去收藏几个吧。' : '暂无数据，请先点击右上角同步。'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((model) => (
              <div
                key={model._id}
                className={`border rounded-lg p-4 flex gap-4 items-start hover:border-indigo-200 group relative transition-colors ${
                    selectedIds.has(model._id) ? 'border-indigo-300 bg-indigo-50' : ''
                }`}
              >
                {/* Selection Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                    <input 
                        type="checkbox"
                        checked={selectedIds.has(model._id)}
                        onChange={() => handleSelect(model._id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                </div>

                <button
                  onClick={() => handleDelete(model._id)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  title="删除"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div className="relative flex-shrink-0 group/img cursor-pointer ml-6" onClick={() => handlePreview(model)}>
                  <img
                    src={model.coverImage || 'https://via.placeholder.com/64'}
                    alt={model.title}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className={`absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center rounded transition-opacity ${playingPreview === model._id ? 'opacity-100' : 'opacity-0 group-hover/img:opacity-100'}`}>
                    {playingPreview === model._id ? (
                      <svg className="h-8 w-8 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    ) : (
                      <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 pr-6">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={model.title}>{model.title}</p>
                      <p className="text-xs text-gray-500 break-all line-clamp-1" title={model.remoteId}>{model.remoteId}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={model.gender || ''}
                        onChange={(e) => handleGenderChange(model._id, e.target.value as any)}
                        className="text-[10px] border-gray-200 rounded bg-gray-50 text-gray-600 py-0.5 px-1 h-5 focus:ring-0 focus:border-gray-300"
                        title="标记性别"
                      >
                        <option value="">未标记</option>
                        <option value="male">男</option>
                        <option value="female">女</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(model)}
                      className={`text-xs flex-shrink-0 ${
                        model.isFavorite ? 'text-yellow-600 font-medium' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {model.isFavorite ? '已收藏' : '收藏'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default VoiceModelManager;
