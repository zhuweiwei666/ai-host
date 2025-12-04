# OSS CORS 手动配置指南（必须完成！）

## 🔴 当前问题

前端上传文件到 OSS 时遇到 CORS 错误：
```
Access to XMLHttpRequest at 'https://ai-host-uploads.oss-cn-hangzhou.aliyuncs.com/...' 
from origin 'https://cling-ai.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## ✅ 解决方案：在阿里云控制台配置 CORS

### 步骤 1: 登录阿里云 OSS 控制台

1. 访问：https://oss.console.aliyun.com/
2. 选择 bucket：**`ai-host-uploads`**
3. 点击左侧菜单：**权限管理** -> **跨域设置（CORS）**

### 步骤 2: 创建 CORS 规则

点击 **创建规则** 或 **设置**，填写以下配置：

#### 📝 来源（AllowedOrigins）
```
https://cling-ai.com
http://localhost:5173
http://localhost:3000
```
**注意：** 每行一个，或者使用通配符 `*`（不推荐，安全性较低）

#### 📝 允许 Methods（控制台只显示真实请求动词）
- ✅ **GET**
- ✅ **PUT**（最重要！用于上传）
- ✅ **POST**
- ✅ **HEAD**
- ✅ **DELETE**
- ℹ️ **说明**：OSS 会自动响应 OPTIONS 预检，不需要单独勾选

#### 📝 允许 Headers
```
*
```
或者具体指定：
```
Authorization
Content-Type
Content-Length
x-oss-*
```

#### 📝 暴露 Headers
```
ETag
x-oss-request-id
x-oss-next-append-position
```

#### 📝 缓存时间（秒）
```
3600
```

### 步骤 3: 保存并等待生效

1. 点击 **确定** 保存规则
2. **等待 1-2 分钟** 让配置生效
3. 刷新前端页面，重新测试上传

## 🔍 验证 CORS 配置

### 方法 1: 使用浏览器控制台

打开浏览器控制台（F12），运行：

```javascript
fetch('https://ai-host-uploads.oss-cn-hangzhou.aliyuncs.com/', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://cling-ai.com',
    'Access-Control-Request-Method': 'PUT'
  }
}).then(r => {
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': r.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': r.headers.get('Access-Control-Allow-Methods')
  });
});
```

应该返回：
- `Access-Control-Allow-Origin: https://cling-ai.com`
- `Access-Control-Allow-Methods: GET,PUT,POST,HEAD,DELETE`

### 方法 2: 使用 curl

```bash
curl -X OPTIONS \
  -H "Origin: https://cling-ai.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v \
  https://ai-host-uploads.oss-cn-hangzhou.aliyuncs.com/
```

应该返回包含 `Access-Control-Allow-Origin: https://cling-ai.com` 的响应。

## 📋 其他需要检查的配置

### 1. Bucket 读写权限

1. 进入 **权限管理** -> **读写权限**
2. 建议设置为 **公共读**（如果文件需要公开访问）
   - 或者设置为 **私有**，但需要确保使用签名 URL 访问

### 2. AccessKey 权限

确保使用的 AccessKey 具有以下权限：
- `oss:PutObject` - 上传文件
- `oss:GetObject` - 读取文件
- `oss:DeleteObject` - 删除文件（如果需要）

## ⚠️ 常见问题

### Q: 配置后仍然报 CORS 错误？
A: 
1. 确认配置已保存（刷新控制台页面查看）
2. 等待 1-2 分钟让配置生效
3. 清除浏览器缓存并刷新页面
4. 检查 Origin 是否完全匹配（包括协议 http/https）

### Q: 可以配置多个来源吗？
A: 可以，每行一个，或者使用通配符 `*`（不推荐）

### Q: 为什么控制台里没有 OPTIONS？
A: OSS 预检接口天然支持 OPTIONS，请求会根据已配置的 GET/PUT/POST/DELETE/HEAD 自动返回 `Access-Control-Allow-Methods`，不需要也无法单独勾选 OPTIONS。

## 📞 如果仍然无法解决

请提供以下信息：
1. 浏览器控制台的完整错误信息（截图）
2. OSS 控制台 CORS 配置截图
3. Bucket 读写权限设置

