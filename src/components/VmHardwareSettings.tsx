import React from 'react';
import { VmHardwareConfig, CpuProfile, BootOrderOption } from '../types';
import { Cpu, HardDrive, Volume2, VolumeX, MousePointer, Gauge, Sparkles, Sliders, Check } from 'lucide-react';

interface Props {
  hardware: VmHardwareConfig;
  onChange: (updated: VmHardwareConfig) => void;
  compact?: boolean;
}

const CPU_PROFILES: { id: CpuProfile; title: string; subtitle: string; mhz: string; defaultRam: number; category: string }[] = [
  {
    id: '386',
    title: 'Intel 80386DX',
    subtitle: 'Класичний 32-бітний DOS (1988)',
    mhz: '33 MHz',
    defaultRam: 16,
    category: 'Legacy 386/486',
  },
  {
    id: '486',
    title: 'Intel 80486DX4',
    subtitle: '16KB L1 Cache, FPU (DOOM, Duke 3D)',
    mhz: '100 MHz',
    defaultRam: 32,
    category: 'Legacy 386/486',
  },
  {
    id: 'pentium',
    title: 'Intel Pentium MMX',
    subtitle: 'SVGA, Quake, Blood, Build Engine',
    mhz: '166 MHz',
    defaultRam: 64,
    category: 'Pentium Classic',
  },
  {
    id: 'pentium_pro',
    title: 'Intel Pentium Pro',
    subtitle: '256KB Full-speed L2 Cache, x86',
    mhz: '200 MHz',
    defaultRam: 128,
    category: 'Pentium Classic',
  },
  {
    id: 'pentium_2',
    title: 'Intel Pentium II',
    subtitle: 'Slot 1 Klamath/Deschutes (512KB Cache)',
    mhz: '400 MHz',
    defaultRam: 256,
    category: 'High Performance',
  },
  {
    id: 'pentium_3',
    title: 'Intel Pentium III',
    subtitle: 'Coppermine 1.0 GHz, SSE Streaming SIMD',
    mhz: '1.0 GHz',
    defaultRam: 256,
    category: 'High Performance',
  },
  {
    id: 'pentium_4',
    title: 'Intel Pentium 4 Extreme',
    subtitle: 'NetBurst / Hyper-Threading JIT',
    mhz: '2.4+ GHz',
    defaultRam: 512,
    category: 'Extreme / Overclock',
  },
  {
    id: 'amd_k6',
    title: 'AMD K6-2 / Athlon',
    subtitle: 'Super Socket 7 / 3DNow! Enhanced',
    mhz: '500 MHz',
    defaultRam: 256,
    category: 'High Performance',
  },
  {
    id: 'turbo_max',
    title: 'Quantum JIT Turbo (Uncapped)',
    subtitle: 'Максимальна необмежена швидкість браузера',
    mhz: 'MAX GHz',
    defaultRam: 512,
    category: 'Extreme / Overclock',
  },
];

const RAM_OPTIONS = [16, 32, 64, 128, 256, 512, 1024, 2048];
const WINCHESTER_SIZES = [32, 64, 128, 256, 512, 1024, 2048];
const VGA_OPTIONS = [4, 8, 16, 32];

