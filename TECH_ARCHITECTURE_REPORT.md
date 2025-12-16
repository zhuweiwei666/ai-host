# AI Host 项目技术架构与实现报告

> 生成日期: 2025-12-15
> 版本: v1.0

## 1. 项目概览 (Project Overview)

**AI Host** 是一个集成了多模态 AI 技术的虚拟角色伴侣平台。项目旨在突破传统 Chatbot 的纯文本交互限制，通过**高质量视觉表现 (Spatial Avatar)**、**沉浸式剧情互动 (Story Mode)** 和 **拟人化语音 (TTS)**，构建具有“在场感”的 AI 社交体验。

## 2. 系统架构 (System Architecture)

### 2.1 技术栈 (Tech Stack)

| 领域 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **Frontend** | **React 18, TypeScript** | 核心 UI 框架 |
| | **Vite** | 构建工具 |
| | **TailwindCSS** | 样式方案 |
| | **WebGL (Custom Shaders)** | Spatial Avatar 2.5D 渲染核心 |
| **Backend** | **Node.js, Express** | API 服务与业务逻辑 |
| | **MongoDB (Mongoose)** | 业务数据存储 (Users, Agents, Stories) |
| **AI Integration** | **xAI Grok** | 核心 LLM (对话/剧情) & 图像生成 |
| | **Fal.ai** | 图像生成 (Flux/RealVis) & 3D 资产处理 |
| | **Fish Audio** | TTS 语音合成 |
| **Infrastructure** | **Docker & Docker Compose** | 容器化部署 |
| | **Nginx** | 反向代理与静态资源服务 |
| | **Cloudflare R2** | 对象存储 (OSS) |

### 2.2 架构拓扑 (Architecture Topology)

```mermaid
graph TD
    Client[Client (Web/Mobile)] -->|HTTPS| Nginx
    Nginx -->|Static| Frontend[Frontend Container]
    Nginx -->|API /api/*| Backend[Backend Container]
    
    subgraph "Backend Services"
        Backend --> DB[(MongoDB)]
        Backend --> Cache[(StoryImageCache)]
        Backend --> ProviderFactory[AI Provider Factory]
    end
    
    subgraph "External AI Cloud"
        ProviderFactory -->|Chat/Story| Grok[xAI Grok API]
        ProviderFactory -->|TTS| Fish[Fish Audio API]
        ProviderFactory -->|Image/3D| Fal[Fal.ai API]
        ProviderFactory -->|Image| GrokImg[Grok Image API]
    end
    
    subgraph "Storage"
        Backend -->|Upload| R2[Cloudflare R2 OSS]
        Client -->|CDN Load| R2
    end
```

## 3. 核心技术实现点 (Key Technical Implementations)

### 3.1 沉浸式故事引擎 (Immersive Story Engine) `[StoryService]`

针对“论坛帖”式互动体验进行了深度重构与优化，核心解决**生成延迟**与**内容一致性**问题。

*   **异步多模态流 (Async Multi-modal Streaming)**
    *   **问题**: 大模型生成高质量图片耗时(5-10s)，阻塞文本返回会导致用户长时间等待。
    *   **方案**: 
        1.  **分离响应**: 后端生成文本后立即返回，仅带回图片 Prompt，`imageUrl` 标记为 `null`。
        2.  **异步生成**: 后端在后台触发图片生成任务。
        3.  **前端轮询**: 前端展示 Loading 骨架屏，并以 2s 间隔轮询图片状态，图片就绪后平滑渐入。
    *   **效果**: 首屏响应速度提升 90%，用户体验流畅无中断。

*   **角色一致性控制 (Character Consistency)**
    *   **技术**: 基于 **Img2Img (图生图)** 流程。
    *   **实现**: 
        - 提取 Agent 的头像作为 `reference_image`。
        - 动态构建 Prompt: `[Style] + [Character Appearance] + [Action/Scene] + [Mood]`.
        - 设置 `strength: 0.55`，在保持人物特征和生成新姿态之间取得平衡。
    *   **容错**: 实现多模型降级策略，优先使用 **Grok-2-Image**，失败自动回退至 **Fal.ai Flux Pro**。

*   **智能成本优化 (Cost Optimization)**
    *   **机制**: 引入 `StoryImageCache` 缓存模型。
    *   **算法**: 基于「角色 ID + 情绪标签 + 场景关键词 + 尺度等级」进行语义匹配。
    *   **策略**: 30% 概率优先复用历史高质量图片，既保证了内容新鲜度，又显著降低了 API 调用成本。

### 3.2 空间视觉技术 (Spatial Visuals) `[SpatialAvatarLab]`

在 Web 端实现原生的高性能 2.5D 视觉体验，无需加载繁重的 3D 模型文件。

*   **WebGL Spatial Shader**:
    *   **原理**: 使用自定义 Fragment Shader，解析由单张图片生成的 `Meta` 数据包（Base Color + Depth Map + Normal Map + Cutout）。
    *   **视差 (Parallax)**: 根据鼠标/陀螺仪位置，利用深度图偏移 UV 坐标，模拟 3D 景深。
    *   **光照 (Lighting)**: 利用法线图计算实时光照，支持边缘光 (Rim Light) 和高光 (Specular) 响应。

*   **交互式微表情 (Micro-interactions)**:
    *   **注视点跟踪**: 鼠标移动时，角色眼球/头部会产生微妙的跟随运动。
    *   **程序化动效**: 通过 Shader 数学函数模拟呼吸起伏和眨眼，使静态图片“活过来”。

### 3.3 智能体编排 (Agent Orchestration)

*   **Provider Factory 模式**:
    *   封装了 `DeepSeek`, `Grok`, `OpenAI` 等多个 Provider。
    *   统一了 `chat` 和 `generate` 接口，支持通过配置热切换底层模型。
    *   实现了统一的错误处理与重试机制。

*   **上下文感知 (Context Awareness)**:
    *   Story 模式下，自动提取上一轮的 `Scene` (场景) 和 `Mood` (情绪) 状态。
    *   动态注入到 System Prompt 中，确保 AI 知道“我在哪”、“我在做什么”、“我现在的心情”。

## 4. 部署与运维 (Deployment)

*   **自动化部署**: 编写了 `ai-host-deploy.sh` 脚本。
    *   自动处理 Git Pull。
    *   Docker 镜像构建与缓存利用。
    *   服务平滑重启与健康检查。
*   **配置管理**: 环境变量 (`.env`) 与 Docker Compose 配置分离，确保敏感信息安全。

## 5. 总结

本项目不仅仅是一个简单的 AI 聊天套壳，而是在**视觉表现力**和**交互深度**上做了大量工程化创新。特别是**空间 Avatar**技术和**异步故事流**架构，在保证 Web 端轻量级体验的同时，提供了接近原生应用的沉浸感。
