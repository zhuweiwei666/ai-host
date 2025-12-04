# OSS 上传签名错误 Bug 报告

## 📋 问题概述

**错误类型**: `SignatureDoesNotMatchError`  
**HTTP 状态码**: `403 Forbidden`  
**影响范围**: 所有前端直接上传到 OSS 的文件（图片、视频等）  
**严重程度**: 🔴 **严重** - 阻塞核心功能  
**复现频率**: 100% - 每次上传都失败

## 🔍 错误详情

### 错误信息
```
SignatureDoesNotMatchError: The request signature we calculated does not match the signature you provided. Check your key and signing method.
```

### 错误日志
```
[STS] Received credentials {
  bucket: 'ai-host',
  region: 'oss-ap-southeast-1',
  expiresAt: '2025-12-03T16:23:53.867Z',
  isRootAccount: true
}
[OSS Upload] Uploading file (1.49MB)
PUT https://ai-host.oss-ap-southeast-1.aliyuncs.com/uploads/1764775433859-2x21n36l3.mp4 403 (Forbidden)
```

## 🔬 根本原因分析

### 1. **ali-oss SDK 浏览器版本与 Node.js 版本的配置差异**

**问题**：
- 后端（Node.js）使用 `ali-oss@6.23.0`，配置 `region: 'oss-ap-southeast-1'` 正常工作
- 前端（浏览器）使用相同的 SDK 版本，但配置相同参数时签名计算失败

**可能原因**：
- ali-oss 浏览器版本可能对 `region` 和 `endpoint` 参数的处理逻辑与 Node.js 版本不同
- 浏览器版本可能需要**只提供 `endpoint`**，而不需要 `region`（或相反）
- 浏览器版本可能对 `region` 格式有特殊要求（需要去掉 `oss-` 前缀）

### 2. **配置不一致问题**

**当前配置**：
```typescript
// 前端配置
{
  region: 'oss-ap-southeast-1',  // 保留 oss- 前缀
  endpoint: 'oss-ap-southeast-1.aliyuncs.com',  // 纯域名
  bucket: 'ai-host',
  accessKeyId: '...',
  accessKeySecret: '...',
  secure: true
}
```

**问题**：
- 同时提供了 `region` 和 `endpoint`，可能导致 SDK 内部签名计算时使用了错误的 endpoint
- 根据 ali-oss 文档，浏览器环境可能只需要 `endpoint`，不需要 `region`

### 3. **Root Account 直接使用 AccessKey 的问题**

**当前实现**：
- 使用 root account 的 AccessKey 直接暴露给前端
- 没有使用 STS token（`securityToken: ''`）

**潜在问题**：
- Root account 的 AccessKey 在某些配置下可能无法正确计算签名
- 浏览器环境下的签名算法可能与服务器端不同

### 4. **时间同步问题**

**可能原因**：
- 客户端（浏览器）和服务器时间不同步
- OSS 签名包含时间戳，时间偏差可能导致签名验证失败

## 📊 已尝试的修复方案

### 尝试 1: 修复 securityToken 检查
- **修改**: 允许 root account 使用空的 securityToken
- **结果**: ❌ 失败 - 仍然出现签名错误

### 尝试 2: 修复 region 格式
- **修改**: 保留 `oss-` 前缀（与后端保持一致）
- **结果**: ❌ 失败 - 仍然出现签名错误

### 尝试 3: 修复 endpoint 格式
- **修改**: 清理协议前缀，使用纯域名
- **结果**: ❌ 失败 - 仍然出现签名错误

### 尝试 4: 移除 region 参数
- **修改**: 浏览器环境只使用 endpoint，不提供 region
- **结果**: ❌ 失败 - 仍然出现签名错误（`hasRegion: false` 但签名仍然失败）

### 尝试 5: 使用去掉 `oss-` 前缀的 region（当前）
- **修改**: 浏览器环境使用 `ap-southeast-1` 而不是 `oss-ap-southeast-1`
- **状态**: ⏳ 待测试

## 🎯 建议的解决方案

### 方案 1: 只使用 endpoint，移除 region（推荐）

根据 ali-oss 浏览器版本的文档，**浏览器环境可能只需要 `endpoint`，不需要 `region`**。

**修改位置**: `frontend/src/utils/ossUpload.ts`

```typescript
const clientConfig: any = {
  // 移除 region，只使用 endpoint
  // region: region,  // ❌ 删除这行
  accessKeyId: sts.accessKeyId,
  accessKeySecret: sts.accessKeySecret,
  bucket: sts.bucket,
  endpoint: cleanEndpoint,  // ✅ 只使用 endpoint
  secure: true,
  timeout: 300000,
};
```

