# 🎨 Spatial Avatar（空间头像）iOS 实现指南

## 概述

Spatial Avatar 是一个让静态 2D 头像图片"活"起来的功能。通过 AI 生成的深度图、法线图等辅助纹理，配合 Metal 着色器实现：

- **视差效果**：头像随设备陀螺仪/触摸产生微妙的 3D 位移
- **动态光照**：基于法线贴图的实时光照变化
- **微表情动画**：自主眨眼、呼吸感微动
- **FX 叠加层**：柔和的光晕/bokeh 效果
- **背景分离**：主体与背景完全分离，可自定义背景色

**效果类似**：Apple 的 Portrait Mode 动态深度效果 + 微妙的"活人感"

---

## 🔌 API 接口

### 1. 获取 Agent 信息（含空间头像资产）

```http
GET /api/agents
GET /api/agents/:id
```

**Response 中的关键字段**：
```json
{
  "_id": "693cee1f8ec1d7080a5a75c9",
  "name": "Ashley",
  "avatarUrl": "https://.../avatar.jpg",
  "avatarSpatialMetaUrl": "https://.../meta.json",  // ⬅️ 空间头像资产包入口
  "avatarSpatialShader": {                           // ⬅️ 服务器覆盖参数（可选）
    "fxStrength": 0.75,
    "bgColor": "#F2F2F2"
  }
}
```

### 2. meta.json 结构

从 `avatarSpatialMetaUrl` 下载，获取所有渲染所需资产：

```json
{
  "version": 1,
  "agentId": "693cee1f8ec1d7080a5a75c9",
  "createdAt": "2025-12-13T04:46:31.053Z",
  
  // 🖼️ 纹理资产 URLs（全部为 PNG，可预加载/缓存）
  "baseUrl": "https://.../base.png",      // 原图（已处理）
  "depthUrl": "https://.../depth.png",    // 深度图（灰度，白=近，黑=远）
  "normalUrl": "https://.../normal.png",  // 法线图（RGB 编码表面方向）
  "cutoutUrl": "https://.../cutout.png",  // 抠图蒙版（白=主体，黑=背景）
  "fxTextureUrl": "https://.../fx.png",   // FX 叠加纹理（光晕/bokeh）
  
  // ⚙️ 默认着色器参数
  "shader": {
    "parallaxStrength": 0.018,  // 视差位移强度
    "normalStrength": 1.0,      // 法线光照强度
    "rimStrength": 0.35,        // 边缘光强度
    "glareStrength": 0.6,       // 高光强度
    "fxStrength": 0.38,         // FX 叠加层透明度
    "fxSpeed": 1.0,             // FX 动画速度
    "fxScale": 1.35,            // FX 纹理缩放
    "exposure": 1.0             // 曝光调整
  }
}
```

### 3. 参数优先级

iOS 客户端应按以下优先级合并参数：

```
Agent.avatarSpatialShader  >  meta.shader  >  客户端默认值
         (服务器覆盖)           (资产包默认)      (兜底)
```

---

## 🎮 Metal 实现参考

### 核心渲染思路

```
┌─────────────────────────────────────────────────┐
│                  Metal Pipeline                  │
├─────────────────────────────────────────────────┤
│  Inputs:                                         │
│    - baseTexture (原图)                          │
│    - depthTexture (深度)                         │
│    - normalTexture (法线)                        │
│    - cutoutTexture (蒙版)                        │
│    - fxTexture (FX 叠加)                         │
│    - gyroOffset (陀螺仪 x,y)                     │
│    - time (动画时间)                             │
│    - shaderParams (所有参数)                     │
├─────────────────────────────────────────────────┤
│  Fragment Shader Logic:                          │
│    1. 采样深度图 → 计算视差 UV 偏移              │
│    2. 采样法线图 → 计算光照                      │
│    3. 采样原图（偏移后 UV）                      │
│    4. 应用边缘光 (rim lighting)                  │
│    5. 叠加 FX 纹理（动态 UV + 透明度）           │
│    6. 用 cutout 分离背景，填充 bgColor           │
│    7. 添加自主动画（呼吸、眨眼）                 │
└─────────────────────────────────────────────────┘
```

