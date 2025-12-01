import React from 'react';
import VoiceModelManager from '../components/VoiceModelManager';

const VoiceModelsPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Voice 模型管理</h1>
        <p className="text-sm text-gray-500 mt-1">管理 Fish Audio 同步的语音模型，标记收藏后可在创建主播时快速选择。</p>
      </div>
      
      <VoiceModelManager />
    </div>
  );
};

export default VoiceModelsPage;

