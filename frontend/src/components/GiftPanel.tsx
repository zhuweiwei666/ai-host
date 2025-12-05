/**
 * 礼物面板组件
 * 
 * 显示可送的礼物列表，支持送礼物给 AI 主播
 */

import { useState, useEffect } from 'react';
import { http } from '../api/http';

interface Gift {
  _id: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  intimacyBonus: number;
  category: string;
}

interface GiftPanelProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onGiftSent: (response: { userMessage: string; aiResponse: string; balance: number; intimacy: number }) => void;
  balance: number;
}

export function GiftPanel({ agentId, agentName, isOpen, onClose, onGiftSent, balance }: GiftPanelProps) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchGifts();
    }
  }, [isOpen]);

  const fetchGifts = async () => {
    setLoading(true);
    try {
      const res = await http.get('/gift/list');
      setGifts(res.data.gifts || []);
    } catch (err) {
      console.error('Failed to fetch gifts:', err);
      setError('加载礼物列表失败');
    } finally {
      setLoading(false);
    }
  };

  const sendGift = async (gift: Gift) => {
    if (balance < gift.price) {
      setError(`金币不足，需要 ${gift.price} 金币`);
      return;
    }

    setSending(gift._id);
    setError('');
    
    try {
      const res = await http.post('/gift/send', { agentId, giftId: gift._id });
      onGiftSent({
        userMessage: res.data.userMessage,
        aiResponse: res.data.aiResponse,
        balance: res.data.balance,
        intimacy: res.data.intimacy
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to send gift:', err);
      setError(err.response?.data?.message || '送礼物失败');
    } finally {
      setSending(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white rounded-t-3xl p-6 pb-8 animate-slide-up max-h-[70vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">送礼物给 {agentName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 余额显示 */}
        <div className="flex items-center gap-2 mb-4 p-3 bg-yellow-50 rounded-xl">
          <span className="text-yellow-500 text-xl">💰</span>
          <span className="text-gray-600">当前余额：</span>
          <span className="font-bold text-yellow-600">{balance} 金币</span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* 礼物列表 */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {gifts.map(gift => (
              <button
                key={gift._id}
                onClick={() => sendGift(gift)}
                disabled={sending === gift._id || balance < gift.price}
                className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${
                  balance < gift.price
                    ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                    : sending === gift._id
                    ? 'bg-pink-100 border-pink-400 animate-pulse'
                    : 'bg-white border-gray-200 hover:border-pink-400 hover:shadow-lg active:scale-95'
                }`}
              >
                <span className="text-4xl mb-2">{gift.emoji}</span>
                <span className="text-sm font-medium text-gray-800">{gift.name}</span>
                <span className="text-xs text-pink-500 font-bold">{gift.price} 金币</span>
                <span className="text-xs text-gray-400 mt-1">+{gift.intimacyBonus} 亲密度</span>
              </button>
            ))}
          </div>
        )}

        {/* 提示 */}
        <p className="text-center text-xs text-gray-400 mt-4">
          送礼物可以增加亲密度，解锁更多内容哦~
        </p>
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

export default GiftPanel;
