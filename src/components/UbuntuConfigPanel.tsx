import React, { useRef } from 'react';
import {
  Cpu,
  HardDrive,
  Monitor,
  Sparkles,
  Layers,
  Terminal,
  Server,
  Zap,
  CheckCircle2,
  Settings,
  Shield,
  Code2,
  Box,
  BrainCircuit,
  Disc,
  Upload,
  Trash2,
  FolderArchive,
  Info,
} from 'lucide-react';
import {
  UbuntuVmConfig,
  UbuntuVersion,
  UbuntuEdition,
  UbuntuKernel,
  DEFAULT_UBUNTU_26_CONFIG,
} from '../types';

interface Props {
  config: UbuntuVmConfig;
  onChange: (updated: UbuntuVmConfig) => void;
  onQuickPreset?: (preset: UbuntuVmConfig) => void;
  compact?: boolean;
}

export default function UbuntuConfigPanel({
  config,
  onChange,
  onQuickPreset,
  compact = false,
}: Props) {
  const current = config || DEFAULT_UBUNTU_26_CONFIG;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof UbuntuVmConfig>(field: K, value: UbuntuVmConfig[K]) => {
    onChange({
      ...current,
      [field]: value,
    });
  };

  const handleIsoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({
      ...current,
      bootSource: 'custom_iso',
      isoFile: file,
      isoName: file.name,
      isoSize: file.size,
    });
  };

  const handleRemoveIso = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    onChange({
      ...current,
      bootSource: 'builtin',
      isoFile: null,
      isoName: undefined,
      isoSize: undefined,
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const applyDevPreset = () => {
    const preset: UbuntuVmConfig = {
      version: '26.04',
      edition: 'desktop',
      kernel: '6.14.0-generic',
      cpuCores: 4,
      ramMb: 8192,
      diskGb: 64,
      hostname: 'ubuntu26-dev',
      enableNpu: true,
      enableDocker: true,
      enableWayland: true,
      theme: 'yaru-dark',
      bootScript: '#!/bin/bash\necho "Initializing Ubuntu 26.04 Developer Environment..."\npython3 --version\ngcc --version\n',
      bootSource: current.bootSource || 'builtin',
      isoFile: current.isoFile,
      isoName: current.isoName,
      isoSize: current.isoSize,
    };
    if (onQuickPreset) onQuickPreset(preset);
    else onChange(preset);
  };

  const applyAiPreset = () => {
    const preset: UbuntuVmConfig = {
      version: '26.04',
      edition: 'ai-ml',
      kernel: '7.0.0-rc-zen',
      cpuCores: 8,
      ramMb: 16384,
      diskGb: 128,
      hostname: 'ubuntu26-ai-matrix',
      enableNpu: true,
      enableDocker: true,
      enableWayland: true,
      theme: 'yaru-dark',
      bootScript: '#!/bin/bash\necho "🚀 Starting Ubuntu 26 AI & PyTorch Neural Workstation..."\n',
      bootSource: current.bootSource || 'builtin',
      isoFile: current.isoFile,
      isoName: current.isoName,
      isoSize: current.isoSize,
    };
    if (onQuickPreset) onQuickPreset(preset);
    else onChange(preset);
  };

  const applyServerPreset = () => {
    const preset: UbuntuVmConfig = {
      version: '26.04',
      edition: 'server',
      kernel: '6.14.0-generic',
      cpuCores: 2,
      ramMb: 2048,
      diskGb: 32,
      hostname: 'ubuntu26-srv',
      enableNpu: false,
      enableDocker: true,
      enableWayland: false,
      theme: 'yaru-dark',
      bootScript: '#!/bin/bash\necho "Ubuntu 26.04 Server Daemon Initialized"\n',
      bootSource: current.bootSource || 'builtin',
      isoFile: current.isoFile,
      isoName: current.isoName,
      isoSize: current.isoSize,
    };
    if (onQuickPreset) onQuickPreset(preset);
    else onChange(preset);
  };

  return (
    <div className="w-full bg-neutral-950/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-left shadow-2xl space-y-4">
      {/* Header with Version Highlights */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Параметри запуску Ubuntu 26 VM</span>
              <span className="text-[10px] bg-amber-500 text-neutral-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                LTS 2026 Ready
              </span>
            </div>
            <div className="text-[11px] text-neutral-400">
              Повна конфігурація віртуальної машини Ubuntu 26.04 LTS (Noble / Resilient)
            </div>
          </div>
        </div>

        {/* Quick presets buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={applyDevPreset}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-400/50 rounded-lg text-[11px] text-amber-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            title="4 vCPU / 8GB RAM / Dev Tools"
          >
            <Code2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Developer Preset</span>
          </button>
          <button
            type="button"
            onClick={applyAiPreset}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-sky-400/50 rounded-lg text-[11px] text-sky-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            title="8 vCPU / 16GB RAM / AI Matrix"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-sky-400" />
            <span>AI / ML Lab</span>
          </button>
          <button
            type="button"
            onClick={applyServerPreset}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-emerald-400/50 rounded-lg text-[11px] text-emerald-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            title="2 vCPU / 2GB RAM / Cloud Server"
          >
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            <span>Server Cloud</span>
          </button>
        </div>
      </div>

      {/* ISO / Image Loader & Boot Source Area */}
      <div className="p-3.5 bg-gradient-to-r from-neutral-900/95 to-neutral-900/70 border border-amber-500/40 rounded-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-amber-400 animate-spin-slow" />
            <span className="font-bold text-white text-xs sm:text-sm">
              Джерело завантаження та ISO-образ системи:
            </span>
          </div>
          <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
            <button
              type="button"
              onClick={() => updateField('bootSource', 'builtin')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                (current.bootSource || 'builtin') === 'builtin'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ⚡ Вбудований образ Ubuntu 26
            </button>
            <button
              type="button"
              onClick={() => updateField('bootSource', 'custom_iso')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                current.bootSource === 'custom_iso'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              💿 Власний ISO / Образ диска
            </button>
          </div>
        </div>

        {/* Custom ISO upload area */}
        {current.bootSource === 'custom_iso' ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".iso,.img,.bin,.raw,.dmg"
              onChange={handleIsoFileSelected}
              className="hidden"
            />
            {current.isoFile || current.isoName ? (
              <div className="flex items-center justify-between gap-3 p-3 bg-neutral-950 border border-amber-500/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Disc className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-white text-xs truncate">
                      {current.isoName || current.isoFile?.name}
                    </div>
                    <div className="text-[11px] text-amber-400/90 flex items-center gap-2">
                      <span>Розмір: {formatFileSize(current.isoSize || current.isoFile?.size)}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-medium">Змонтовано у /dev/sr0 (CD-ROM)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Замінити ISO
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveIso}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
                    title="Вилучити образ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-amber-500/40 hover:border-amber-400 bg-neutral-950/60 hover:bg-neutral-950 p-4 rounded-xl flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">
                    Натисніть або перетягніть сюди файл образу ISO (.iso, .img)
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    Підтримуються офіційні образи Ubuntu 26.04 / 24.04, Debian, Arch Linux, Fedora, Rescue CD тощо
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-neutral-300 bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Вбудований образ активний:</strong> Віртуальна машина готова до миттєвого запуску без необхідності завантажувати гігабайтні файли ISO з інтернету.
            </span>
          </div>
        )}
      </div>

      {/* Grid: OS Edition & Kernel Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* Release Version */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1.5">
          <label className="font-bold text-neutral-200 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Версія Ubuntu:</span>
          </label>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => updateField('version', '26.04')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                current.version === '26.04'
                  ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-sm'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Ubuntu 26.04 LTS ⭐
            </button>
            <button
              type="button"
              onClick={() => updateField('version', '24.04')}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                current.version === '24.04'
                  ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-sm'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Ubuntu 24.04 LTS
            </button>
          </div>
        </div>

        {/* Workload Edition */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1.5">
          <label className="font-bold text-neutral-200 flex items-center gap-1.5">
            <Monitor className="w-3.5 h-3.5 text-sky-400" />
            <span>Видання / Профіль:</span>
          </label>
          <select
            value={current.edition}
            onChange={(e) => updateField('edition', e.target.value as UbuntuEdition)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-medium text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="desktop">🖥️ Ubuntu 26 Desktop (GNOME 50 Wayland)</option>
            <option value="ai-ml">🧠 Ubuntu 26 AI/ML Lab (PyTorch + NPU)</option>
            <option value="server">☁️ Ubuntu 26 Server (Docker + Systemd)</option>
          </select>
        </div>

        {/* Linux Kernel */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1.5">
          <label className="font-bold text-neutral-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ядро Linux (Kernel):</span>
          </label>
          <select
            value={current.kernel}
            onChange={(e) => updateField('kernel', e.target.value as UbuntuKernel)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
          >
            <option value="6.14.0-generic">Linux 6.14.0-generic (Ubuntu 26 LTS Default)</option>
            <option value="7.0.0-rc-zen">Linux 7.0.0-rc-zen (Ultra-Low Latency RT)</option>
            <option value="6.8.0-generic">Linux 6.8.0-generic (Ubuntu 24.04 Standard)</option>
          </select>
        </div>
      </div>

      {/* Grid: Hardware Specs (vCPU, RAM, Disk, Hostname) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* vCPU Cores */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
          <div className="text-neutral-400 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>vCPU Ядра:</span>
          </div>
          <select
            value={current.cpuCores}
            onChange={(e) => updateField('cpuCores', Number(e.target.value))}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
          >
            <option value={2}>2 Cores (Basic)</option>
            <option value={4}>4 Cores (Balanced)</option>
            <option value={8}>8 Cores (Performance)</option>
            <option value={16}>16 Cores (Workstation)</option>
          </select>
        </div>

        {/* RAM Size */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
          <div className="text-neutral-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Пам'ять RAM:</span>
          </div>
          <select
            value={current.ramMb}
            onChange={(e) => updateField('ramMb', Number(e.target.value))}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
          >
            <option value={1024}>1024 MB (1 GB)</option>
            <option value={2048}>2048 MB (2 GB)</option>
            <option value={4096}>4096 MB (4 GB Standard)</option>
            <option value={8192}>8192 MB (8 GB Recommended)</option>
            <option value={16384}>16384 MB (16 GB Pro)</option>
          </select>
        </div>

        {/* Virtual Disk NVMe */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
          <div className="text-neutral-400 flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Диск NVMe:</span>
          </div>
          <select
            value={current.diskGb}
            onChange={(e) => updateField('diskGb', Number(e.target.value))}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-bold text-xs focus:outline-none focus:border-amber-400"
          >
            <option value={32}>32 GB (Btrfs / Ext4)</option>
            <option value={64}>64 GB (Recommended)</option>
            <option value={128}>128 GB (Large Root)</option>
            <option value={256}>256 GB (Developer)</option>
          </select>
        </div>

        {/* Hostname */}
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl space-y-1">
          <div className="text-neutral-400 flex items-center gap-1">
            <Settings className="w-3.5 h-3.5 text-purple-400" />
            <span>Ім'я хоста:</span>
          </div>
          <input
            type="text"
            value={current.hostname}
            onChange={(e) => updateField('hostname', e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            placeholder="ubuntu26-vm"
          />
        </div>
      </div>

      {/* Advanced Capabilities Toggles */}
      <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={current.enableNpu}
            onChange={(e) => updateField('enableNpu', e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
          />
          <span className="text-neutral-200 font-medium flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5 text-amber-400" />
            <span>Virtual NPU AI Accelerator (ONNX / Torch)</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={current.enableDocker}
            onChange={(e) => updateField('enableDocker', e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
          />
          <span className="text-neutral-200 font-medium flex items-center gap-1">
            <Box className="w-3.5 h-3.5 text-sky-400" />
            <span>Docker Engine 27.x Runtime</span>
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={current.enableWayland}
            onChange={(e) => updateField('enableWayland', e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
          />
          <span className="text-neutral-200 font-medium flex items-center gap-1">
            <Monitor className="w-3.5 h-3.5 text-emerald-400" />
            <span>GNOME 50 Wayland Graphics 3D</span>
          </span>
        </label>
      </div>
    </div>
  );
}
