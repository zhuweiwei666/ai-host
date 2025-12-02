# OSS 存储迁移完成

## 已迁移的服务

所有生成的资源现在都会自动上传到 OSS，而不是保存到本地服务器。

### ✅ 已修复的服务

1. **图片生成服务** (`imageGenerationService.js`)
   - 修改前：保存到 `backend/uploads/` 并返回 `/uploads/xxx.png`
   - 修改后：上传到 OSS 并返回完整的 HTTPS OSS URL
   - 回退机制：如果 OSS 上传失败，仍会保存到本地作为备用

2. **视频生成服务** (`videoGenerationService.js`)
   - 修改前：保存到 `backend/uploads/` 并返回 `/uploads/xxx.mp4`
   - 修改后：上传到 OSS 并返回完整的 HTTPS OSS URL
   - 回退机制：如果 OSS 上传失败，仍会保存到本地作为备用

3. **音频生成服务** (`fishAudioService.js`)
   - 修改前：保存到 `backend/uploads/` 并返回 `/uploads/xxx.mp3`
   - 修改后：上传到 OSS 并返回完整的 HTTPS OSS URL
   - 回退机制：如果 OSS 上传失败，仍会保存到本地作为备用

### 📁 新增工具

- **OSS 上传工具** (`backend/src/utils/ossUpload.js`)
  - `uploadToOSS(buffer, fileName, contentType)` - 直接上传 Buffer 到 OSS
  - `downloadAndUploadToOSS(url, fileName, contentType)` - 从 URL 下载并上传到 OSS

## 环境变量要求

确保以下环境变量已正确配置：

```bash
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_REGION=your_region
OSS_ENDPOINT=your_endpoint
OSS_BASE_PATH=uploads  # 可选，默认为 'uploads'
```

## 部署步骤

1. **更新代码**
   ```bash
   cd /var/www/ai-host/backend
   git pull origin main
   ```

2. **安装依赖**（如果需要）
   ```bash
   npm install ali-oss
   ```

3. **重启服务**
   ```bash
   pm2 restart ai-host-backend
   ```

4. **验证**
   - 生成一张图片，检查返回的 URL 是否为 OSS URL（以 `https://` 开头）
   - 检查图片是否能正常显示

## 注意事项

### 旧文件兼容性

- 旧的本地文件（`/uploads/xxx`）仍然可以通过 Nginx 静态文件服务访问
- 新生成的文件都会上传到 OSS
- 前端已配置 `normalizeImageUrl` 来处理新旧 URL 的兼容

### 回退机制

所有服务都实现了回退机制：
- 如果 OSS 上传失败，会自动保存到本地
- 返回本地路径 `/uploads/xxx`
- 前端会通过 `normalizeImageUrl` 处理这些路径

### 需要手动迁移的服务

以下服务可能仍在使用本地存储，但它们是辅助功能，不影响核心功能：

- `candyScraper.js` - 爬虫服务，用于抓取头像
- `voiceTemplateScraper.js` - 语音模板爬虫服务

如果需要，这些服务也可以迁移到 OSS，但优先级较低。

## 验证清单

- [x] 图片生成返回 OSS URL
- [x] 视频生成返回 OSS URL
- [x] 音频生成返回 OSS URL
- [x] 前端能正确显示 OSS URL
- [x] OSS 上传失败时有回退机制
- [x] 旧文件仍可通过本地路径访问

## 故障排查

### 问题：生成的图片显示为裂图

**可能原因：**
1. OSS 配置不正确
2. OSS bucket 未设置为公共读
3. OSS CORS 配置不正确

**解决方案：**
1. 检查环境变量是否正确
2. 在 OSS 控制台设置 bucket 为公共读
3. 配置 OSS CORS 规则（参考 `deploy/OSS_CORS_SETUP.md`）

### 问题：OSS 上传失败

**检查日志：**
```bash
pm2 logs ai-host-backend --lines 50 | grep "OSS"
```

**常见错误：**
- `AccessDenied` - 检查 AccessKey 权限
- `InvalidBucketName` - 检查 bucket 名称
- `SignatureDoesNotMatch` - 检查 AccessKey Secret

### 问题：回退到本地存储

如果看到日志中有 "OSS upload failed, falling back to local storage"，说明：
1. OSS 上传失败，但服务仍能正常工作
2. 文件保存在本地，可以通过 `/uploads/` 访问
3. 需要检查 OSS 配置并修复问题