export default function VmHardwareSettings({ hardware, onChange, compact = false }: Props) {
  const handleCpuSelect = (cpu: CpuProfile) => {
    const profile = CPU_PROFILES.find(p => p.id === cpu);
    onChange({
      ...hardware,
      cpuProfile: cpu,
      // Suggest balanced RAM for this CPU if current RAM is lower than default
      memoryMb: profile ? Math.max(hardware.memoryMb, profile.defaultRam) : hardware.memoryMb,
    });
  };

  return (
    <div className={`space-y-5 text-left ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2 text-sky-400 font-semibold">
          <Sliders className="w-4 h-4" />
          <span>Апаратна конфігурація віртуальної машини (Hardware)</span>
        </div>
        <span className="text-[11px] text-neutral-500 font-mono">x86 / IA-32 Virtual Hardware</span>
      </div>

      {/* 1. CPU Profile Selection */}
      <div>
        <label className="block text-neutral-300 font-medium mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>Процесор (Потужні моделі CPU)</span>
          </span>
          <span className="text-xs text-sky-400 font-mono font-bold">
            {CPU_PROFILES.find(p => p.id === hardware.cpuProfile)?.title} ({CPU_PROFILES.find(p => p.id === hardware.cpuProfile)?.mhz})
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {CPU_PROFILES.map(profile => {
            const isSelected = hardware.cpuProfile === profile.id;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleCpuSelect(profile.id)}
                className={`p-2.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-sky-500/15 border-sky-500/50 shadow-sm shadow-sky-500/10 ring-1 ring-sky-500/30'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-xs ${isSelected ? 'text-sky-300' : 'text-white'}`}>
                    {profile.title}
                  </span>
                  <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                    isSelected ? 'bg-sky-500/30 text-sky-200' : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {profile.mhz}
                  </span>
                </div>
                <div className="text-[10px] text-neutral-400 leading-tight">
                  {profile.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. RAM Memory Selection */}
      <div>
        <label className="block text-neutral-300 font-medium mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>Оперативна пам'ять (RAM)</span>
          </span>
          <span className="text-xs font-mono font-bold text-emerald-400">
            {hardware.memoryMb} MB
          </span>
        </label>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {RAM_OPTIONS.map(ram => {
            const isSelected = hardware.memoryMb === ram;
            return (
              <button
                key={ram}
                type="button"
                onClick={() => onChange({ ...hardware, memoryMb: ram })}
                className={`py-2 px-1 rounded-xl text-center font-mono font-medium transition-all border ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <div className="text-xs sm:text-sm font-bold">{ram} MB</div>
                <div className="text-[8px] text-neutral-500">
                  {ram <= 32 ? 'DOS' : ram <= 128 ? 'Win95' : 'Turbo'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Winchester (HDD) & IDE Controller Configuration */}
      <div className="p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
            <HardDrive className="w-4 h-4" />
            <span>Емуляція вінчестера (IDE / ATA Winchester Hard Disk)</span>
          </div>
          <span className="text-[10px] text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {hardware.winchesterSizeMb || 64} MB FAT16 • LBA Mode
          </span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {WINCHESTER_SIZES.map(size => {
            const isSelected = (hardware.winchesterSizeMb || 64) === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ ...hardware, winchesterSizeMb: size })}
                className={`py-1.5 rounded-lg text-center font-mono text-xs transition-all border ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {size >= 1024 ? '1.0 GB' : `${size} MB`}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. VGA Memory and Boot Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
        {/* VGA Video Memory */}
        <div>
          <label className="block text-neutral-300 font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-purple-400" />
              <span>Відеопам'ять (VGA VRAM)</span>
            </span>
            <span className="text-xs font-mono font-bold text-purple-400">
              {hardware.vgaMemoryMb} MB
            </span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {VGA_OPTIONS.map(vram => {
              const isSelected = hardware.vgaMemoryMb === vram;
              return (
                <button
                  key={vram}
                  type="button"
                  onClick={() => onChange({ ...hardware, vgaMemoryMb: vram })}
                  className={`py-1.5 rounded-lg text-center font-mono text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {vram} MB
                </button>
              );
            })}
          </div>
        </div>

        {/* Boot Order Priority */}
        <div>
          <label className="block text-neutral-300 font-medium mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Пріоритет завантаження (Boot Order)</span>
            </span>
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ ...hardware, bootOrder: 'c_first' })}
              className={`py-1.5 px-2 rounded-lg text-center text-xs font-semibold transition-all border ${
                hardware.bootOrder === 'c_first'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Вінчестер C: (HDD)
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...hardware, bootOrder: 'a_first' })}
              className={`py-1.5 px-2 rounded-lg text-center text-xs font-semibold transition-all border ${
                hardware.bootOrder === 'a_first'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              Дискета A: (Floppy)
            </button>
          </div>
        </div>
      </div>

      {/* 5. Peripheral Toggles: Speaker & Mouse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-800/80">
        <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
          <div className="flex items-center gap-2.5">
            {hardware.enableSpeaker ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-neutral-500" />
            )}
            <div>
              <div className="font-semibold text-neutral-200 text-xs">PC Speaker & Audio</div>
              <div className="text-[10px] text-neutral-500">Емуляція системного динаміка DOS</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={hardware.enableSpeaker}
            onChange={e => onChange({ ...hardware, enableSpeaker: e.target.checked })}
            className="w-4 h-4 rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-neutral-800 border-neutral-700 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors">
          <div className="flex items-center gap-2.5">
            <MousePointer className="w-4 h-4 text-sky-400" />
            <div>
              <div className="font-semibold text-neutral-200 text-xs">PS/2 Mouse</div>
              <div className="text-[10px] text-neutral-500">Захоплення курсора при кліку</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={hardware.enableMouse}
            onChange={e => onChange({ ...hardware, enableMouse: e.target.checked })}
            className="w-4 h-4 rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-neutral-800 border-neutral-700 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
}

