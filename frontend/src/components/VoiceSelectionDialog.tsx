import React, { useEffect, useState } from 'react';
import { VoiceModel, getVoiceModels } from '../api';

interface VoiceSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (voiceId: string) => void;
  selectedVoiceId?: string;
}

const VoiceSelectionDialog: React.FC<VoiceSelectionDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedVoiceId,
}) => {
  const [voices, setVoices] = useState<VoiceModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');

  useEffect(() => {
    if (isOpen) {
      loadVoices();
    }
  }, [isOpen]);

  const loadVoices = async () => {
    setLoading(true);
    try {
      const res = await getVoiceModels({ favoriteOnly: true });
      setVoices(res.data);
    } catch (error) {
      console.error('Failed to load voices', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch = voice.title.toLowerCase().includes(search.toLowerCase()) || 
                          voice.remoteId.includes(search);
    const matchesGender = filterGender === 'all' || voice.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">选择语音模板</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索模型名称或 ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div className="flex rounded-md shadow-sm">
            <button
              type="button"
              onClick={() => setFilterGender('all')}
              className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                filterGender === 'all' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('female')}
              className={`px-4 py-2 text-sm font-medium border-t border-b ${
                filterGender === 'female' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              女声
            </button>
            <button
              type="button"
              onClick={() => setFilterGender('male')}
              className={`px-4 py-2 text-sm font-medium rounded-r-md border ${
                filterGender === 'male' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              男声
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-12 w-12 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-gray-500">没有找到匹配的语音模板</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVoices.map((voice) => {
                const isSelected = selectedVoiceId === voice.remoteId;
                return (
                  <button
                    key={voice._id}
                    onClick={() => {
                      onSelect(voice.remoteId);
                      onClose();
                    }}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm ${
                      isSelected 
                        ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-200 bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0 relative">
                      <img
                        src={voice.coverImage || 'https://via.placeholder.com/48'}
                        alt={voice.title}
                        className="w-12 h-12 rounded-md object-cover bg-gray-100"
                      />
                      {voice.gender === 'female' && (
                        <span className="absolute -bottom-1 -right-1 bg-pink-100 text-pink-600 text-[10px] px-1 rounded-full">♀</span>
                      )}
                      {voice.gender === 'male' && (
                        <span className="absolute -bottom-1 -right-1 bg-blue-100 text-blue-600 text-[10px] px-1 rounded-full">♂</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-gray-900'}`}>
                        {voice.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1 break-all">{voice.remoteId}</p>
                      <div className="flex gap-1 mt-1.5">
                        {voice.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 text-indigo-600">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span>共 {filteredVoices.length} 个模板</span>
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-medium">
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceSelectionDialog;

