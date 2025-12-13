# 🎮 iOS 动态角色实现指南（完整版）

## 服务端已经为你准备好的一切

我们的 AI 服务端已经为每个主播生成了完整的渲染资产包，你只需要：
1. 下载这些资产
2. 用 Metal Shader 渲染
3. 加上动画逻辑

---

## 📦 第一步：获取资产

### 1.1 调用 Agent 接口

```http
GET https://cling-ai.com/api/agents
GET https://cling-ai.com/api/agents/:id
```

**返回的 Agent 对象包含：**

```json
{
  "_id": "693cee1f8ec1d7080a5a75c9",
  "name": "Ashley",
  
  // 普通头像（降级用）
  "avatarUrl": "https://.../avatar.jpg",
  
  // ⭐ 关键字段 1：资产包入口
  "avatarSpatialMetaUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/uploads/2025-12-13/1765601191054-a274b716.json",
  
  // ⭐ 关键字段 2：服务器覆盖的 shader 参数
  "avatarSpatialShader": {
    "fxStrength": 0.75,
    "fxSpeed": 1,
    "fxScale": 1.35
  }
}
```

### 1.2 下载 meta.json

用普通 HTTP GET 请求 `avatarSpatialMetaUrl`：

```swift
let metaUrl = agent.avatarSpatialMetaUrl
let metaData = try await URLSession.shared.data(from: metaUrl)
let meta = try JSONDecoder().decode(SpatialMeta.self, from: metaData)
```

**meta.json 的完整内容（真实示例）：**

```json
{
  "version": 1,
  "agentId": "693cee1f8ec1d7080a5a75c9",
  "createdAt": "2025-12-13T04:46:31.053Z",
  
  // ========================================
  // 🖼️ 5 张纹理图片（全部是 PNG，可以缓存）
  // ========================================
  
  "baseUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/.../base.png",
  // ↑ 原图（高清，已处理过色彩）
  
  "depthUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/.../depth.png",
  // ↑ 深度图（灰度图，白色=近/前景，黑色=远/背景）
  //   用途：视差效果、呼吸动画幅度控制、边缘检测
  
  "normalUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/.../normal.png",
  // ↑ 法线图（RGB 编码表面方向，R=X, G=Y, B=Z）
  //   用途：动态光照、边缘光、高光计算
  
  "cutoutUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/.../cutout.png",
  // ↑ 抠图蒙版（白色=人物主体，黑色=背景）
  //   用途：分离背景、只在背景显示粒子
  
  "fxTextureUrl": "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/.../fx.png",
  // ↑ FX 叠加纹理（光晕/bokeh/粒子贴图）
  //   用途：背景粒子效果、光斑动画
  
  // ========================================
  // ⚙️ 默认 Shader 参数
  // ========================================
  "shader": {
    "parallaxStrength": 0.018,  // 视差强度
    "normalStrength": 1.0,      // 法线光照强度
    "rimStrength": 0.35,        // 边缘光强度
    "glareStrength": 0.6,       // 高光强度
    "fxStrength": 0.38,         // FX 叠加透明度
    "fxSpeed": 1.0,             // FX 动画速度
    "fxScale": 1.35,            // FX 纹理缩放
    "exposure": 1.0             // 曝光调整
  }
}
```

### 1.3 参数合并优先级

```swift
// 最终参数 = 服务器覆盖 > meta默认 > 客户端兜底
let finalParams = clientDefaults
    .merging(meta.shader)
    .merging(agent.avatarSpatialShader)
```

---

## 🎨 第二步：理解每张纹理的作用

### 纹理 1：baseUrl（原图）

```
┌─────────────────────────────┐
│                             │
│      [人物完整高清图]        │
│                             │
│      这是最终显示的图        │
│      其他纹理用来控制        │
│      如何"动态"渲染它        │
│                             │
└─────────────────────────────┘
```

**用法**：作为主纹理，所有效果都基于这张图。

---

