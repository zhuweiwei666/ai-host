# iOS LiveSkin FSM 实现指南

## 概述

LiveSkin FSM（状态机）系统让 AI 主播"永远活着"，通过精确控制视频切换来实现流畅的情绪反应。

### 核心目标

1. **角色永远在活着** - 屏幕上始终有 IDLE 在播放
2. **即时反馈不跳帧** - 用户事件有反应，但等待安全切点
3. **可扩展** - 新增情绪只需添加视频 + 元数据

---

## API 接口

### 获取资产清单

```
GET /api/liveskin/manifest/:agentId
```

响应示例：

```json
{
  "agentId": "xxx",
  "agentName": "小美",
  "version": 1,
  "status": "ready",
  "assets": {
    "idle": [
      {
        "id": "v001",
        "url": "https://..../idle_loop.mp4",
        "loopSafeUrl": "https://..../idle_pingpong.mp4",
        "duration": 3.0,
        "safeCutPoints": [0.5, 1.0, 1.5, 2.0, 2.5],
        "poseId": "neutral",
        "loopSafe": true
      }
    ],
    "reactions": {
      "happy": [
        {
          "id": "v002",
          "url": "https://..../reaction_happy.mp4",
          "duration": 1.2,
          "poseId": "neutral",
          "emotionId": "happy"
        }
      ],
      "shy": [...],
      "excited": [...]
    },
    "transitions": [
      {
        "id": "v010",
        "url": "https://..../transition_blink.mp4",
        "duration": 0.3,
        "fromPose": "neutral",
        "toPose": "neutral"
      }
    ],
    "speak": [...]
  },
  "defaultIdleIndex": 0,
  "totalAssets": 15
}
```

### 上报事件

```
POST /api/liveskin/event
Authorization: Bearer <token>

{
  "agentId": "xxx",
  "eventType": "reaction_played",
  "data": {
    "emotionId": "happy",
    "latencyMs": 320,
    "videoAssetId": "v002"
  }
}
```

---

## Swift 实现

### 1. 类型定义

```swift
import Foundation

// MARK: - FSM 状态
enum FSMState: String, Codable {
    case idleLoop = "IDLE_LOOP"
    case transitionOut = "TRANSITION_OUT"
    case reactionOnce = "REACTION_ONCE"
    case transitionIn = "TRANSITION_IN"
    case speaking = "SPEAKING"
}

// MARK: - 资产类型
enum AssetType: String, Codable {
    case idle
    case reaction
    case transition
    case speak
}

// MARK: - 视频资产
struct VideoAsset: Codable, Identifiable {
    let id: String
    let url: String
    var loopSafeUrl: String?
    var thumbnailUrl: String?
    var duration: Double
    var safeCutPoints: [Double]
    var poseId: String
    var emotionId: String?
    var fromPose: String?
    var toPose: String?
    var loopSafe: Bool
    var tags: [String]?
    var scaleLevel: Int?
    var sortOrder: Int?
}

// MARK: - 资产清单
struct LiveSkinManifest: Codable {
    let agentId: String
    let agentName: String
    let version: Int
    let status: String
    let assets: LiveSkinAssets
    let defaultIdleIndex: Int
    let totalAssets: Int
    let generatedAt: String
}

struct LiveSkinAssets: Codable {
    let idle: [VideoAsset]
    let reactions: [String: [VideoAsset]]
    let transitions: [VideoAsset]
    let speak: [VideoAsset]
}

// MARK: - 队列事件
struct QueuedEvent: Identifiable {
    let id: String
    let emotionId: String
    var priority: Int
    let queuedAt: Date
    var expiresAt: Date?
    let source: String
    var metadata: [String: Any]?
    
    init(emotionId: String, source: String, priority: Int = 3) {
        self.id = "evt_\(Date().timeIntervalSince1970)_\(Int.random(in: 1000...9999))"
        self.emotionId = emotionId
        self.source = source
        self.priority = priority
        self.queuedAt = Date()
        self.expiresAt = Date().addingTimeInterval(30) // 30秒过期
    }
    
    var isExpired: Bool {
        guard let expires = expiresAt else { return false }
        return Date() > expires
    }
}
```

### 2. 事件队列

