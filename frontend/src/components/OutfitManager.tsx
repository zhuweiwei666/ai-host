/**
 * Outfit 管理组件（管理员用）
 * 
 * 显示 AI 主播的所有衣服/场景，支持一键生成图片
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
  isActive: boolean;
}

interface OutfitManagerProps {
  agentId: string;
  agentName?: string;
}

export function OutfitManager({ agentId }: OutfitManagerProps) {
  // Temporarily disabled (not used right now)
  const ENABLE_OUTFIT_MANAGER = false;
  if (!ENABLE_OUTFIT_MANAGER) return null;

  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null); // outfitId or 'all'
  const [progress, setProgress] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (agentId) {
      fetchOutfits();
    }
  }, [agentId]);

  const fetchOutfits = async () => {
    setLoading(true);
    try {
      const res = await http.get(`/outfit/admin/list/${agentId}`);
      setOutfits(res.data.outfits || []);
    } catch (err) {
      console.error('Failed to fetch outfits:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateImagesForOutfit = async (outfitId: string, outfitName: string) => {
    if (!confirm(`确定要为「${outfitName}」生成图片吗？这将消耗 API 额度。`)) return;
    
    setGenerating(outfitId);
    setProgress(`正在为「${outfitName}」生成图片...`);
    
    try {
      const res = await http.post(`/outfit/generate-images/${outfitId}`, { count: 1 });
      setProgress(`✅ ${res.data.message}`);
      await fetchOutfits();
    } catch (err: any) {
      console.error('Generate failed:', err);
      setProgress(`❌ 生成失败: ${err.response?.data?.message || err.message}`);
    } finally {
      setGenerating(null);
      setTimeout(() => setProgress(''), 3000);
    }
  };

  const generateAllImages = async () => {
    const outfitsWithoutImages = outfits.filter(o => !o.imageUrls || o.imageUrls.length === 0);
    if (outfitsWithoutImages.length === 0) {
      alert('所有衣服都已有图片！');
      return;
    }
    
    if (!confirm(`确定要为 ${outfitsWithoutImages.length} 套没有图片的衣服生成图片吗？\n这将消耗较多 API 额度，预计需要 ${outfitsWithoutImages.length * 3} 秒。`)) return;
    
    setGenerating('all');
    setProgress(`正在为 ${outfitsWithoutImages.length} 套衣服生成图片...`);
    
    try {
      const res = await http.post(`/outfit/generate-all/${agentId}`, { countPerOutfit: 1 });
      setProgress(`✅ ${res.data.message}`);
      await fetchOutfits();
    } catch (err: any) {
      console.error('Generate all failed:', err);
      setProgress(`❌ 批量生成失败: ${err.response?.data?.message || err.message}`);
    } finally {
      setGenerating(null);
      setTimeout(() => setProgress(''), 5000);
    }
  };

  const getLevelColor = (level: number) => {
    const colors = ['', 'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 
                    'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700', 'bg-purple-100 text-purple-700'];
    return colors[level] || '';
  };

  const outfitsWithoutImages = outfits.filter(o => !o.imageUrls || o.imageUrls.length === 0).length;

  return (
    <div className="border border-purple-200 rounded-lg overflow-hidden">
      {/* 标题栏 */}
      <div 
        className="bg-purple-50 px-4 py-3 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📷</span>
          <div>
            <h3 className="font-medium text-gray-900">私房照管理</h3>
            <p className="text-xs text-gray-500">
              共 {outfits.length} 套 · {outfitsWithoutImages > 0 ? `${outfitsWithoutImages} 套待生成图片` : '全部已有图片'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {outfitsWithoutImages > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); generateAllImages(); }}
              disabled={generating !== null}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
            >
              {generating === 'all' ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  生成中...
                </>
              ) : (
                <>🚀 一键生成全部</>
              )}
            </button>
          )}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* 进度提示 */}
      {progress && (
        <div className="px-4 py-2 bg-blue-50 text-blue-700 text-sm border-b border-blue-100">
          {progress}
        </div>
      )}

      {/* 内容区 */}
      {expanded && (
        <div className="p-4 bg-white">
          {loading ? (
            <div className="text-center py-8 text-gray-400">加载中...</div>
          ) : outfits.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无衣服数据</p>
              <p className="text-xs mt-1">请先运行 generate_outfits_and_greetings.js 脚本</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {outfits.map(outfit => (
                <div 
                  key={outfit._id}
                  className="relative rounded-lg overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {/* 图片区域 */}
                  <div className="aspect-[3/4] bg-gray-100 relative">
                    {outfit.imageUrls && outfit.imageUrls.length > 0 ? (
                      <img 
                        src={normalizeImageUrl(outfit.imageUrls[0], '')}
                        alt={outfit.name}
                        className="w-full h-full object-cover"
                      />
                    ) : outfit.previewUrl ? (
                      <img 
                        src={normalizeImageUrl(outfit.previewUrl, '')}
                        alt={outfit.name}
                        className="w-full h-full object-cover opacity-50"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <span className="text-2xl mb-1">📷</span>
                        <span className="text-xs">无图片</span>
                      </div>
                    )}
                    
                    {/* 级别标签 */}
                    <div className="absolute top-1 left-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getLevelColor(outfit.level)}`}>
                        L{outfit.level}
                      </span>
                    </div>
                    
                    {/* 图片数量 */}
                    {outfit.imageUrls && outfit.imageUrls.length > 0 && (
                      <div className="absolute top-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {outfit.imageUrls.length}张
                      </div>
                    )}
                    
                    {/* 生成按钮遮罩 */}
                    {(!outfit.imageUrls || outfit.imageUrls.length === 0) && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => generateImagesForOutfit(outfit._id, outfit.name)}
                          disabled={generating !== null}
                          className="px-2 py-1 bg-white text-purple-600 text-xs rounded-lg font-medium hover:bg-purple-50 disabled:opacity-50"
                        >
                          {generating === outfit._id ? '生成中...' : '🎨 生成图片'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* 信息区域 */}
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate" title={outfit.name}>
                      {outfit.name}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {outfit.unlockType === 'free' ? '免费' : 
                       outfit.unlockType === 'intimacy' ? `亲密度${outfit.unlockValue}` : 
                       outfit.unlockType === 'coins' ? `${outfit.unlockValue}金币` : '礼物'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OutfitManager;
