import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Avatar,
  IconButton,
  Divider,
  Stack,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/my-agents')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Typography variant="h4" fontWeight="bold">
          {isEdit ? '编辑角色' : '创建角色'}
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            {/* Avatar Upload */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                角色头像
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                {/* Existing Avatars */}
                {formData.avatarUrls?.map((url, index) => (
                  <Box key={index} position="relative">
                    <Avatar
                      src={url}
                      sx={{ width: 80, height: 80 }}
                    />
                    <IconButton
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        bgcolor: 'error.main',
                        color: 'white',
                        '&:hover': { bgcolor: 'error.dark' },
                      }}
                      onClick={() => handleRemoveAvatar(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}

                {/* Upload Button */}
                {(formData.avatarUrls?.length || 0) < 3 && (
                  <Box
                    component="label"
                    sx={{
                      width: 80,
                      height: 80,
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                    />
                    {uploadingAvatar ? (
                      <CircularProgress size={24} />
                    ) : (
                      <UploadIcon color="action" />
                    )}
                  </Box>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">
                最多上传 3 张头像，推荐尺寸 512x512
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Basic Info */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="角色名称"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                required
                helperText="给你的 AI 角色起个名字"
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>性别</InputLabel>
                <Select
                  value={formData.gender}
                  label="性别"
                  onChange={e => handleChange('gender', e.target.value)}
                >
                  <MenuItem value="female">女</MenuItem>
                  <MenuItem value="male">男</MenuItem>
                  <MenuItem value="other">其他</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={3}>
              <FormControl fullWidth>
                <InputLabel>风格</InputLabel>
                <Select
                  value={formData.style}
                  label="风格"
                  onChange={e => handleChange('style', e.target.value)}
                >
                  <MenuItem value="realistic">写实</MenuItem>
                  <MenuItem value="anime">动漫</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="角色描述"
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
                multiline
                rows={2}
                helperText="简单介绍一下这个角色"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Personality */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="角色设定 (System Prompt)"
                value={formData.systemPrompt}
                onChange={e => handleChange('systemPrompt', e.target.value)}
                multiline
                rows={4}
                helperText="定义角色的性格、背景故事、说话风格等。例如：你是一个温柔体贴的女友，喜欢撒娇..."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="开场白"
                value={formData.defaultGreeting}
                onChange={e => handleChange('defaultGreeting', e.target.value)}
                multiline
                rows={2}
                helperText="用户第一次与角色对话时，角色说的第一句话"
              />
            </Grid>

            {/* Voice (optional) */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="语音 ID (可选)"
                value={formData.voiceId}
                onChange={e => handleChange('voiceId', e.target.value)}
                helperText="Fish Audio 语音模型 ID，留空使用默认语音"
              />
            </Grid>
          </Grid>

          {/* Submit Button */}
          <Box mt={4} display="flex" justifyContent="flex-end" gap={2}>
            <Button
              variant="outlined"
              onClick={() => navigate('/my-agents')}
            >
              取消
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? '保存中...' : (isEdit ? '保存修改' : '创建角色')}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Tips */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            提示
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 创建的角色默认为私有状态，只有你自己可以看到和使用<br />
            • 完善角色信息后，可以提交审核申请公开<br />
            • 审核通过后，其他用户也可以与你的角色互动<br />
            • 请确保角色内容符合社区规范，违规内容将被拒绝
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
