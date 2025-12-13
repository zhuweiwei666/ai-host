# 🎮 目标效果：王者荣耀动态皮肤级别

## 当前问题

现在的效果只是"轻微 2.5D 视差"——晃一晃手机，图片稍微动一点。

**这太弱了！** 用户几乎感知不到。

---

## 🎯 我们要的效果

参考：**王者荣耀英雄皮肤展示页**

那些皮肤的"活"体现在：
1. 头发/衣服在飘动
2. 背景有粒子/光效在流动
3. 人物有呼吸起伏
4. 眼睛会眨、会看镜头
5. 有环境光在变化（明暗流转）
6. 整体有"呼吸感"的微动

**这才叫"动态皮肤"，不是晃手机看 3D。**

---

## 🔧 技术实现路径

### 我们已有的资产

```
baseUrl      - 原图（高清）
depthUrl     - 深度图（灰度，可用于视差 + 局部动画控制）
normalUrl    - 法线图（RGB，可用于动态光照）
cutoutUrl    - 抠图蒙版（分离主体和背景）
fxTextureUrl - FX 叠加纹理（光晕/bokeh）
```

**这些足够实现王者荣耀级别的效果！** 关键在于 shader 怎么写。

---

## 🎬 具体效果拆解 + 实现方法

### 1. 头发飘动效果 ✨

**原理**：用深度图识别边缘区域（头发、衣服边缘深度变化大），对这些区域做正弦波形变。

```metal
// 边缘区域检测（深度梯度大的地方）
float depthGradient = abs(dfdx(depth)) + abs(dfdy(depth));
float isEdge = smoothstep(0.01, 0.05, depthGradient);

// 对边缘区域做波浪形变
float wave = sin(time * 2.0 + uv.y * 10.0) * 0.003;
uv.x += wave * isEdge;
```

**效果**：头发丝、衣服边缘会有自然的飘动感。

---

### 2. 呼吸起伏 🫁

**原理**：整体画面做轻微的缩放 + Y 轴偏移，周期 3-4 秒。

```metal
float breathe = sin(time * 1.5) * 0.008;  // 呼吸周期
float breatheScale = 1.0 + sin(time * 1.5) * 0.003;

// 从底部锚点缩放（不是中心）
uv = (uv - vec2(0.5, 1.0)) / breatheScale + vec2(0.5, 1.0);
uv.y += breathe * (1.0 - uv.y);  // 上半身动得多，脚不动
```

**效果**：胸腔微微起伏，像在呼吸。

---

### 3. 眨眼效果 👁️

**原理**：在眼睛区域做周期性的"压扁"形变。

```metal
float2 eyeCenter = float2(0.5, 0.35);  // 眼睛大致位置
float eyeDist = distance(uv, eyeCenter);
float eyeMask = smoothstep(0.15, 0.05, eyeDist);

// 每 4-6 秒眨一次眼
float blinkCycle = mod(time, 5.0);
float blink = 1.0 - smoothstep(0.0, 0.15, blinkCycle) * smoothstep(0.3, 0.15, blinkCycle);

// 眼睛区域 Y 轴压缩
uv.y = mix(uv.y, eyeCenter.y, eyeMask * blink * 0.5);
```

**效果**：自然的眨眼，不是整张脸变暗。

---

### 4. 动态光照流转 💡

**原理**：用法线图做光照计算，光源位置随时间缓慢移动。

```metal
// 光源位置随时间旋转
float3 lightPos = float3(
    sin(time * 0.5) * 0.5,
    cos(time * 0.3) * 0.3 + 0.5,
    1.0
);

// 法线光照
float3 normal = normalTexture.sample(sampler, uv).rgb * 2.0 - 1.0;
float3 lightDir = normalize(lightPos);
float diffuse = max(dot(normal, lightDir), 0.0);

// 边缘光也随时间变化
float rimPhase = sin(time * 0.8) * 0.5 + 0.5;
float rim = pow(1.0 - abs(dot(normal, float3(0,0,1))), 2.0) * rimPhase;

baseColor.rgb += rim * float3(1.0, 0.9, 0.85) * 0.3;
```

