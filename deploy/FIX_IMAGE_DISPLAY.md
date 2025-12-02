# 修复上传后图片/视频不显示的问题

## 问题描述

上传成功后，首帧预览图和头像没有显示。

## 可能的原因

### 1. OSS Bucket 访问权限问题（最常见）

如果 OSS bucket 设置为"私有"，上传的文件无法直接通过 URL 访问。

**解决方案：**

1. 登录阿里云 OSS 控制台
2. 选择 bucket：`ai-host`
3. 进入 **权限管理** -> **读写权限**
4. 将 **读写权限** 设置为 **公共读**（或 **公共读写**）
5. 保存并等待 1-2 分钟生效

**注意：** 如果必须保持私有，需要使用签名 URL，这需要修改后端代码。

### 2. URL 格式问题

检查浏览器控制台的日志，查看：
- `[OSS Upload] Upload result:` - 上传后的 URL
- `[OSS Upload] Normalized to HTTPS:` - 规范化后的 URL
- `[EditAgent] Avatar image loaded successfully:` - 图片加载成功
- `[EditAgent] Failed to load avatar image:` - 图片加载失败

### 3. CORS 问题（已解决）

如果之前有 CORS 错误，应该已经通过配置 CORS 解决了。

## 诊断步骤

### 步骤 1: 检查浏览器控制台

打开浏览器开发者工具（F12），查看 Console 标签：

1. **上传时应该看到：**
   ```
   [Video Upload] Step 1: Uploading video file...
   [OSS Upload] Upload result: { url: '...', ... }
   [Video Upload] Video uploaded, URL: https://...
   [Video Upload] Step 2: Extracting frame from video...
   [Video Upload] Frame extracted, blob size: ...
   [Video Upload] Step 3: Uploading extracted frame...
   [OSS Upload] Upload result: { url: '...', ... }
   [OSS Upload] Normalized to HTTPS: https://...
   [Video Upload] Frame uploaded, URL: https://...
   [Video Upload] Updating form data: { avatarUrl: '...', coverVideoUrl: '...' }
   ```

2. **图片加载时应该看到：**
   ```
   [EditAgent] Avatar image loaded successfully: https://...
   ```

3. **如果失败，会看到：**
   ```
   [EditAgent] Failed to load avatar image: https://...
   ```

### 步骤 2: 测试 OSS URL 可访问性

在浏览器中直接访问上传后的 URL（从控制台日志中复制），例如：
```
https://ai-host.oss-ap-southeast-1.aliyuncs.com/uploads/1234567890-abc123.jpg
```

**如果返回 403 Forbidden：**
- Bucket 权限是私有，需要改为公共读

**如果返回 404 Not Found：**
- 文件没有上传成功，检查上传日志

**如果正常显示图片：**
- URL 是正确的，问题可能在页面渲染

### 步骤 3: 检查 OSS Bucket 配置

在服务器上运行：

```bash
# 检查 bucket 配置（需要阿里云 CLI）
aliyun oss get-bucket-acl --bucket ai-host

# 或者通过控制台检查：
# OSS 控制台 -> ai-host -> 权限管理 -> 读写权限
```

### 步骤 4: 清除浏览器缓存

1. 按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）强制刷新
2. 或者在开发者工具中右键刷新按钮，选择"清空缓存并硬性重新加载"

## 快速修复

### 方法 1: 设置 Bucket 为公共读（推荐）

1. OSS 控制台 -> `ai-host` bucket
2. 权限管理 -> 读写权限
3. 选择 **公共读**
4. 保存

### 方法 2: 检查 URL 格式

确保 URL 格式为：
```
https://ai-host.oss-ap-southeast-1.aliyuncs.com/uploads/xxx.jpg
```

而不是：
```
http://ai-host.oss-ap-southeast-1.aliyuncs.com/uploads/xxx.jpg  (HTTP，可能被阻止)
/uploads/xxx.jpg  (相对路径，无法访问)
```

## 代码已修复的问题

1. ✅ **URL 规范化：** 自动将 HTTP 转换为 HTTPS
2. ✅ **URL 构建：** 如果 OSS 返回的 URL 不完整，自动构建完整 URL
3. ✅ **日志记录：** 添加详细的日志，方便排查问题
4. ✅ **错误处理：** 改进错误处理，显示占位符而不是空白

## 如果仍然无法显示

请提供以下信息：

1. **浏览器控制台完整日志**（上传和加载时的所有日志）
2. **直接访问 URL 的结果**（是否返回 403/404）
3. **OSS bucket 的读写权限设置**（公共读/私有）
4. **上传后的完整 URL**（从控制台日志中复制）