### 纹理 2：depthUrl（深度图）⭐ 最重要

```
┌─────────────────────────────┐
│  ██████████████████████████ │  ← 白色 = 最近（鼻子、胸部）
│  ██████░░░░░░░░░░██████████ │
│  ████░░░░░░░░░░░░░░████████ │
│  ██░░░░░░░░░░░░░░░░░░██████ │  ← 灰色 = 中等距离（脸、身体）
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 黑色 = 最远（背景）
└─────────────────────────────┘
```

**用法**：

| 效果 | 如何使用深度图 |
|------|--------------|
| **视差** | 白色区域位移大，黑色区域不动 |
| **呼吸** | 用深度控制呼吸幅度（前景动得多） |
| **边缘检测** | 深度梯度大的地方 = 头发/衣服边缘 |
| **景深模糊** | 黑色区域可以加模糊（可选） |

```metal
float depth = depthTexture.sample(sampler, uv).r;  // 0-1，1=最近

// 视差：近的地方位移大
float2 parallaxOffset = gyroInput * depth * parallaxStrength;

// 呼吸：近的地方起伏大
float breatheAmount = sin(time * 1.5) * 0.01 * depth;

// 边缘检测：深度变化大的地方
float edge = abs(dfdx(depth)) + abs(dfdy(depth));
```

---

### 纹理 3：normalUrl（法线图）⭐ 第二重要

```
┌─────────────────────────────┐
│  法线图是 RGB 彩色图         │
│                             │
│  R 通道 = 表面 X 方向        │
│  G 通道 = 表面 Y 方向        │
│  B 通道 = 表面 Z 方向        │
│                             │
│  蓝紫色 = 朝向镜头            │
│  偏红/绿 = 朝向侧面           │
└─────────────────────────────┘
```

**用法**：

| 效果 | 如何使用法线图 |
|------|--------------|
| **动态光照** | 根据法线和光源方向计算明暗 |
| **边缘光** | 法线朝向侧面的区域加亮（rim light） |
| **高光** | 法线反射光源的区域加高光 |

```metal
// 解码法线（从 0-1 转换到 -1 到 1）
float3 normal = normalTexture.sample(sampler, uv).rgb * 2.0 - 1.0;

// 光源方向（可以随时间移动！）
float3 lightDir = normalize(float3(
    sin(time * 0.5) * 0.5,  // 光源左右移动
    0.5,
    1.0
));

// 漫反射光照
float diffuse = max(dot(normal, lightDir), 0.0);

// 边缘光（法线朝向侧面的区域）
float rim = pow(1.0 - max(dot(normal, float3(0,0,1)), 0.0), 2.0);
```

---

### 纹理 4：cutoutUrl（抠图蒙版）

```
┌─────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 黑色 = 背景
│  ░░░░░░██████████░░░░░░░░░░ │
│  ░░░░██████████████░░░░░░░░ │  ← 白色 = 人物主体
│  ░░██████████████████░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────┘
```

**用法**：

| 效果 | 如何使用抠图蒙版 |
|------|---------------|
| **背景分离** | 黑色区域填充自定义背景色 |
| **背景粒子** | 只在黑色区域显示粒子/光斑 |
| **背景模糊** | 只对黑色区域应用高斯模糊 |

```metal
float mask = cutoutTexture.sample(sampler, uv).r;  // 1=人物, 0=背景

// 背景填充纯色
float3 bgColor = float3(0.1, 0.1, 0.15);  // 深色背景
finalColor = mix(bgColor, baseColor.rgb, mask);

// 只在背景显示粒子
float3 particles = fxTexture.sample(sampler, fxUV).rgb;
finalColor += particles * (1.0 - mask) * 0.5;
```

---

### 纹理 5：fxTextureUrl（FX 叠加）

```
┌─────────────────────────────┐
│                             │
│     ✨  ·    ✦    ·         │
│        ·  ✨    ·   ✦       │
│    ✦      ·   ✨            │
│       ·  ✦       ·  ✨      │
│                             │
└─────────────────────────────┘
```

