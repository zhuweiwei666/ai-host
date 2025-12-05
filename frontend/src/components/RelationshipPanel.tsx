/**
 * 关系面板组件
 * 
 * 显示与 AI 主播的关系数据，包括亲密度、在一起天数、专属昵称设置等
 */

import { useState, useEffect } from 'react';
import { http } from '../api/http';

interface RelationshipData {
  intimacy: number;
  daysTogether: number;
  relationshipTitle: string;
  petName: string;
  userCallsMe: string;
  totalMessages: number;
  totalGiftCount: number;
  totalGiftCoins: number;
}

interface RelationshipPanelProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RelationshipPanel({ agentId, agentName, isOpen, onClose }: RelationshipPanelProps) {
  const [data, setData] = useState<RelationshipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingPetName, setEditingPetName] = useState(false);
  const [editingUserCallsMe, setEditingUserCallsMe] = useState(false);
  const [petNameInput, setPetNameInput] = useState('');
  const [userCallsMeInput, setUserCallsMeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchRelationship();
    }
  }, [isOpen, agentId]);

  const fetchRelationship = async () => {
    setLoading(true);
    try {
      const res = await http.get(`/profile/${agentId}/relationship`);
      setData(res.data);
      setPetNameInput(res.data.petName || '');
      setUserCallsMeInput(res.data.userCallsMe || '');
    } catch (err) {
      console.error('Failed to fetch relationship:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePetName = async () => {
    setSaving(true);
    try {
      await http.post(`/profile/${agentId}/pet-name`, { petName: petNameInput });
      setData(prev => prev ? { ...prev, petName: petNameInput } : null);
      setEditingPetName(false);
      setSuccess('专属称呼已保存！');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to save pet name:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveUserCallsMe = async () => {
    setSaving(true);
    try {
      await http.post(`/profile/${agentId}/pet-name`, { userCallsMe: userCallsMeInput });
      setData(prev => prev ? { ...prev, userCallsMe: userCallsMeInput } : null);
      setEditingUserCallsMe(false);
      setSuccess('称呼已保存！');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Failed to save user calls me:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const getIntimacyProgress = (intimacy: number) => {
    // 100为满级
    return Math.min(intimacy, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">我和{agentName}的关系</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 成功提示 */}
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-xl text-sm text-center">
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : data && (
          <div className="space-y-6">
            {/* 关系称号 */}
            <div className="text-center">
              <div className="text-3xl mb-2">{data.relationshipTitle}</div>
              <div className="text-sm text-gray-500">在一起 {data.daysTogether} 天</div>
            </div>

            {/* 亲密度进度条 */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">亲密度</span>
                <span className="font-bold text-pink-500">{data.intimacy}</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-400 to-red-500 transition-all duration-500"
                  style={{ width: `${getIntimacyProgress(data.intimacy)}%` }}
                />
              </div>
            </div>

            {/* 专属称呼设置 */}
            <div className="space-y-4">
              {/* 她叫你什么 */}
              <div className="p-4 bg-pink-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">{agentName}叫你</span>
                  {!editingPetName && (
                    <button 
                      onClick={() => setEditingPetName(true)}
                      className="text-xs text-pink-500"
                    >
                      修改
                    </button>
                  )}
                </div>
                {editingPetName ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={petNameInput}
                      onChange={e => setPetNameInput(e.target.value)}
                      placeholder="老公、宝贝、哥哥..."
                      className="flex-1 px-3 py-2 border border-pink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400"
                    />
                    <button
                      onClick={savePetName}
                      disabled={saving}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50"
                    >
                      {saving ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => setEditingPetName(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-pink-600">
                    {data.petName || '还没设置哦~'}
                  </div>
                )}
              </div>

              {/* 你叫她什么 */}
              <div className="p-4 bg-purple-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">你叫{agentName}</span>
                  {!editingUserCallsMe && (
                    <button 
                      onClick={() => setEditingUserCallsMe(true)}
                      className="text-xs text-purple-500"
                    >
                      修改
                    </button>
                  )}
                </div>
                {editingUserCallsMe ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userCallsMeInput}
                      onChange={e => setUserCallsMeInput(e.target.value)}
                      placeholder="宝贝、老婆、小甜心..."
                      className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button
                      onClick={saveUserCallsMe}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                    >
                      {saving ? '...' : '保存'}
                    </button>
                    <button
                      onClick={() => setEditingUserCallsMe(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="text-lg font-bold text-purple-600">
                    {data.userCallsMe || '还没设置哦~'}
                  </div>
                )}
              </div>
            </div>

            {/* 统计数据 */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{data.totalMessages}</div>
                <div className="text-xs text-gray-500">消息</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{data.totalGiftCount}</div>
                <div className="text-xs text-gray-500">礼物</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{data.totalGiftCoins}</div>
                <div className="text-xs text-gray-500">金币</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default RelationshipPanel;
