import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CreateUserAgentData,
  createUserAgent,
  getUserAgent,
  updateUserAgent,
  uploadImage,
} from '../api';

export default function CreateUserAgent() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [formData, setFormData] = useState<CreateUserAgentData>({
    name: '',
    gender: 'female',
    style: 'realistic',
    description: '',
    avatarUrls: [],
    systemPrompt: '',
    voiceId: '',
    defaultGreeting: '',
  });

  // Load existing agent data if editing
  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      getUserAgent(id)
        .then(res => {
          const agent = res.data;
          setFormData({
            name: agent.name || '',
            gender: agent.gender || 'female',
            style: agent.style || 'realistic',
            description: agent.description || '',
            avatarUrls: agent.avatarUrls || [],
            systemPrompt: agent.systemPrompt || '',
            voiceId: agent.voiceId || '',
            defaultGreeting: agent.defaultGreeting || '',
          });
        })
        .catch(err => {
          setError(err.message || '加载角色信息失败');
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, id]);

  const handleChange = (field: keyof CreateUserAgentData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }

    try {
      setUploadingAvatar(true);
      setError(null);
      const result = await uploadImage(file, 'user-agents');
      setFormData(prev => ({
        ...prev,
        avatarUrls: [result.url, ...(prev.avatarUrls || []).slice(0, 2)], // Max 3 avatars
      }));
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '上传失败';
      setError(errorMessage);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      avatarUrls: (prev.avatarUrls || []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    // Validate
    if (!formData.name.trim()) {
      setError('请输入角色名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEdit && id) {
        await updateUserAgent(id, formData);
        setSuccess('角色已更新');
      } else {
        await createUserAgent(formData);
        setSuccess('角色创建成功！');
        // Navigate back after short delay
        setTimeout(() => navigate('/my-agents'), 1500);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '保存失败';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/my-agents')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? '编辑角色' : '创建角色'}
        </h1>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
          <span className="text-green-700">{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* Avatar Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">角色头像</label>
          <div className="flex items-center gap-4">
            {/* Existing Avatars */}
            {formData.avatarUrls?.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Avatar ${index + 1}`}
                  className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                />
                <button
                  onClick={() => handleRemoveAvatar(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Upload Button */}
            {(formData.avatarUrls?.length || 0) < 3 && (
              <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center cursor-pointer hover:border-primary-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
                {uploadingAvatar ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </label>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">最多上传 3 张头像，推荐尺寸 512x512</p>
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="sm:col-span-2 sm:w-1/2">
            <label className="block text-sm font-medium text-gray-700 mb-1">角色名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
              placeholder="给你的 AI 角色起个名字"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
            <select
              value={formData.gender}
              onChange={e => handleChange('gender', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
            >
              <option value="female">女</option>
              <option value="male">男</option>
              <option value="other">其他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">风格</label>
            <select
              value={formData.style}
              onChange={e => handleChange('style', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
            >
              <option value="realistic">写实</option>
              <option value="anime">动漫</option>
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">角色描述</label>
          <textarea
            value={formData.description}
            onChange={e => handleChange('description', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
            placeholder="简单介绍一下这个角色"
          />
        </div>

        <hr className="my-6 border-gray-200" />

        {/* Personality */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">角色设定 (System Prompt)</label>
          <textarea
            value={formData.systemPrompt}
            onChange={e => handleChange('systemPrompt', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
            placeholder="定义角色的性格、背景故事、说话风格等。例如：你是一个温柔体贴的女友，喜欢撒娇..."
          />
          <p className="text-xs text-gray-500 mt-1">定义角色的性格、背景故事、说话风格等</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">开场白</label>
          <textarea
            value={formData.defaultGreeting}
            onChange={e => handleChange('defaultGreeting', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors resize-none"
            placeholder="用户第一次与角色对话时，角色说的第一句话"
          />
        </div>

        {/* Voice (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">语音 ID (可选)</label>
          <input
            type="text"
            value={formData.voiceId}
            onChange={e => handleChange('voiceId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
            placeholder="Fish Audio 语音模型 ID，留空使用默认语音"
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate('/my-agents')}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                保存中...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {isEdit ? '保存修改' : '创建角色'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-medium text-blue-700 mb-2">提示</h4>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• 创建的角色默认为私有状态，只有你自己可以看到和使用</li>
          <li>• 完善角色信息后，可以提交审核申请公开</li>
          <li>• 审核通过后，其他用户也可以与你的角色互动</li>
          <li>• 请确保角色内容符合社区规范，违规内容将被拒绝</li>
        </ul>
      </div>
    </div>
  );
}