这是一张光斑/粒子/bokeh 贴图，用于叠加到背景上创造"动态皮肤"效果。

**用法**：

```metal
// 多层叠加，不同速度（创造深度感）
float2 fx1UV = uv * 1.2 + float2(time * 0.02, time * 0.01);   // 慢层
float2 fx2UV = uv * 0.8 + float2(-time * 0.03, time * 0.02);  // 快层
float2 fx3UV = uv * 1.5 + float2(time * 0.01, -time * 0.015); // 另一层

float3 fx1 = fxTexture.sample(sampler, fx1UV).rgb;
float3 fx2 = fxTexture.sample(sampler, fx2UV).rgb;
float3 fx3 = fxTexture.sample(sampler, fx3UV).rgb;

float3 fxCombined = fx1 * 0.4 + fx2 * 0.3 + fx3 * 0.3;

// 只在背景显示
float bgMask = 1.0 - cutoutTexture.sample(sampler, uv).r;
finalColor += fxCombined * bgMask * fxStrength;
```

---

## 🎬 第三步：实现 6 大动态效果

### 效果 1：呼吸（最容易，效果最明显）

```metal
// 呼吸周期：3-4 秒一个循环
float breathe = sin(time * 1.8) * 0.008;

// 用深度控制幅度（近的地方动得多）
float depth = depthTexture.sample(sampler, uv).r;

// Y 轴偏移（从底部锚点，所以上半身动得多）
float yOffset = breathe * depth * (1.0 - uv.y);
uv.y += yOffset;

// 轻微缩放（呼吸时胸腔膨胀）
float scale = 1.0 + sin(time * 1.8) * 0.003;
uv = (uv - float2(0.5, 1.0)) / scale + float2(0.5, 1.0);
```

---

### 效果 2：动态光照（用法线图）

```metal
float3 normal = normalTexture.sample(sampler, uv).rgb * 2.0 - 1.0;

// 光源缓慢移动（高级感的关键！）
float3 lightPos = float3(
    sin(time * 0.4) * 0.6,   // 左右移动
    cos(time * 0.3) * 0.3 + 0.5,  // 上下移动
    1.0
);

float3 lightDir = normalize(lightPos);
float diffuse = max(dot(normal, lightDir), 0.0);

// 应用光照
baseColor.rgb *= (0.6 + diffuse * 0.4);

// 边缘光（随时间脉动）
float rimPhase = sin(time * 0.6) * 0.3 + 0.7;
float rim = pow(1.0 - max(dot(normal, float3(0,0,1)), 0.0), 2.5);
baseColor.rgb += float3(1.0, 0.95, 0.9) * rim * rimStrength * rimPhase;
```

---

### 效果 3：背景粒子流动（王者荣耀同款）

```metal
float bgMask = 1.0 - cutoutTexture.sample(sampler, uv).r;

// 三层粒子，不同速度 = 深度感
float2 layer1UV = uv * 1.0 + float2(time * 0.015, time * 0.01);
float2 layer2UV = uv * 1.5 + float2(-time * 0.02, time * 0.025);
float2 layer3UV = uv * 0.7 + float2(time * 0.01, -time * 0.008);

float3 p1 = fxTexture.sample(sampler, layer1UV).rgb * 0.4;
float3 p2 = fxTexture.sample(sampler, layer2UV).rgb * 0.35;
float3 p3 = fxTexture.sample(sampler, layer3UV).rgb * 0.25;

float3 particles = p1 + p2 + p3;

// 只在背景显示
finalColor += particles * bgMask * fxStrength;
```

---

### 效果 4：眨眼