**效果**：人物身上的光影在缓慢流动，有"打光"的高级感。

---

### 5. 背景粒子/光斑 ✨

**原理**：用 FX 纹理做多层叠加，不同层速度不同（视差滚动）。

```metal
// 多层 FX 叠加
float2 fx1UV = uv * 1.2 + float2(time * 0.02, time * 0.01);
float2 fx2UV = uv * 0.8 + float2(-time * 0.015, time * 0.02);
float2 fx3UV = uv * 1.5 + float2(time * 0.03, -time * 0.01);

float4 fx1 = fxTexture.sample(sampler, fx1UV);
float4 fx2 = fxTexture.sample(sampler, fx2UV);
float4 fx3 = fxTexture.sample(sampler, fx3UV);

// 只在背景区域显示（用 cutout 蒙版）
float bgMask = 1.0 - cutoutTexture.sample(sampler, uv).r;
float3 fxColor = (fx1.rgb * 0.3 + fx2.rgb * 0.3 + fx3.rgb * 0.2);

baseColor.rgb += fxColor * bgMask * 0.5;
```

**效果**：背景有漂浮的光斑、粒子在缓慢移动。

---

### 6. 眼神跟随（可选高级效果）👀

**原理**：根据陀螺仪，微调眼睛区域的 UV，让眼珠"看向"用户。

```metal
float2 eyeOffset = gyroInput * 0.01;  // 陀螺仪输入

// 只对眼睛区域应用
float2 leftEye = float2(0.4, 0.35);
float2 rightEye = float2(0.6, 0.35);
float leftEyeMask = smoothstep(0.08, 0.02, distance(uv, leftEye));
float rightEyeMask = smoothstep(0.08, 0.02, distance(uv, rightEye));

uv += eyeOffset * (leftEyeMask + rightEyeMask);
```

**效果**：不管你怎么晃手机，她的眼睛始终在"看着你"。

---

## 📊 效果强度对比

| 效果 | 现在（太弱） | 应该做到 |
|------|------------|---------|
| 视差 | 0.5% 位移 | 2-3% 位移 |
| 呼吸 | 无 | 明显可见的起伏 |
| 眨眼 | 无 | 每 4-6 秒自然眨眼 |
| 头发飘动 | 无 | 边缘有波浪感 |
| 光照变化 | 静态 | 缓慢流动的明暗 |
| 背景 | 静态 | 有粒子/光斑在飘 |

---

## 🎮 参考视频

让 iOS 开发看这些：

1. **王者荣耀皮肤展示**
   - B站搜索"王者荣耀 传说皮肤 动态展示"
   - 注意看：头发飘动、衣服飘动、背景粒子、光效流转

2. **原神角色展示**
   - 角色详情页的待机动画
   - 注意看：呼吸感、眨眼、环境光

3. **Apple Portrait Mode 广告**
   - 注意看：深度模糊 + 主体清晰 + 光影变化

---

## ✅ 验收标准

用户打开聊天页，不用晃手机，静静看着屏幕：

- [ ] 能看到她在"呼吸"（胸腔起伏）
- [ ] 能看到她"眨眼"（每几秒一次）
- [ ] 能看到头发/衣服边缘在"飘"
- [ ] 能看到身上的光影在缓慢变化
- [ ] 能看到背景有东西在"动"（粒子/光斑）

**如果以上都做到了，用户会说"卧槽这人是活的"。**

---

## 🚀 最小可行版本（先做这 3 个）

如果时间紧，先做这三个效果，已经能超越 90% 的竞品：

1. **呼吸** - 最容易实现，效果明显
2. **动态光照** - 用法线图，高级感立刻出来
3. **背景粒子** - 用 FX 纹理多层叠加

眨眼和头发飘动可以 V2 再做。