```swift
import Foundation

class EventQueue: ObservableObject {
    @Published private(set) var queue: [QueuedEvent] = []
    
    var hasEvents: Bool {
        cleanup()
        return !queue.isEmpty
    }
    
    var count: Int { queue.count }
    
    func push(emotionId: String, source: String, priority: Int = 3) -> QueuedEvent? {
        cleanup()
        
        // 最多 10 个事件
        guard queue.count < 10 else {
            print("[EventQueue] Queue full, dropping event")
            return nil
        }
        
        // 检查是否可合并（连续相同情绪）
        if let last = queue.last, last.emotionId == emotionId && last.source == source {
            queue[queue.count - 1].priority = min(5, last.priority + 1)
            return queue.last
        }
        
        let event = QueuedEvent(emotionId: emotionId, source: source, priority: priority)
        queue.append(event)
        
        // 按优先级排序
        queue.sort { $0.priority > $1.priority }
        
        return event
    }
    
    func dequeue() -> QueuedEvent? {
        cleanup()
        guard !queue.isEmpty else { return nil }
        return queue.removeFirst()
    }
    
    func peek() -> QueuedEvent? {
        cleanup()
        return queue.first
    }
    
    func clear() {
        queue.removeAll()
    }
    
    private func cleanup() {
        queue.removeAll { $0.isExpired }
    }
}
```

### 3. 视频播放器封装

```swift
import AVFoundation
import Combine

protocol VideoPlayerDelegate: AnyObject {
    func videoPlayer(_ player: LiveSkinVideoPlayer, didReachSafeCut time: Double)
    func videoPlayerDidFinishPlaying(_ player: LiveSkinVideoPlayer)
    func videoPlayer(_ player: LiveSkinVideoPlayer, didEncounterError error: Error)
}

class LiveSkinVideoPlayer: NSObject {
    weak var delegate: VideoPlayerDelegate?
    
    private let player: AVQueuePlayer
    private var currentAsset: VideoAsset?
    private var isLooping = false
    private var safeCutTimer: Timer?
    private var lastNotifiedCut: Double = -1
    
    var playerLayer: AVPlayerLayer { AVPlayerLayer(player: player) }
    
    override init() {
        self.player = AVQueuePlayer()
        super.init()
        setupObservers()
    }
    
    func play(asset: VideoAsset, loop: Bool = false) {
        currentAsset = asset
        isLooping = loop
        lastNotifiedCut = -1
        
        let urlString = (loop && asset.loopSafe) ? (asset.loopSafeUrl ?? asset.url) : asset.url
        guard let url = URL(string: urlString) else {
            delegate?.videoPlayer(self, didEncounterError: NSError(domain: "LiveSkin", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"]))
            return
        }
        
        let item = AVPlayerItem(url: url)
        player.removeAllItems()
        player.insert(item, after: nil)
        
        if loop {
            // 使用 AVPlayerLooper 或手动 seek
            NotificationCenter.default.addObserver(self, selector: #selector(handlePlayerItemEnded), name: .AVPlayerItemDidPlayToEndTime, object: item)
        }
        
        player.play()
        startSafeCutCheck()
    }
    
    func pause() {
        player.pause()
        stopSafeCutCheck()
    }
    
    func resume() {
        player.play()
        if isLooping {
            startSafeCutCheck()
        }
    }
    
    var currentTime: Double {
        player.currentTime().seconds
    }
    
    // MARK: - Private
    
    private func setupObservers() {
        NotificationCenter.default.addObserver(self, selector: #selector(handlePlayerItemEnded), name: .AVPlayerItemDidPlayToEndTime, object: nil)
    }
    
    @objc private func handlePlayerItemEnded(_ notification: Notification) {
        if isLooping {
            player.seek(to: .zero)
            player.play()
        } else {
            stopSafeCutCheck()
            delegate?.videoPlayerDidFinishPlaying(self)
        }
    }
    
    private func startSafeCutCheck() {
        safeCutTimer?.invalidate()
        safeCutTimer = Timer.scheduledTimer(withTimeInterval: 0.016, repeats: true) { [weak self] _ in
            self?.checkSafeCut()
        }
    }
    
    private func stopSafeCutCheck() {
        safeCutTimer?.invalidate()
        safeCutTimer = nil
    }
    
    private func checkSafeCut() {
        guard isLooping, let asset = currentAsset else { return }
        
        let current = currentTime
        let threshold = 0.05 // 50ms
        
        for cut in asset.safeCutPoints {
            if abs(cut - current) <= threshold && cut != lastNotifiedCut {
                lastNotifiedCut = cut
                delegate?.videoPlayer(self, didReachSafeCut: cut)
                break
            }
        }
    }
}
```