### Swift 伪代码结构

```swift
import MetalKit
import CoreMotion

class SpatialAvatarView: MTKView {
    
    // 纹理资产
    var baseTexture: MTLTexture?
    var depthTexture: MTLTexture?
    var normalTexture: MTLTexture?
    var cutoutTexture: MTLTexture?
    var fxTexture: MTLTexture?
    
    // 动画状态
    var time: Float = 0
    var gyroOffset: SIMD2<Float> = .zero
    
    // 着色器参数（从 meta.json + server override 合并）
    struct ShaderParams {
        var parallaxStrength: Float = 0.018
        var normalStrength: Float = 1.0
        var rimStrength: Float = 0.35
        var glareStrength: Float = 0.6
        var fxStrength: Float = 0.38
        var fxSpeed: Float = 1.0
        var fxScale: Float = 1.35
        var exposure: Float = 1.0
        var bgColor: SIMD3<Float> = SIMD3(0.95, 0.95, 0.95)
        var focusX: Float = 0.5  // 眨眼区域中心 X
        var focusY: Float = 0.3  // 眨眼区域中心 Y
        var blinkStrength: Float = 0.8
    }
    var params = ShaderParams()
    
    // 陀螺仪
    let motionManager = CMMotionManager()
    
    func loadAssets(from metaUrl: URL) async throws {
        let meta = try await fetchJSON(metaUrl)
        
        // 并行加载所有纹理
        async let base = loadTexture(URL(string: meta.baseUrl)!)
        async let depth = loadTexture(URL(string: meta.depthUrl)!)
        async let normal = loadTexture(URL(string: meta.normalUrl)!)
        async let cutout = loadTexture(URL(string: meta.cutoutUrl)!)
        async let fx = loadTexture(URL(string: meta.fxTextureUrl)!)
        
        (baseTexture, depthTexture, normalTexture, cutoutTexture, fxTexture) = 
            try await (base, depth, normal, cutout, fx)
        
        // 合并 shader 参数
        mergeShaderParams(meta.shader)
    }
    
    func startGyro() {
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let motion = motion else { return }
            // 将设备姿态转换为 -1...1 范围的偏移
            self?.gyroOffset = SIMD2(
                Float(motion.attitude.roll) * 0.1,
                Float(motion.attitude.pitch) * 0.1
            )
        }
    }
}
```

### Metal Shader 核心片段（伪代码）

```metal
fragment float4 spatialAvatarFragment(
    VertexOut in [[stage_in]],
    texture2d<float> baseTexture [[texture(0)]],
    texture2d<float> depthTexture [[texture(1)]],
    texture2d<float> normalTexture [[texture(2)]],
    texture2d<float> cutoutTexture [[texture(3)]],
    texture2d<float> fxTexture [[texture(4)]],
    constant ShaderParams& params [[buffer(0)]],
    constant float& time [[buffer(1)]],
    constant float2& gyroOffset [[buffer(2)]]
) {
    float2 uv = in.texCoord;
    
    // 1. 深度采样 → 视差偏移
    float depth = depthTexture.sample(sampler, uv).r;
    float2 parallaxOffset = gyroOffset * depth * params.parallaxStrength;
    float2 parallaxUV = uv + parallaxOffset;
    
    // 2. 添加呼吸感微动
    float breathe = sin(time * 1.5) * 0.002;
    parallaxUV.y += breathe * depth;
    
    // 3. 采样原图
    float4 baseColor = baseTexture.sample(sampler, parallaxUV);
    
    // 4. 法线光照
    float3 normal = normalTexture.sample(sampler, parallaxUV).rgb * 2.0 - 1.0;
    float3 lightDir = normalize(float3(gyroOffset.x, gyroOffset.y, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0) * params.normalStrength;
    
    // 5. 边缘光
    float rim = pow(1.0 - abs(dot(normal, float3(0, 0, 1))), 2.0) * params.rimStrength;
    
    // 6. 应用光照
    baseColor.rgb *= (0.7 + diffuse * 0.3);
    baseColor.rgb += rim * float3(1.0, 0.95, 0.9);
    
    // 7. FX 叠加层（动态 UV）
    float2 fxUV = uv * params.fxScale + float2(time * params.fxSpeed * 0.1, 0);
    float4 fxColor = fxTexture.sample(sampler, fxUV);
    baseColor.rgb = mix(baseColor.rgb, fxColor.rgb, fxColor.a * params.fxStrength);
    
    // 8. 眨眼效果（在眼睛区域周期性变暗）
    float2 eyeCenter = float2(params.focusX, params.focusY);
    float eyeDist = distance(uv, eyeCenter);
    float blinkMask = smoothstep(0.15, 0.05, eyeDist);
    float blink = step(0.95, sin(time * 0.3)) * blinkMask * params.blinkStrength;
    baseColor.rgb *= (1.0 - blink * 0.3);
    
    // 9. 背景分离
    float mask = cutoutTexture.sample(sampler, uv).r;
    float3 bgColor = params.bgColor;
    baseColor.rgb = mix(bgColor, baseColor.rgb, mask);
    
    // 10. 曝光
    baseColor.rgb *= params.exposure;
    
    return baseColor;
}
```