```metal
// 眨眼周期：每 4-6 秒一次
float blinkCycle = mod(time, 5.0);
float blink = smoothstep(0.0, 0.1, blinkCycle) * smoothstep(0.25, 0.15, blinkCycle);

// 眼睛区域（需要根据图片调整）
float2 eyeCenter = float2(0.5, 0.32);
float eyeRadius = 0.12;
float eyeDist = distance(uv, eyeCenter);
float eyeMask = smoothstep(eyeRadius, eyeRadius * 0.3, eyeDist);

// 眼睛区域 Y 轴压缩（闭眼效果）
float2 newUV = uv;
newUV.y = mix(uv.y, eyeCenter.y, eyeMask * blink * 0.6);
```

---

### 效果 5：头发/衣服飘动

```metal
// 用深度梯度检测边缘
float depth = depthTexture.sample(sampler, uv).r;
float edge = abs(dfdx(depth)) + abs(dfdy(depth));
float isHairOrCloth = smoothstep(0.01, 0.06, edge);

// 波浪形变
float wave = sin(time * 2.5 + uv.y * 15.0) * 0.004;
uv.x += wave * isHairOrCloth;

// 第二层波浪（更自然）
float wave2 = sin(time * 1.8 + uv.y * 10.0 + 1.5) * 0.002;
uv.x += wave2 * isHairOrCloth;
```

---

### 效果 6：视差（陀螺仪响应）

```metal
// 获取陀螺仪数据（归一化到 -1 到 1）
float2 gyro = float2(deviceRoll, devicePitch) * 0.1;

// 用深度控制视差强度
float depth = depthTexture.sample(sampler, uv).r;
float2 parallaxOffset = gyro * depth * parallaxStrength;

uv += parallaxOffset;
```

---

## 📐 第四步：完整 Shader 代码框架

```metal
fragment float4 dynamicAvatarFragment(
    VertexOut in [[stage_in]],
    texture2d<float> baseTexture [[texture(0)]],
    texture2d<float> depthTexture [[texture(1)]],
    texture2d<float> normalTexture [[texture(2)]],
    texture2d<float> cutoutTexture [[texture(3)]],
    texture2d<float> fxTexture [[texture(4)]],
    constant Params& params [[buffer(0)]],
    constant float& time [[buffer(1)]],
    constant float2& gyro [[buffer(2)]]
) {
    constexpr sampler s(filter::linear, address::repeat);
    float2 uv = in.texCoord;
    
    // === 采样深度 ===
    float depth = depthTexture.sample(s, uv).r;
    
    // === 效果 1: 呼吸 ===
    float breathe = sin(time * 1.8) * 0.008 * depth * (1.0 - uv.y);
    uv.y += breathe;
    
    // === 效果 5: 头发飘动 ===
    float edge = abs(dfdx(depth)) + abs(dfdy(depth));
    float hairMask = smoothstep(0.01, 0.06, edge);
    uv.x += sin(time * 2.5 + uv.y * 15.0) * 0.004 * hairMask;
    
    // === 效果 6: 视差 ===
    uv += gyro * depth * params.parallaxStrength;
    
    // === 效果 4: 眨眼 ===
    float blinkCycle = mod(time, 5.0);
    float blink = smoothstep(0.0, 0.1, blinkCycle) * smoothstep(0.25, 0.15, blinkCycle);
    float2 eyeCenter = float2(0.5, 0.32);
    float eyeMask = smoothstep(0.12, 0.03, distance(uv, eyeCenter));
    uv.y = mix(uv.y, eyeCenter.y, eyeMask * blink * 0.5);
    
    // === 采样原图 ===
    float4 baseColor = baseTexture.sample(s, uv);
    
    // === 效果 2: 动态光照 ===
    float3 normal = normalTexture.sample(s, uv).rgb * 2.0 - 1.0;
    float3 lightDir = normalize(float3(sin(time*0.4)*0.6, 0.5, 1.0));
    float diffuse = max(dot(normal, lightDir), 0.0);
    baseColor.rgb *= (0.6 + diffuse * 0.4);
    
    // 边缘光
    float rim = pow(1.0 - max(dot(normal, float3(0,0,1)), 0.0), 2.5);
    baseColor.rgb += float3(1.0, 0.95, 0.9) * rim * params.rimStrength;
    
    // === 效果 3: 背景粒子 ===
    float bgMask = 1.0 - cutoutTexture.sample(s, uv).r;
    float2 fx1UV = uv * 1.0 + float2(time * 0.015, time * 0.01);
    float2 fx2UV = uv * 1.5 + float2(-time * 0.02, time * 0.025);
    float3 particles = fxTexture.sample(s, fx1UV).rgb * 0.5 +
                       fxTexture.sample(s, fx2UV).rgb * 0.3;
    
    // === 合成 ===
    float mask = cutoutTexture.sample(s, uv).r;
    float3 bgColor = float3(0.08, 0.08, 0.12);
    float3 finalColor = mix(bgColor, baseColor.rgb, mask);
    finalColor += particles * bgMask * params.fxStrength;
    
    // === 曝光 ===
    finalColor *= params.exposure;
    
    return float4(finalColor, 1.0);
}
```