### 4. FSM 控制器

```swift
import Combine

class LiveSkinFSM: ObservableObject {
    @Published private(set) var state: FSMState = .idleLoop
    @Published private(set) var currentAsset: VideoAsset?
    
    private var manifest: LiveSkinManifest?
    private let eventQueue = EventQueue()
    private let videoPlayer = LiveSkinVideoPlayer()
    
    private var currentReaction: QueuedEvent?
    private var isSpeaking = false
    
    var queueLength: Int { eventQueue.count }
    
    init() {
        videoPlayer.delegate = self
    }
    
    // MARK: - Public API
    
    func setManifest(_ manifest: LiveSkinManifest) {
        self.manifest = manifest
        print("[FSM] Manifest loaded: \(manifest.agentName), \(manifest.totalAssets) assets")
    }
    
    func start() {
        guard manifest != nil else {
            print("[FSM] Error: Manifest not loaded")
            return
        }
        transitionTo(.idleLoop, trigger: "START")
        playIdle()
    }
    
    func stop() {
        videoPlayer.pause()
        eventQueue.clear()
    }
    
    func queueReaction(emotionId: String, source: String) -> QueuedEvent? {
        let event = eventQueue.push(emotionId: emotionId, source: source)
        if let event = event {
            print("[FSM] Reaction queued: \(emotionId) from \(source)")
        }
        return event
    }
    
    func onTTSStart() {
        isSpeaking = true
        if state == .idleLoop {
            transitionTo(.speaking, trigger: "TTS_START")
            playSpeakAsset()
        }
    }
    
    func onTTSEnd() {
        isSpeaking = false
        if state == .speaking {
            if eventQueue.hasEvents {
                transitionTo(.transitionOut, trigger: "TTS_END_WITH_QUEUE")
                playTransitionOut()
            } else {
                transitionTo(.idleLoop, trigger: "TTS_END")
                playIdle()
            }
        }
    }
    
    // MARK: - Private
    
    private func transitionTo(_ newState: FSMState, trigger: String) {
        let from = state
        state = newState
        print("[FSM] \(from.rawValue) -> \(newState.rawValue) (\(trigger))")
    }
    
    private func playIdle() {
        guard let manifest = manifest, !manifest.assets.idle.isEmpty else { return }
        let asset = manifest.assets.idle[manifest.defaultIdleIndex]
        currentAsset = asset
        videoPlayer.play(asset: asset, loop: true)
    }
    
    private func playTransitionOut() {
        guard let manifest = manifest else { return }
        if manifest.assets.transitions.isEmpty {
            playReaction()
            return
        }
        if let asset = manifest.assets.transitions.randomElement() {
            currentAsset = asset
            videoPlayer.play(asset: asset, loop: false)
        } else {
            playReaction()
        }
    }
    
    private func playTransitionIn() {
        guard let manifest = manifest else { return }
        if manifest.assets.transitions.isEmpty {
            transitionTo(.idleLoop, trigger: "NO_TRANSITION")
            playIdle()
            return
        }
        if let asset = manifest.assets.transitions.randomElement() {
            currentAsset = asset
            videoPlayer.play(asset: asset, loop: false)
        } else {
            transitionTo(.idleLoop, trigger: "NO_TRANSITION")
            playIdle()
        }
    }
    
    private func playReaction() {
        guard let manifest = manifest else { return }
        guard let event = eventQueue.dequeue() else {
            transitionTo(.idleLoop, trigger: "NO_EVENT")
            playIdle()
            return
        }
        
        currentReaction = event
        let latencyMs = Int(Date().timeIntervalSince(event.queuedAt) * 1000)
        
        guard let assets = manifest.assets.reactions[event.emotionId], !assets.isEmpty else {
            print("[FSM] No reaction assets for: \(event.emotionId)")
            transitionTo(.idleLoop, trigger: "NO_REACTION_ASSET")
            playIdle()
            return
        }
        
        if let asset = assets.randomElement() {
            transitionTo(.reactionOnce, trigger: "PLAY_REACTION")
            currentAsset = asset
            videoPlayer.play(asset: asset, loop: false)
            print("[FSM] Playing reaction: \(event.emotionId), latency: \(latencyMs)ms")
        } else {
            transitionTo(.idleLoop, trigger: "NO_REACTION_ASSET")
            playIdle()
        }
    }
    
    private func playSpeakAsset() {
        guard let manifest = manifest else { return }
        if manifest.assets.speak.isEmpty {
            playIdle()
            return
        }
        if let asset = manifest.assets.speak.randomElement() {
            currentAsset = asset
            videoPlayer.play(asset: asset, loop: true)
        } else {
            playIdle()
        }
    }
}

// MARK: - VideoPlayerDelegate

extension LiveSkinFSM: VideoPlayerDelegate {
    func videoPlayer(_ player: LiveSkinVideoPlayer, didReachSafeCut time: Double) {
        guard state == .idleLoop, !isSpeaking, eventQueue.hasEvents else { return }
        print("[FSM] Safe cut reached at \(time)s, queue has \(eventQueue.count) events")
        transitionTo(.transitionOut, trigger: "SAFE_CUT_WITH_QUEUE")
        playTransitionOut()
    }
    
    func videoPlayerDidFinishPlaying(_ player: LiveSkinVideoPlayer) {
        switch state {
        case .transitionOut:
            playReaction()
        case .reactionOnce:
            transitionTo(.transitionIn, trigger: "REACTION_END")
            playTransitionIn()
        case .transitionIn:
            if isSpeaking {
                transitionTo(.speaking, trigger: "TRANSITION_IN_END_SPEAKING")
                playSpeakAsset()
            } else {
                transitionTo(.idleLoop, trigger: "TRANSITION_IN_END")
                playIdle()
            }
        case .speaking:
            if isSpeaking {
                playSpeakAsset()
            } else {
                transitionTo(.idleLoop, trigger: "SPEAK_END")
                playIdle()
            }
        case .idleLoop:
            playIdle()
        }
    }
    
    func videoPlayer(_ player: LiveSkinVideoPlayer, didEncounterError error: Error) {
        print("[FSM] Video error: \(error.localizedDescription)")
        transitionTo(.idleLoop, trigger: "ERROR_RECOVERY")
        playIdle()
    }
}
```