---

## 📱 UI 集成建议

### 在 Chat 页面展示

```swift
struct ChatView: View {
    let agent: Agent
    @State private var spatialView: SpatialAvatarView?
    
    var body: some View {
        VStack {
            // 空间头像区域
            if let metaUrl = agent.avatarSpatialMetaUrl {
                SpatialAvatarSwiftUIWrapper(metaUrl: metaUrl, shader: agent.avatarSpatialShader)
                    .frame(height: 300)
            } else {
                // 降级到普通头像
                AsyncImage(url: agent.avatarUrl)
            }
            
            // 聊天消息列表
            MessageListView(agentId: agent.id)
        }
    }
}
```

### 性能优化建议

1. **纹理缓存**：使用 `URLCache` 或自定义缓存机制缓存下载的纹理
2. **预加载**：在 Agent 列表页预加载即将展示的空间头像资产
3. **降级策略**：设备性能低或电量低时降级到静态头像
4. **帧率控制**：正常 30fps，省电模式 15fps

```swift
// 电量监控降级
NotificationCenter.default.addObserver(forName: .NSProcessInfoPowerStateDidChange) { _ in
    if ProcessInfo.processInfo.isLowPowerModeEnabled {
        spatialAvatarView.preferredFramesPerSecond = 15
    }
}
```

---

## 🔧 调试工具

服务器提供了一个 Web 版的 Avatar Lab 用于调试参数：

```
https://cling-ai.com/avatar-lab?agentId=<agent_id>
```

可以在这里实时调整所有 shader 参数，然后保存到服务器（会更新 `avatarSpatialShader`）。

---

## 📋 Checklist

- [ ] 解析 Agent API 获取 `avatarSpatialMetaUrl`
- [ ] 下载并解析 meta.json
- [ ] 并行加载 5 张纹理（base/depth/normal/cutout/fx）
- [ ] 创建 Metal pipeline 和 shader
- [ ] 接入陀螺仪获取设备姿态
- [ ] 实现视差效果
- [ ] 实现法线光照
- [ ] 实现 FX 叠加层动画
- [ ] 实现自主微动（呼吸、眨眼）
- [ ] 实现背景分离 + 自定义背景色
- [ ] 添加纹理缓存
- [ ] 添加降级策略

---

## 💡 快速验证

用 cURL 获取一个有空间头像的 Agent 测试：

```bash
# 获取 agents 列表
curl https://cling-ai.com/api/agents | jq '.data[] | select(.avatarSpatialMetaUrl != null) | {name, avatarSpatialMetaUrl, avatarSpatialShader}'

# 下载 meta.json
curl "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/uploads/2025-12-13/1765601191054-a274b716.json" | jq .
```

---

## 问题反馈

如有问题，可以：
1. 检查 `/api/health` 确认服务正常
2. 检查 meta.json 中的 URL 是否可访问
3. 联系后端确认 Agent 是否已生成空间资产
