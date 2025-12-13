# 🚨 紧急修复：画面异常（灰色噪点、人物变形）

## 问题诊断

根据截图，画面呈现出"灰色噪点覆盖、人物部分透出但颜色怪异"的效果。这通常是**纹理绑定错误**导致的。

### 核心原因：纹理索引（Index）搞错了

Metal 中 Shader 的纹理索引必须与 Swift 代码中的 `setFragmentTexture` 严格一致。目前的现象看起来像是：
- 把 **Depth Texture（深度图）** 或 **FX Texture（噪点图）** 错误地当成了 **Base Texture（原图）** 渲染。

---

## 🔧 修复步骤

### 1. 检查 Shader 定义

请确认 Shader 中的 `texture index` 定义：

```metal
fragment float4 dynamicAvatarFragment(
    VertexOut in [[stage_in]],
    texture2d<float> baseTexture   [[texture(0)]], // Index 0: 原图
    texture2d<float> depthTexture  [[texture(1)]], // Index 1: 深度图
    texture2d<float> normalTexture [[texture(2)]], // Index 2: 法线图
    texture2d<float> cutoutTexture [[texture(3)]], // Index 3: 蒙版
    texture2d<float> fxTexture     [[texture(4)]], // Index 4: FX
    // ...
)
```

### 2. 检查 Swift 绑定代码

请确认 Swift 端的绑定顺序是否**完全一致**：

```swift
// ❌ 错误：可能这里的顺序乱了
renderEncoder.setFragmentTexture(depthTexture, index: 0) // 错！把深度图绑到了 index 0

// ✅ 正确：严格对应
renderEncoder.setFragmentTexture(baseTexture,   index: 0)
renderEncoder.setFragmentTexture(depthTexture,  index: 1)
renderEncoder.setFragmentTexture(normalTexture, index: 2)
renderEncoder.setFragmentTexture(cutoutTexture, index: 3)
renderEncoder.setFragmentTexture(fxTexture,     index: 4)
```

### 3. 检查蒙版混合逻辑

目前的画面显示人物周围是灰色噪点，说明蒙版逻辑可能反了，或者混合错了。

```metal
float mask = cutoutTexture.sample(s, uv).r;

// 我们的蒙版：白色(1.0)=人物，黑色(0.0)=背景

// ✅ 正确混合
float3 finalColor = mix(bgColor, baseColor.rgb, mask);
```

### 4. 调试模式（Debug Mode）

如果不确定是哪张图的问题，请**修改 Shader 强制输出单张纹理**进行排查：

**测试 A：只看原图**
```metal
return baseTexture.sample(s, uv); 
// 预期：显示正常的高清人物图
```

**测试 B：只看蒙版**
```metal
float m = cutoutTexture.sample(s, uv).r;
return float4(m, m, m, 1.0);
// 预期：黑底白人
```

**测试 C：只看深度**
```metal
float d = depthTexture.sample(s, uv).r;
return float4(d, d, d, 1.0);
// 预期：灰度图，越近越白
```

---

## 💡 总结

这个效果绝对不是资源的问题，而是**渲染管线配置的问题**。请务必先用"测试 A"确认原图能正确显示，再叠加其他效果。