### 5. SwiftUI 集成

```swift
import SwiftUI
import AVKit

struct LiveSkinView: View {
    @StateObject private var fsm = LiveSkinFSM()
    let agentId: String
    
    var body: some View {
        ZStack {
            // 视频播放器
            VideoPlayerView(player: fsm.videoPlayer)
                .ignoresSafeArea()
            
            // 调试信息
            VStack {
                Spacer()
                HStack {
                    Text("State: \(fsm.state.rawValue)")
                    Text("Queue: \(fsm.queueLength)")
                }
                .font(.caption)
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(8)
            }
            .padding()
        }
        .task {
            await loadManifest()
        }
    }
    
    private func loadManifest() async {
        do {
            let manifest = try await APIService.shared.getLiveSkinManifest(agentId: agentId)
            fsm.setManifest(manifest)
            fsm.start()
        } catch {
            print("Failed to load manifest: \(error)")
        }
    }
    
    // 外部调用：添加反应
    func triggerReaction(_ emotionId: String, source: String) {
        _ = fsm.queueReaction(emotionId: emotionId, source: source)
    }
}
```

---

## 状态机规则

| 规则 | 说明 |
|------|------|
| R1 | IDLE 必须在 safeCutPoint 才能切出 |
| R2 | Reaction 播完必须回 IDLE（禁止连播） |
| R3 | SPEAKING 状态禁止强 reaction，只入队 |
| R4 | 队列 FIFO，同类型可合并 |

---

## 情绪优先级

| 优先级 | 情绪 |
|--------|------|
| 5 (最高) | excited, angry, surprised, scared, love |
| 4 | happy, flirty, proud |
| 3 | shy, sad, confused |
| 2 (最低) | bored |

---

## 事件触发映射

| 用户行为 | 情绪 | 来源 |
|----------|------|------|
| 送大礼物 | excited | gift |
| 送小礼物 | happy | gift |
| 点赞 | love | like |
| 夸奖 | shy/proud | chat |
| 调情消息 | flirty | chat |
| 悲伤消息 | sad | chat |

---

## 注意事项

1. **视频预加载** - 建议预加载常用反应视频
2. **安全切点** - 由运营在后台标注，通常间隔 0.5s
3. **队列过期** - 30秒未播放的事件自动丢弃
4. **TTS 优先** - 说话时不打断，反应入队等待
5. **错误恢复** - 任何错误都回退到 IDLE 循环
