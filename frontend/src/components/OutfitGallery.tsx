/**
 * 衣服/场景画廊组件
 * 
 * 显示 AI 主播的所有衣服/场景，支持解锁和查看
 */

import { useState, useEffect } from 'react';
import { http } from '../api/http';
import { normalizeImageUrl } from '../utils/imageUrl';

interface Outfit {
  _id: string;
  name: string;
  description: string;
  level: number;
  unlockType: string;
  unlockValue: number;
  previewUrl: string;
  imageUrls: string[];
  videoUrls: string[];
  isUnlocked: boolean;
  canUnlock: boolean;
  unlockReason: string;
}

interface OutfitGalleryProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onBalanceChange: (balance: number) => void;
}

export function OutfitGallery({ agentId, agentName, isOpen, onClose, onBalanceChange }: OutfitGalleryProps) {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [selectedOutfit, setSelectedOutfit] = useState<Outfit | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [intimacy, setIntimacy] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchOutfits();
    }
  }, [isOpen, agentId]);

  const fetchOutfits = async () => {
    setLoading(true);
    try {
      const res = await http.get(`/outfit/list/${agentId}`);
      setOutfits(res.data.outfits || []);
      setIntimacy(res.data.intimacy || 0);
    } catch (err) {
      console.error('Failed to fetch outfits:', err);
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const unlockOutfit = async (outfit: Outfit) => {
    setUnlocking(outfit._id);
    setError('');
    
    try {
      const res = await http.post('/outfit/unlock', { agentId, outfitId: outfit._id });
      if (res.data.balance !== undefined) {
        onBalanceChange(res.data.balance);
      }
      // 刷新列表
      await fetchOutfits();
      setSelectedOutfit(null);
    } catch (err: any) {
      console.error('Failed to unlock outfit:', err);
      setError(err.response?.data?.message || '解锁失败');
    } finally {
      setUnlocking(null);
    }
  };

  const getLevelLabel = (level: number) => {
    const labels = ['', '日常', '性感', '暴露', '大尺度', '极限'];
    return labels[level] || '';
  };

  const getLevelColor = (level: number) => {
    const colors = ['', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 
                    'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700', 'bg-purple-100 text-purple-700'];
    return colors[level] || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div 
        className="w-full max-w-2xl mx-4 bg-white rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{agentName}的私房照</h3>
            <p className="text-sm text-gray-500">亲密度: {intimacy}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 内容区 */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : outfits.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-2">📷</p>
              <p>暂无内容</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {outfits.map(outfit => (
                <div
                  key={outfit._id}
                  onClick={() => setSelectedOutfit(outfit)}
                  className={`relative rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                    outfit.isUnlocked ? 'ring-2 ring-pink-400' : 'opacity-80'
                  }`}
                >
                  {/* 预览图 */}
                  <div className="aspect-[3/4] bg-gray-100">
                    <img 
                      src={normalizeImageUrl(outfit.isUnlocked && outfit.imageUrls[0] ? outfit.imageUrls[0] : outfit.previewUrl, 'https://via.placeholder.com/300x400?text=?')}
                      alt={outfit.name}
                      className={`w-full h-full object-cover ${!outfit.isUnlocked ? 'blur-lg' : ''}`}
                    />
                  </div>
                  
                  {/* 锁定遮罩 */}
                  {!outfit.isUnlocked && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                      <span className="text-3xl mb-1">🔒</span>
                      <span className="text-white text-xs text-center px-2">{outfit.unlockReason}</span>
                    </div>
                  )}
                  
                  {/* 标签 */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(outfit.level)}`}>
                      {getLevelLabel(outfit.level)}
                    </span>
                  </div>
                  
                  {/* 名称 */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-white text-sm font-medium truncate">{outfit.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 详情弹窗 */}
      {selectedOutfit && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80" onClick={() => setSelectedOutfit(null)}>
          <div className="w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            {selectedOutfit.isUnlocked ? (
              // 已解锁：显示图片轮播
              <div className="relative">
                <img 
                  src={normalizeImageUrl(selectedOutfit.imageUrls[currentImageIndex] || selectedOutfit.previewUrl, 'https://via.placeholder.com/600x800')}
                  alt={selectedOutfit.name}
                  className="w-full rounded-2xl"
                />
                {selectedOutfit.imageUrls.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                    {selectedOutfit.imageUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-2 h-2 rounded-full ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
                <button 
                  onClick={() => setSelectedOutfit(null)}
                  className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white"
                >
                  ✕
                </button>
              </div>
            ) : (
              // 未解锁：显示解锁界面
              <div className="bg-white rounded-2xl p-6 text-center">
                <div className="text-5xl mb-4">🔒</div>
                <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedOutfit.name}</h4>
                <p className="text-gray-600 mb-4">{selectedOutfit.description}</p>
                <p className="text-sm text-gray-500 mb-6">{selectedOutfit.unlockReason}</p>
                
                {selectedOutfit.canUnlock && (
                  <button
                    onClick={() => unlockOutfit(selectedOutfit)}
                    disabled={unlocking === selectedOutfit._id}
                    className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
                  >
                    {unlocking === selectedOutfit._id ? '解锁中...' : `花费 ${selectedOutfit.unlockValue} 金币解锁`}
                  </button>
                )}
                
                <button
                  onClick={() => setSelectedOutfit(null)}
                  className="w-full mt-3 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl hover:bg-gray-200"
                >
                  返回
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default OutfitGallery;