---

## 📱 第五步：Swift 集成

```swift
class DynamicAvatarView: MTKView, MTKViewDelegate {
    
    // 纹理
    var baseTexture: MTLTexture?
    var depthTexture: MTLTexture?
    var normalTexture: MTLTexture?
    var cutoutTexture: MTLTexture?
    var fxTexture: MTLTexture?
    
    // 参数
    var params: ShaderParams = .default
    var time: Float = 0
    var gyro: SIMD2<Float> = .zero
    
    // 加载资产
    func load(agent: Agent) async throws {
        guard let metaUrlString = agent.avatarSpatialMetaUrl,
              let metaUrl = URL(string: metaUrlString) else {
            throw AvatarError.noSpatialAssets
        }
        
        // 1. 下载 meta.json
        let (metaData, _) = try await URLSession.shared.data(from: metaUrl)
        let meta = try JSONDecoder().decode(SpatialMeta.self, from: metaData)
        
        // 2. 并行下载 5 张纹理
        async let base = loadTexture(meta.baseUrl)
        async let depth = loadTexture(meta.depthUrl)
        async let normal = loadTexture(meta.normalUrl)
        async let cutout = loadTexture(meta.cutoutUrl)
        async let fx = loadTexture(meta.fxTextureUrl)
        
        (baseTexture, depthTexture, normalTexture, cutoutTexture, fxTexture) =
            try await (base, depth, normal, cutout, fx)
        
        // 3. 合并参数
        params = ShaderParams.default
            .merged(with: meta.shader)
            .merged(with: agent.avatarSpatialShader)
    }
    
    // 渲染循环
    func draw(in view: MTKView) {
        time += 1.0 / Float(preferredFramesPerSecond)
        
        // 更新 uniform buffer
        // 编码渲染命令
        // 提交到 GPU
    }
}
```

---

## ✅ 验收清单

让测试人员打开 App，**不晃手机，静静看 5 秒钟**：

- [ ] 能看到她在"呼吸"吗？（胸腔起伏）
- [ ] 能看到她"眨眼"吗？（每几秒一次）
- [ ] 能看到头发/衣服在"飘"吗？
- [ ] 能看到身上光影在"流动"吗？
- [ ] 能看到背景有粒子在"漂浮"吗？

**全部打勾 = 王者荣耀级别动态皮肤完成！**

---

## 🔗 资产下载测试

可以用这个真实的 Agent 测试：

```bash
# 获取 meta.json
curl "https://pub-adb0752163614188a4c2683000518d5d.r2.dev/uploads/2025-12-13/1765601191054-a274b716.json"

# 下载各纹理（可以在浏览器直接打开看）
# baseUrl:   原图
# depthUrl:  深度图（灰度）
# normalUrl: 法线图（彩色）
# cutoutUrl: 蒙版（黑白）
# fxTextureUrl: 粒子贴图
```
