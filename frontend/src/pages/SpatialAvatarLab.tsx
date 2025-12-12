import React, { useEffect, useMemo, useState } from 'react';
import SpatialAvatar, { DEFAULT_PORTRAIT_LAYERS, type SpatialAvatarLayer } from '../components/SpatialAvatar';
import { DEFAULT_MOTION_PROFILE, type MotionProfile } from '../components/motionProfile';
import Apple3DPhoto from '../components/Apple3DPhoto';
import { http } from '../api/http';
import { getAgents, type Agent } from '../api';
import { normalizeImageUrl } from '../utils/imageUrl';

const SpatialAvatarLab: React.FC = () => {
  const [src, setSrc] = useState<string>('https://via.placeholder.com/512x512.png?text=Avatar');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('custom');
  const [interactive, setInteractive] = useState(true);
  const [mode, setMode] = useState<'layers' | 'apple3d'>('apple3d');
  const [assetPack, setAssetPack] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Motion tuning knobs (safe ranges; prefer variance over amplitude).
  const [parallaxPx, setParallaxPx] = useState(DEFAULT_MOTION_PROFILE.parallaxPx);
  const [breathAmpPx, setBreathAmpPx] = useState(DEFAULT_MOTION_PROFILE.breathAmpPx);
  const [breathScale, setBreathScale] = useState(DEFAULT_MOTION_PROFILE.breathScale);
  const [driftAmpPx, setDriftAmpPx] = useState(DEFAULT_MOTION_PROFILE.driftAmpPx);
  const [driftRotDeg, setDriftRotDeg] = useState(DEFAULT_MOTION_PROFILE.driftRotDeg);
  const [seed, setSeed] = useState(DEFAULT_MOTION_PROFILE.seed);

  const layers: SpatialAvatarLayer[] = useMemo(() => {
    // 3-layer portrait default (bg/body/face). You can copy & adjust rects here.
    return DEFAULT_PORTRAIT_LAYERS;
  }, []);

  const motion: MotionProfile = useMemo(
    () => ({
      ...DEFAULT_MOTION_PROFILE,
      parallaxPx,
      breathAmpPx,
      breathScale,
      driftAmpPx,
      driftRotDeg,
      seed,
    }),
    [parallaxPx, breathAmpPx, breathScale, driftAmpPx, driftRotDeg, seed],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getAgents();
        const raw: any = res.data;
        const list: Agent[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
        if (!mounted) return;
        setAgents(list);
      } catch (e) {
        if (!mounted) return;
        setAgents([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const agentAvatarUrl = useMemo(() => {
    const agent = agents.find((a) => a._id === selectedAgentId);
    if (!agent) return null;
    const url = agent.avatarUrls?.[0] || agent.avatarUrl;
    return normalizeImageUrl(url, 'https://via.placeholder.com/512x512.png?text=Avatar');
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (selectedAgentId !== 'custom' && agentAvatarUrl) {
      setSrc(agentAvatarUrl);
      setAssetPack(null);
      setGenError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgentId, agentAvatarUrl]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-[280px] flex-1">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Spatial Avatar Lab</h2>
          <p className="text-sm text-gray-500 mb-5">
            用于调试/配置 2.5D 单PNG Avatar。建议先调整 <b>rect 切片</b>，再调 <b>parallax</b>，最后才加大幅度。
          </p>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <label className="block">
              <div className="text-xs text-gray-500 mb-1">选择现有 AI 主播</div>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
              >
                <option value="custom">自定义 URL</option>
                {agents.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {selectedAgentId !== 'custom' && agentAvatarUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                  <img src={agentAvatarUrl} alt="" className="w-8 h-8 rounded-md object-cover bg-gray-100" />
                  <span className="truncate">已选头像：{agentAvatarUrl}</span>
                </div>
              )}
            </label>

            <label className="block">
              <div className="text-xs text-gray-500 mb-1">PNG URL</div>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                placeholder="https://.../avatar.png"
                disabled={selectedAgentId !== 'custom'}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                disabled={generating || !src}
                onClick={async () => {
                  setGenerating(true);
                  setGenError(null);
                  try {
                    // Backend will use FAL_KEY server-side to generate depth/cutout/normal pack.
                    const res = await http.post('/avatar-assets/generate', { imageUrl: src });
                    setAssetPack(res.data);
                  } catch (e: any) {
                    const serverMsg = e?.response?.data?.message;
                    const raw = e?.response?.data;
                    const rawText = typeof raw === 'string' ? raw.slice(0, 240) : null;
                    const status = e?.response?.status;
                    setGenError(
                      (status ? `HTTP ${status}: ` : '') + (serverMsg || rawText || e?.message || '生成失败')
                    );
                  } finally {
                    setGenerating(false);
                  }
                }}
              >
                {generating ? '生成中…' : '用 fal.ai 生成空间资产包（depth/normal/mask）'}
              </button>
              {assetPack?.metaUrl && (
                <a className="text-sm text-indigo-600 hover:underline" href={assetPack.metaUrl} target="_blank" rel="noreferrer">
                  查看 meta.json
                </a>
              )}
            </div>
            {genError && <div className="text-sm text-red-600">{genError}</div>}

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={interactive} onChange={(e) => setInteractive(e.target.checked)} />
              允许交互（hover / focus / pointer parallax）
            </label>

            <label className="block">
              <div className="text-xs text-gray-500 mb-1">模式</div>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="apple3d">苹果风格 3D 照片（倾斜 + 光泽 + 阴影）</option>
                <option value="layers">2.5D 分层（clip-path 切片 + 视差）</option>
              </select>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Knob label="parallaxPx" value={parallaxPx} min={3} max={12} step={0.5} onChange={setParallaxPx} note="深度视差（建议 < 12）" />
              <Knob label="breathAmpPx" value={breathAmpPx} min={0.4} max={1.6} step={0.05} onChange={setBreathAmpPx} note="呼吸Y位移" />
              <Knob label="breathScale" value={breathScale} min={0.002} max={0.01} step={0.0005} onChange={setBreathScale} note="呼吸scale" />
              <Knob label="driftAmpPx" value={driftAmpPx} min={0.4} max={1.5} step={0.05} onChange={setDriftAmpPx} note="微漂移（<=1.5）" />
              <Knob label="driftRotDeg" value={driftRotDeg} min={0.05} max={0.3} step={0.01} onChange={setDriftRotDeg} note="微旋转（<=0.3°）" />
              <Knob label="seed" value={seed} min={1} max={99999} step={1} onChange={setSeed} note="人格/随机性" isNumber />
            </div>

            <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
              layers(默认 3 层): <code className="px-1">bg:-0.2</code> <code className="px-1">body:0.2</code> <code className="px-1">face:0.6</code>
            </div>

            {assetPack && (
              <div className="text-xs text-gray-600 pt-2 border-t border-gray-100 space-y-1">
                <div><b>depth</b>: <a className="text-indigo-600 hover:underline" href={assetPack.depthUrl} target="_blank" rel="noreferrer">open</a></div>
                <div><b>normal</b>: <a className="text-indigo-600 hover:underline" href={assetPack.normalUrl} target="_blank" rel="noreferrer">open</a></div>
                <div><b>cutout/mask</b>: <a className="text-indigo-600 hover:underline" href={assetPack.cutoutUrl} target="_blank" rel="noreferrer">open</a></div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-semibold text-gray-800">Preview</div>
              <div className="text-xs text-gray-500">hover / tab focus 试试</div>
            </div>

            <div className="flex justify-center">
              {mode === 'layers' ? (
                <SpatialAvatar
                  src={src}
                  width={220}
                  height={220}
                  layers={layers}
                  motion={motion}
                  interactive={interactive}
                  className="shadow-lg"
                />
              ) : (
                <Apple3DPhoto
                  src={src}
                  width={260}
                  height={260}
                  interactive={interactive}
                  tiltDeg={8}
                  translatePx={10}
                  glare={0.9}
                  seed={seed}
                  className="shadow-lg"
                />
              )}
            </div>

            <div className="mt-4 text-xs text-gray-500">
              如果你看到明显“切片边缘”，优先把 <b>parallax</b>、<b>drift</b> 降下来，或调整 rect。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function Knob(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  note?: string;
  isNumber?: boolean;
}) {
  const { label, value, min, max, step, onChange, note, isNumber } = props;
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-700">{label}</div>
        <div className="text-xs text-gray-500">{isNumber ? value : value.toFixed(3)}</div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-600"
      />
      {note && <div className="text-[11px] text-gray-500 mt-1">{note}</div>}
    </div>
  );
}

export default SpatialAvatarLab;