### 方案 2: 使用去掉 `oss-` 前缀的 region

虽然后端使用带前缀的 region，但浏览器版本可能需要去掉前缀。

**修改位置**: `frontend/src/utils/ossUpload.ts`

```typescript
// 浏览器版本需要去掉 oss- 前缀
const cleanRegion = sts.region.replace(/^oss-/, '');
const clientConfig: any = {
  region: cleanRegion,  // 使用 ap-southeast-1 而不是 oss-ap-southeast-1
  accessKeyId: sts.accessKeyId,
  accessKeySecret: sts.accessKeySecret,
  bucket: sts.bucket,
  endpoint: cleanEndpoint,
  secure: true,
  timeout: 300000,
};
```

### 方案 3: 使用 STS Token（最安全，但需要配置 RAM Role）

**优点**：
- 更安全，不直接暴露 AccessKey
- 临时凭证，自动过期
- 符合阿里云最佳实践

**缺点**：
- 需要配置 RAM Role 和 AssumeRole 权限
- 需要修改后端配置

**实施步骤**：
1. 在阿里云控制台创建 RAM Role
2. 配置 AssumeRole 权限
3. 设置 `OSS_ROLE_ARN` 环境变量
4. 后端会自动使用 STS，返回有效的 `securityToken`

### 方案 4: 检查并修复 AccessKey

**验证步骤**：
1. 确认 `OSS_ACCESS_KEY_ID` 和 `OSS_ACCESS_KEY_SECRET` 是否正确
2. 确认 AccessKey 是否有 OSS PutObject 权限
3. 确认 AccessKey 是否已启用
4. 尝试创建新的 AccessKey 并更新配置

### 方案 5: 检查时间同步

**验证步骤**：
```bash
# 检查服务器时间
date -u

# 检查浏览器时间（在控制台运行）
new Date().toISOString()

# 如果时间偏差 > 15 分钟，需要同步时间
```

## 🔧 调试建议

### 1. 添加详细日志

在 `frontend/src/utils/ossUpload.ts` 中添加：

```typescript
console.log('[OSS Config] Full client config:', {
  region: region,
  endpoint: cleanEndpoint,
  bucket: sts.bucket,
  accessKeyId: sts.accessKeyId.substring(0, 10) + '...',
  hasSecurityToken: !!clientConfig.stsToken,
  isRootAccount,
});
```

### 2. 测试不同的配置组合

创建测试脚本，尝试以下配置组合：

| 配置 | region | endpoint | 预期结果 |
|------|--------|----------|----------|
| 1 | `oss-ap-southeast-1` | `oss-ap-southeast-1.aliyuncs.com` | ❌ 当前失败 |
| 2 | `ap-southeast-1` | `oss-ap-southeast-1.aliyuncs.com` | ⚠️ 待测试 |
| 3 | 无 | `oss-ap-southeast-1.aliyuncs.com` | ⚠️ 待测试 |
| 4 | `oss-ap-southeast-1` | 无 | ⚠️ 待测试 |

### 3. 使用 ali-oss 官方示例验证

参考 ali-oss 官方文档的浏览器示例代码，对比配置差异。

## 📝 环境信息

- **前端 SDK**: `ali-oss@6.23.0`
- **后端 SDK**: `ali-oss@6.23.0`
- **OSS Region**: `oss-ap-southeast-1`
- **OSS Endpoint**: `oss-ap-southeast-1.aliyuncs.com`
- **OSS Bucket**: `ai-host`
- **认证方式**: Root Account AccessKey（无 STS Token）
- **浏览器**: Chrome（需要确认版本）

## 🚨 优先级建议

1. **立即尝试**: 方案 1（移除 region，只使用 endpoint）
2. **如果失败**: 方案 2（去掉 region 的 `oss-` 前缀）
3. **长期方案**: 方案 3（配置 STS Token，使用 RAM Role）

## 📚 参考文档

- [ali-oss 官方文档](https://github.com/ali-sdk/ali-oss)
- [阿里云 OSS 签名错误解决方案](https://help.aliyun.com/document_detail/32077.html)
- [OSS 浏览器端直传最佳实践](https://help.aliyun.com/document_detail/31926.html)

---

**报告生成时间**: 2025-12-03  
**报告人**: AI Assistant  
**状态**: 🔴 待修复

