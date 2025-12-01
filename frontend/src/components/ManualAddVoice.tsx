import React, { useState } from 'react';
import { createVoiceModelManual, extractVoiceId, uploadImage } from '../api';

interface ManualAddVoiceProps {
  onSuccess: () => void;
}

const ManualAddVoice: React.FC<ManualAddVoiceProps> = ({ onSuccess }) => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [step, setStep] = useState<'input' | 'edit'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form data for step 2
  const [formData, setFormData] = useState({
    remoteId: '',
    title: '',
    coverImage: '',
    description: '',
    gender: '' as 'male' | 'female' | 'other' | '',
  });
  const [uploading, setUploading] = useState(false);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUrl.trim()) {
      setError('请填写 Fish Audio 模板链接');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const res = await extractVoiceId(sourceUrl.trim());
      const { voiceId } = res.data;
      
      setFormData({
        remoteId: voiceId,
        title: 'New Voice Model',
        coverImage: '',
        description: `Imported from ${sourceUrl}`,
        gender: '',
      });
      setStep('edit');
    } catch (err: any) {
      setError(err?.response?.data?.message || '提取失败，请检查链接格式');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        const res = await uploadImage(e.target.files[0]);
        setFormData(prev => ({ ...prev, coverImage: res.url }));
      } catch (err) {
        alert('上传失败');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('请输入模型名称');
      return;
    }
    setLoading(true);
    try {
      await createVoiceModelManual(formData);
      setSuccessMsg('保存成功！');
      setStep('input');
      setSourceUrl('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err?.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'edit') {
    return (
      <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-800 mb-4">完善模型信息</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Voice ID (只读)</label>
            <input
              type="text"
              value={formData.remoteId}
              readOnly
              className="w-full rounded border-gray-300 bg-gray-100 text-sm p-2 text-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">模型名称</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full rounded border-gray-300 text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">性别</label>
            <select
              value={formData.gender}
              onChange={e => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
              className="w-full rounded border-gray-300 text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">请选择性别</option>
              <option value="male">Male (男)</option>
              <option value="female">Female (女)</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">封面图片</label>
            <div className="flex items-center gap-3">
              {formData.coverImage && (
                <img src={formData.coverImage} alt="Preview" className="w-10 h-10 rounded object-cover" />
              )}
              <input 
                type="file" 
                onChange={handleImageUpload} 
                className="text-xs text-gray-500"
                disabled={uploading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('input')}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={loading || uploading}
              className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '保存中...' : '确认保存'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
      <h3 className="text-sm font-bold text-gray-800 mb-2">手动提取 Voice ID</h3>
      <form onSubmit={handleExtract} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="粘贴 Fish Audio 链接 (https://fish.audio/...)"
            className="flex-1 rounded border-gray-300 text-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '提取中...' : '提取并保存'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}
      </form>
    </div>
  );
};

export default ManualAddVoice;
