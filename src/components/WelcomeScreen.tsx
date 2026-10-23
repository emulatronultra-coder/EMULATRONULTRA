import React, { useState } from 'react';
import {
  EmulatorConfig,
  VmHardwareConfig,
  DEFAULT_VM_HARDWARE,
  IbmPcBootOs,
  SystemCore,
  UbuntuVmConfig,
  DEFAULT_UBUNTU_26_CONFIG,
} from '../types';
import VmHardwareSettings from './VmHardwareSettings';
import UbuntuConfigPanel from './UbuntuConfigPanel';
import {
  createAtari2600DemoRom,
  createAtari5200DemoRom,
  createAtari7800DemoRom,
  createAtariLynxDemoRom,
  createAtari8BitDemoRom,
  createAtariStDemoRom,
} from '../utils/atariDemos';
import { createNesColorBarsTestRom } from '../lib/ai-bridge/testRoms';
import { createMameTestRom, createNeoGeoBiosDemo, FAMOUS_MAME_GAMES } from '../utils/mameDemos';
import {
  Upload,
  Play,
  AlertCircle,
  FileDigit,
  Monitor,
  Gamepad2,
  FolderOpen,
  Loader2,
  CheckCircle2,
  Cpu,
  Sliders,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Volume2,
  Disc,
  Trash2,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Plus,
  Info,
  Terminal,
} from 'lucide-react';

interface Props {
  config: EmulatorConfig;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAddDiskFiles?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveDisk?: (index: number) => void;
  onReorderDisks?: (from: number, to: number) => void;
  onClearDisks?: () => void;
  onZipUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBiosUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBios?: () => void;
  onToggleCustomBoot?: (custom: boolean) => void;
  onChangeBootOs?: (os: IbmPcBootOs) => void;
  onHardwareChange?: (updated: VmHardwareConfig) => void;
  onUbuntuConfigChange?: (updated: UbuntuVmConfig) => void;
  onPlay: () => void;
  onImportCloneFile?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLoadPresetFile?: (file: File) => void;
  onSelectCore?: (core: SystemCore) => void;
  error: string | null;
  isProcessing: boolean;
}

const CPU_SHORT_LABELS: Record<string, string> = {
  '386': '386DX (33 MHz)',
  '486': '486DX4 (100 MHz)',
  'pentium': 'Pentium (133 MHz)',
  'pentium_pro': 'Pentium Pro (200+ MHz)',
};

const DISK_DRIVE_LABELS = ['DF0:', 'DF1:', 'DF2:', 'DF3:', 'DF4:', 'DF5:'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function WelcomeScreen({
  config,
  onFileUpload,
  onAddDiskFiles,
  onRemoveDisk,
  onReorderDisks,
  onClearDisks,
  onZipUpload,
  onBiosUpload,
  onRemoveBios,
  onToggleCustomBoot,
  onChangeBootOs,
  onHardwareChange,
  onUbuntuConfigChange,
  onPlay,
  onImportCloneFile,
  onLoadPresetFile,
  onSelectCore,
  error,
  isProcessing,
}: Props) {
  const [showHardwarePanel, setShowHardwarePanel] = useState<boolean>(false);
  const isIbmPc = config.core === 'ibmpc';
  const isUbuntu = config.core === 'ubuntulinux';
  const currentBootOs: IbmPcBootOs = config.bootOs || (config.customBoot ? 'custom' : 'msdos');
  const isCustomBoot = currentBootOs === 'custom';
  const hw = config.hardwareConfig || DEFAULT_VM_HARDWARE;

  const diskFiles = config.romFiles && config.romFiles.length > 0
    ? config.romFiles
    : config.romFile
    ? [config.romFile]
    : [];

  const isMultiDiskGame = diskFiles.length > 1;

  const canPlay = (isIbmPc || isUbuntu)
    ? isCustomBoot
      ? !!config.osFile
      : true // Built-in OS / Ubuntu Linux VM can boot anytime!
    : config.core === 'mame'
    ? (!!config.romFile || diskFiles.length > 0 || !!config.biosFile)
    : !!config.romFile || diskFiles.length > 0;

  const isAtariCore = ['atari2600', 'atari5200', 'atari7800', 'atariLynx', 'atariJaguar'].includes(config.core);

  const isMameAtariFile =
    config.core === 'mame' &&
    ((config.romFile && /(a800|atari800|atari400|atarixl|atarixe|5200\.rom)/i.test(config.romFile.name)) ||
      (config.biosFile && /(a800|atari800|atari400|atarixl|atarixe|5200\.rom)/i.test(config.biosFile.name)) ||
      diskFiles.some(f => /(a800|atari800|atari400|atarixl|atarixe|5200\.rom)/i.test(f.name)));

  const detectedAtariName =
    config.romFile && /(a800|atari800|atari400|atarixl|atarixe|5200\.rom)/i.test(config.romFile.name)
      ? config.romFile.name
      : config.biosFile && /(a800|atari800|atari400|atarixl|atarixe|5200\.rom)/i.test(config.biosFile.name)
      ? config.biosFile.name
      : 'a800.zip';

  return (
    <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full py-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 sm:p-10 w-full shadow-2xl relative overflow-hidden">
        {/* Decorative Background */}
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neutral-800 rounded-2xl flex items-center justify-center mb-5 shadow-inner border border-neutral-700/50 text-neutral-400">
            {isUbuntu ? (
              <Terminal className="w-9 h-9 text-amber-400" />
            ) : isIbmPc ? (
              <Cpu className="w-9 h-9 text-sky-400" />
            ) : config.core === 'amiga' ? (
              <Disc className="w-9 h-9 text-sky-400" />
            ) : isAtariCore ? (
              <Gamepad2 className="w-9 h-9 text-amber-400" />
            ) : (
              <FileDigit className="w-9 h-9" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {isUbuntu
              ? 'Ubuntu Linux 26.04 LTS (Next-Gen VM)'
              : isIbmPc
              ? 'IBM PC & MS-DOS Virtual Machine'
              : config.core === 'amiga'
              ? 'Commodore Amiga (A500 / A600 / A1200)'
              : config.core === 'c64'
              ? 'Commodore 64 (C64 / SID)'
              : config.core === 'pet'
              ? 'Commodore PET'
              : config.core === 'atari2600'
              ? 'Atari 2600 (VCS)'
              : config.core === 'atari5200'
              ? 'Atari 5200 SuperSystem'
              : config.core === 'atari7800'
              ? 'Atari 7800 ProSystem'
              : config.core === 'atariLynx'
              ? 'Atari Lynx (16-Bit Handheld)'
              : config.core === 'atariJaguar'
              ? 'Atari Jaguar (64-Bit)'
              : config.core === 'mame'
              ? 'MAME (Arcade Classics / Cabinet)'
              : 'Load Software'}
          </h2>
          <p className="text-neutral-400 mb-5 max-w-md text-xs sm:text-sm leading-relaxed">
            {isUbuntu
              ? 'Повноцінна віртуальна машина Ubuntu Linux 26.04 LTS (Kernel 6.14). Bash-термінал, GNOME 50 Wayland, нейроприскорювач Virtual NPU, менеджер APT, Python 3.13, GCC 14, Docker 27 та монітор процесів.'
              : isIbmPc
              ? 'Вбудований MS-DOS 6.22 готовий до роботи. Налаштовуйте процесор, памʼять та завантажуйте DOS-ігри чи образи дисків.'
              : config.core === 'amiga'
              ? 'Підтримуються одно- та багатодискові ігри (2, 3 або 4 дискети .adf, .dms, .ipf або .zip). Чипсети OCS, ECS та AGA.'
              : config.core === 'c64'
              ? 'Завантажте образ диска (.d64, .g64), касетної стрічки (.tap, .t64) або картриджа (.crt, .prg, .zip).'
              : config.core === 'pet'
              ? 'Завантажте образ програми чи диска (.prg, .d64, .d80, .tap, .zip).'
              : config.core === 'atari2600'
              ? 'Легендарна консоль Atari 2600 VCS. Підтримуються картриджі у форматах .a26, .bin, .rom або .zip (ядро Stella).'
              : config.core === 'atari5200'
              ? 'Консоль Atari 5200 SuperSystem. Завантажуйте картриджі .a52, .bin, .rom, .zip та опціональний BIOS 5200.rom.'
              : config.core === 'atari7800'
              ? 'Atari 7800 ProSystem зі зворотною сумісністю. Підтримуються образи .a78, .bin або .zip (ядро ProSystem).'
              : config.core === 'atariLynx'
              ? '16-бітна кольорова кишенькова консоль Atari Lynx. Підтримуються образи .lnx, .lyx, .zip та опціональний BIOS lynxboot.img (ядро Handy).'
              : config.core === 'atariJaguar'
              ? '64-бітна інтерактивна мультимедійна система Atari Jaguar. Підтримуються образи .j64, .jag, .rom, .bin або .zip.'
              : config.core === 'mame'
              ? 'Multiple Arcade Machine Emulator (MAME 2003 / Arcade Cabinet). Завантажуйте будь-які образи аркадних автоматів у ZIP архівах (pacman.zip, galaga.zip, dkong.zip, sf2.zip, 1942.zip, bublbobl.zip, mslug.zip, tmnt.zip).'
              : 'Виберіть сумісний ROM або образ диска для поточної системи для запуску емуляції.'}
          </p>

          {/* Commodore Amiga Kickstart BIOS Management Card */}
          {config.core === 'amiga' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">Amiga Kickstart ROM (kick34005.A500):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Kickstart 1.3/3.1 підключено
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      <AlertCircle className="w-3.5 h-3.5" /> Рекомендується для Amiga 500
                    </span>
                  )}
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                      <div className="text-[10px] text-emerald-400/80">Автоматично змонтовано як kick34005.A500 / kick40068.A1200</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveBios}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Видалити Kickstart"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".rom,.bin,.a500,.a1200,.kick"
                    onChange={onBiosUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="border border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-900/60 hover:bg-amber-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                      <div>
                        <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                          Завантажити Kickstart 1.3 / 3.1 ROM
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          kick34005.A500, kick13.rom або kick40068.A1200 (256/512 KB)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                      .rom, .bin, .a500
                    </span>
                  </div>
                </div>
              )}
              <div className="text-[10px] text-neutral-400 mt-2 leading-normal">
                💡 <span className="text-neutral-300 font-medium">Підказка:</span> Якщо емулятор запитує <i>"kick 34005 A500 not found"</i>, виберіть файл Kickstart 1.3 тут або просто перетягніть його у вікно разом з файлами гри (.adf).
              </div>
            </div>
          )}

          {/* Atari 5200 BIOS Management Card */}
          {config.core === 'atari5200' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">Atari 5200 OS BIOS (5200.rom):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> 5200.rom підключено
                    </span>
                  ) : (
                    <span className="text-neutral-400 flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700">
                      <Info className="w-3.5 h-3.5 text-amber-400" /> Опціонально для багатьох ROM
                    </span>
                  )}
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                      <div className="text-[10px] text-emerald-400/80">Автоматично змонтовано як system/5200.rom</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveBios}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Видалити BIOS"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".rom,.bin,.bios"
                    onChange={onBiosUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="border border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-900/60 hover:bg-amber-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                      <div>
                        <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                          Завантажити Atari 5200 BIOS (5200.rom)
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          5200.rom або ATARI5200.ROM (2 KB)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                      .rom, .bin
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atari Lynx BIOS Management Card */}
          {config.core === 'atariLynx' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">Atari Lynx Boot ROM (lynxboot.img):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Boot ROM підключено
                    </span>
                  ) : (
                    <span className="text-neutral-400 flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700">
                      <Info className="w-3.5 h-3.5 text-amber-400" /> Опціонально (512 байт)
                    </span>
                  )}
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                      <div className="text-[10px] text-emerald-400/80">Змонтовано як system/lynxboot.img</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveBios}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Видалити BIOS"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".img,.rom,.bin"
                    onChange={onBiosUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="border border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-900/60 hover:bg-amber-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                      <div>
                        <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                          Завантажити Lynx Boot Image (lynxboot.img)
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          lynxboot.img (512 байт, ядро Handy)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                      .img, .rom
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atari ST TOS ROM Management Card */}
          {config.core === 'atarist' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">Atari ST TOS BIOS (tos.img / EmuTOS):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> TOS підключено
                    </span>
                  ) : (
                    <span className="text-neutral-400 flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700">
                      <Info className="w-3.5 h-3.5 text-amber-400" /> Вбудований EmuTOS або завантажте TOS 1.02/1.04/2.06
                    </span>
                  )}
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                      <div className="text-[10px] text-emerald-400/80">Змонтовано як tos.img для Hatari</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveBios}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Видалити TOS"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".img,.rom,.bin,.tos"
                    onChange={onBiosUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="border border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-900/60 hover:bg-amber-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                      <div>
                        <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                          Завантажити власний TOS ROM (tos.img / tos104.img)
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          TOS 1.02, 1.04, 2.06 або EmuTOS (192 KB / 256 KB / 512 KB)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                      .img, .rom, .bin
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atari 8-Bit OS ROM Management Card */}
          {config.core === 'atari8bit' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-neutral-200">Atari 800/XL OS BIOS (ATARIXL.ROM):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> OS ROM підключено
                    </span>
                  ) : (
                    <span className="text-neutral-400 flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700">
                      <Info className="w-3.5 h-3.5 text-amber-400" /> Опціонально (ATARIXL.ROM / ATARIBAS.ROM)
                    </span>
                  )}
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                      <div className="text-[10px] text-emerald-400/80">Змонтовано як ATARIXL.ROM для Atari800</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveBios}
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Видалити OS ROM"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative group cursor-pointer">
                  <input
                    type="file"
                    accept=".rom,.bin"
                    onChange={onBiosUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div className="border border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-900/60 hover:bg-amber-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-neutral-400 group-hover:text-amber-400" />
                      <div>
                        <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                          Завантажити Atari XL/XE OS (ATARIXL.ROM)
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          ATARIXL.ROM, ATARIOSB.ROM або ATARIBAS.ROM (8 KB / 16 KB)
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                      .rom, .bin
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Guidance Banner when Atari computer ROM (e.g. a800.zip) is loaded into MAME */}
          {isMameAtariFile && (
            <div className="w-full mb-5 p-4 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl text-left shadow-xl animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-emerald-200 uppercase tracking-wide">
                      🕹️ Підключено драйвер Atari 8-bit ({detectedAtariName}) для MAME
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                      MAME Atari 800 Driver
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-200 leading-relaxed">
                    Файл <code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-emerald-300">{detectedAtariName}</code> готовий до запуску через ядро MAME! Натисніть кнопку <strong>«Грати»</strong> нижче, щоб запустити систему.
                  </p>
                  <div className="bg-black/30 p-2.5 rounded-xl border border-neutral-800 text-[11px] text-neutral-300 space-y-1">
                    <div><strong>⌨️ Керування в MAME при емуляції комп'ютера:</strong></div>
                    <ul className="list-disc list-inside space-y-0.5 text-neutral-400 text-[10px]">
                      <li><strong className="text-amber-300">ScrLk (Scroll Lock)</strong> — перемикання між введенням з клавіатури в комп'ютер та гарячими клавішами MAME.</li>
                      <li><strong className="text-cyan-300">Tab (Menu)</strong> — конфігурація клавіш, перемикачів та дисководів у MAME.</li>
                      <li><strong className="text-emerald-300">F1 / F2 / F3</strong> — клавіші Start, Select та Option на Atari 800.</li>
                    </ul>
                  </div>

                  {onSelectCore && (
                    <div className="pt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-neutral-400">Додатково:</span>
                      <button
                        type="button"
                        onClick={() => onSelectCore('atari8bit')}
                        className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 font-medium text-[11px] transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Перемкнутися на спеціалізований емулятор Atari++"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>Відкрити також в Atari++ 1.84</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MAME Arcade System BIOS Management Card */}
          {config.core === 'mame' && (
            <div className="w-full mb-5 bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left shadow-lg">
              <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Disc className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-neutral-200">MAME Arcade System BIOS (neogeo.zip / qsound.zip / pgm.zip):</span>
                </div>
                <div className="text-[11px] font-medium text-neutral-400">
                  {config.biosFile ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Arcade BIOS ({config.biosFile.name}) підключено
                    </span>
                  ) : (
                    <span className="text-neutral-400 flex items-center gap-1 bg-neutral-800/80 px-2 py-0.5 rounded-md border border-neutral-700">
                      <Info className="w-3.5 h-3.5 text-yellow-400" /> Опціонально для NeoGeo, CPS2, PGM
                    </span>
                  )}
                </div>
              </div>

              {/* Informational callout explaining MAME BIOS architecture */}
              <div className="mb-3 p-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-[11px] text-yellow-300/90 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-yellow-200">Як працює BIOS у MAME: </span>
                  У MAME файли BIOS (наприклад, <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-yellow-300">neogeo.zip</code>) є системною прошивкою плати. Вони автоматично монтуються в системну папку емулятора. Для запуску гри оберіть аркадний ROM (наприклад, <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-yellow-300">mslug.zip</code>, <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-yellow-300">kof98.zip</code> або <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-yellow-300">pacman.zip</code>). Якщо запустити MAME лише з BIOS без картриджа гри, ядро перейде в системне меню RetroArch (Load Content).
                </div>
              </div>

              {config.biosFile ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between bg-neutral-900 border border-emerald-500/30 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2.5 truncate">
                      <FileDigit className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs text-neutral-200 font-mono truncate font-medium">{config.biosFile.name}</div>
                        <div className="text-[10px] text-emerald-400/80">Змонтовано в системну директорію RetroArch (/system/{config.biosFile.name})</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onRemoveBios}
                      className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Видалити BIOS"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {!config.romFile && (
                    <div className="p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-xl flex flex-col gap-2 text-xs">
                      <div className="text-neutral-300 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>BIOS завантажено. Додайте файл аркадної гри нижче або відкрийте емулятор:</span>
                      </div>
                      <button
                        type="button"
                        onClick={onPlay}
                        className="w-full py-2 px-3 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-98"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-yellow-400" />
                        <span>Відкрити MAME з цим BIOS (Системний вибір контенту)</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="relative group cursor-pointer">
                    <input
                      type="file"
                      accept=".zip,.rom,.bin"
                      onChange={onBiosUpload}
                      disabled={isProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className="border border-dashed border-neutral-700 hover:border-yellow-500/70 bg-neutral-900/60 hover:bg-yellow-500/5 rounded-xl px-3 py-3 flex items-center justify-between transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Upload className="w-4 h-4 text-neutral-400 group-hover:text-yellow-400" />
                        <div>
                          <div className="text-xs text-neutral-300 group-hover:text-white font-medium">
                            Завантажити системний BIOS аркади (neogeo.zip, qsound.zip, pgm.zip)
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            Необхідно для ігор SNK NeoGeo (Metal Slug, KOF), Capcom CPS2 та IGS PGM
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
                        .zip
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Load Homebrew / Test Demo for Atari & MAME */}
          {(config.core === 'nes' || config.core === 'famicom' || config.core === 'atari2600' || config.core === 'atari5200' || config.core === 'atari7800' || config.core === 'atariLynx' || config.core === 'atari8bit' || config.core === 'atarist' || config.core === 'mame') && !config.romFile && (
            <div className="w-full mb-5 flex flex-col items-center justify-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  let demoFile: File | null = null;
                  if (config.core === 'nes' || config.core === 'famicom') demoFile = createNesColorBarsTestRom();
                  else if (config.core === 'atari2600') demoFile = createAtari2600DemoRom();
                  else if (config.core === 'atari5200') demoFile = createAtari5200DemoRom();
                  else if (config.core === 'atari7800') demoFile = createAtari7800DemoRom();
                  else if (config.core === 'atariLynx') demoFile = createAtariLynxDemoRom();
                  else if (config.core === 'atari8bit') demoFile = createAtari8BitDemoRom();
                  else if (config.core === 'atarist') demoFile = createAtariStDemoRom();
                  else if (config.core === 'mame') demoFile = await createMameTestRom();
                  if (demoFile && onLoadPresetFile) {
                    onLoadPresetFile(demoFile);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  Завантажити тестове демо (
                  {config.core === 'nes' || config.core === 'famicom'
                    ? 'NES Color Pattern & Hardware Test'
                    : config.core === 'mame'
                    ? 'MAME Arcade Test Suite & Matrix'
                    : config.core === 'atarist'
                    ? 'Atari ST GEMDOS Color Test'
                    : config.core === 'atari8bit'
                    ? 'Atari 8-Bit XEX Color Test'
                    : config.core === 'atariLynx'
                    ? 'Atari Lynx Color Test'
                    : 'Rainbow / Color Test'}
                  )
                </span>
              </button>
            </div>
          )}

          {/* MAME Arcade Famous ROM Catalog Reference */}
          {config.core === 'mame' && !config.romFile && (
            <div className="w-full mb-6 bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 text-left">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs font-bold text-neutral-200">Популярні ігри MAME 2003 (Аркадні автомати):</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-mono">MAME 0.78 ROMSet</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {FAMOUS_MAME_GAMES.map(game => (
                  <div key={game.id} className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-3 hover:border-yellow-500/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-extrabold text-neutral-100 truncate">{game.name}</span>
                        <span className="text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded shrink-0">
                          {game.zipName}
                        </span>
                      </div>
                      <div className="text-[10px] text-neutral-400 mb-1.5 flex items-center gap-2">
                        <span>🏛️ {game.manufacturer} ({game.year})</span>
                        <span>•</span>
                        <span>🕹️ {game.genre}</span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-normal mb-2">
                        {game.description}
                      </p>
                    </div>
                    <div className="text-[10px] text-neutral-400 bg-neutral-950/60 p-1.5 rounded-lg border border-neutral-800/60 font-mono flex items-center justify-between">
                      <span>🎮 {game.controls}</span>
                      <span className="text-yellow-400 font-sans font-bold">{game.players}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-neutral-400 mt-3 text-center">
                💡 <span className="text-neutral-300 font-medium">Як грати у власний аркадний автомат:</span> Просто перетягніть будь-який архів `.zip` (наприклад, <code>pacman.zip</code>, <code>sf2.zip</code>) у зону завантаження вище!
              </div>
            </div>
          )}

          {/* IBM PC OS Mode Selection Pills */}
          {isIbmPc && (
            <div className="w-full flex flex-col items-center gap-2.5 mb-5">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Операційна система / Завантажувач
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('ubuntu');
                    onToggleCustomBoot?.(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'ubuntu'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm ring-1 ring-amber-500/40 font-bold'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <Terminal className={`w-3.5 h-3.5 ${currentBootOs === 'ubuntu' ? 'text-amber-400' : 'opacity-40'}`} />
                  🚀 Ubuntu Linux (x86 Bare-Metal)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('debian');
                    onToggleCustomBoot?.(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'debian'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm ring-1 ring-rose-500/30'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <Terminal className={`w-3.5 h-3.5 ${currentBootOs === 'debian' ? 'text-rose-400' : 'opacity-40'}`} />
                  🍥 Debian GNU/Linux (i386)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('linux');
                    onToggleCustomBoot?.(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'linux'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm ring-1 ring-emerald-500/30'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <Terminal className={`w-3.5 h-3.5 ${currentBootOs === 'linux' ? 'text-emerald-400' : 'opacity-40'}`} />
                  🐧 Linux (Buildroot)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('msdos');
                    onToggleCustomBoot?.(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'msdos'
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sm'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 ${currentBootOs === 'msdos' ? 'text-sky-400' : 'opacity-40'}`} />
                  MS-DOS 6.22
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('freedos');
                    onToggleCustomBoot?.(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'freedos'
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sm'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <Disc className={`w-3.5 h-3.5 ${currentBootOs === 'freedos' ? 'text-sky-400' : 'opacity-40'}`} />
                  FreeDOS 7.22
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeBootOs?.('custom');
                    onToggleCustomBoot?.(true);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border cursor-pointer ${
                    currentBootOs === 'custom'
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-sm'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700/60 hover:text-neutral-200'
                  }`}
                >
                  <Cpu className={`w-3.5 h-3.5 ${currentBootOs === 'custom' ? 'text-sky-400' : 'opacity-40'}`} />
                  Власний образ (.img, .iso)
                </button>
              </div>

              {currentBootOs === 'ubuntu' && (
                <div className="w-full mt-1 px-3.5 py-2.5 bg-amber-950/30 border border-amber-800/50 rounded-xl text-left text-xs text-amber-200 flex items-start gap-2.5">
                  <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-100 flex items-center gap-1.5">
                      <span>Ubuntu Linux (x86 Bare-Metal Kernel VM)</span>
                      <span className="text-[10px] bg-amber-500 text-neutral-950 font-black px-1.5 py-0.2 rounded">v86 Engine</span>
                    </span>
                    <p className="text-[11px] text-amber-300/85 leading-relaxed">
                      Справжня низькорівнева емуляція апаратної платформи x86/IA-32 на базі WebAssembly. Завантажує реальне ядро Linux, SeaBIOS, контролер CD-ROM з підтримкою образів ISO та оперативною пам'яттю до 2048 МБ.
                    </p>
                  </div>
                </div>
              )}

              {currentBootOs === 'debian' && (
                <div className="w-full mt-1 px-3.5 py-2 bg-rose-950/30 border border-rose-800/40 rounded-xl text-left text-xs text-rose-300 flex items-start gap-2.5">
                  <Terminal className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-rose-200">Debian GNU/Linux (i386 Live):</span>
                    <p className="text-[11px] text-rose-300/80 leading-relaxed">
                      Повноцінний 32-бітний дистрибутив Debian GNU/Linux x86 з Linux ядром, оболонкою Bash, пакетом GNU утиліт (coreutils, nano, sed, awk), мережевим стеком та підтримкою змонтованих дисків. Рекомендовано 128-256 МБ RAM.
                    </p>
                  </div>
                </div>
              )}

              {currentBootOs === 'linux' && (
                <div className="w-full mt-1 px-3.5 py-2 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-left text-xs text-emerald-300 flex items-start gap-2.5">
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold text-emerald-200">Linux 3.x Live ISO:</span>
                    <p className="text-[11px] text-emerald-300/80 leading-relaxed">
                      Повноцінне ядро Linux x86 з командною оболонкою BusyBox (ash, vi, fdisk, wget, top). Завантажується безпосередньо у віртуальній машині v86.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ubuntu Linux VM Configuration Card */}
          {isUbuntu && (
            <div className="w-full mb-6 text-left">
              <UbuntuConfigPanel
                config={config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG}
                onChange={updated => onUbuntuConfigChange?.(updated)}
              />
            </div>
          )}

          {/* IBM PC Hardware Configuration Card */}
          {isIbmPc && (
            <div className="w-full mb-6 bg-neutral-950/60 border border-neutral-800 rounded-2xl overflow-hidden text-left">
              {/* Hardware Summary Header Bar */}
              <div
                onClick={() => setShowHardwarePanel(prev => !prev)}
                className="px-4 py-3 bg-neutral-900/90 hover:bg-neutral-800/60 transition-colors cursor-pointer flex items-center justify-between border-b border-neutral-800/80 select-none"
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-sky-400">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Залізо VM:</span>
                  </div>

                  {/* CPU pill */}
                  <span className="bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-md font-mono text-[11px] border border-neutral-700/60 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-sky-400" />
                    {CPU_SHORT_LABELS[hw.cpuProfile] || '486DX4'}
                  </span>

                  {/* RAM pill */}
                  <span className="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-mono text-[11px] border border-emerald-500/30 font-bold">
                    {hw.memoryMb} MB RAM
                  </span>

                  {/* VRAM pill */}
                  <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md font-mono text-[11px] border border-purple-500/30">
                    {hw.vgaMemoryMb} MB VRAM
                  </span>

                  {hw.enableSpeaker && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-neutral-400 text-[10px]">
                      <Volume2 className="w-3 h-3 text-emerald-400" />
                      Sound
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300">
                  <span className="text-[11px]">
                    {showHardwarePanel ? 'Згорнути' : 'Налаштувати'}
                  </span>
                  {showHardwarePanel ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Expandable Hardware Settings Body */}
              {showHardwarePanel && (
                <div className="p-5 border-t border-neutral-800/50 bg-neutral-950/80">
                  <VmHardwareSettings
                    hardware={hw}
                    onChange={updated => onHardwareChange?.(updated)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="w-full space-y-5">
            {!isIbmPc && (
              /* Features Information for classic consoles */
              <div className="flex gap-4 justify-center text-xs font-medium text-neutral-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" /> Shaders
                </span>
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5" /> Remapping
                </span>
                <span className="flex items-center gap-1.5">
                  <FileDigit className="w-3.5 h-3.5" /> Save States
                </span>
                {config.core === 'amiga' && (
                  <span className="flex items-center gap-1.5 text-amber-400/90 font-semibold">
                    <Layers className="w-3.5 h-3.5" /> Multi-Disk M3U
                  </span>
                )}
              </div>
            )}

            {/* MULTI-DISK / LOADED FILES CARD (When files are already selected) */}
            {!isIbmPc && diskFiles.length > 0 && !isProcessing && (
              <div className="w-full bg-neutral-950 border border-sky-500/30 rounded-2xl p-4 text-left shadow-lg">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-white">
                      {isMultiDiskGame ? `Багатодисковий комплект (${diskFiles.length} диски)` : 'Завантажений образ гри:'}
                    </span>
                    <span className="text-[11px] text-sky-400 font-semibold bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                      {config.gameName || 'Game'}
                    </span>
                  </div>
                  {onClearDisks && (
                    <button
                      type="button"
                      onClick={onClearDisks}
                      className="text-[11px] text-neutral-400 hover:text-red-400 transition-colors"
                    >
                      Очистити все
                    </button>
                  )}
                </div>

                {/* Disk Files List */}
                <div className="space-y-2 mb-3">
                  {diskFiles.map((file, idx) => (
                    <div
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between bg-neutral-900/90 border border-neutral-800 rounded-xl px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate min-w-0 pr-2">
                        <span className="shrink-0 bg-neutral-800 text-sky-400 border border-neutral-700 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                          {config.core === 'amiga' ? DISK_DRIVE_LABELS[idx] || `DF${idx}:` : `Диск ${idx + 1}`}
                        </span>
                        <span className="font-mono text-neutral-200 truncate">{file.name}</span>
                        <span className="text-[10px] text-neutral-500 shrink-0">({formatBytes(file.size)})</span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isMultiDiskGame && onReorderDisks && (
                          <>
                            <button
                              type="button"
                              onClick={() => onReorderDisks(idx, idx - 1)}
                              disabled={idx === 0}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 rounded transition-colors"
                              title="Перемістити вище"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onReorderDisks(idx, idx + 1)}
                              disabled={idx === diskFiles.length - 1}
                              className="p-1 text-neutral-400 hover:text-white disabled:opacity-20 disabled:hover:text-neutral-400 rounded transition-colors"
                              title="Перемістити нижче"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {onRemoveDisk && (
                          <button
                            type="button"
                            onClick={() => onRemoveDisk(idx)}
                            className="p-1 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            title="Видалити цей диск"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add More Disks Action Bar */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-neutral-800/80">
                  <div className="relative group cursor-pointer inline-flex">
                    <input
                      type="file"
                      multiple
                      accept=".adf,.dms,.ipf,.lha,.hdf,.d64,.g64,.t64,.tap,.prg,.zip"
                      onChange={onAddDiskFiles || onFileUpload}
                      disabled={isProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors pointer-events-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Додати ще один диск (Диск {diskFiles.length + 1})
                    </button>
                  </div>

                  <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>Зміна дисків у грі: через меню Disc Control</span>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Area (Dropzone) */}
            {(!diskFiles.length || isIbmPc) && !isUbuntu && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative group cursor-pointer flex-1">
                  <input
                    type="file"
                    multiple={!isIbmPc}
                    accept={
                      isIbmPc
                        ? isCustomBoot
                          ? '.img,.vhd,.bif,.iso,.bin'
                          : '.zip,.exe,.bat,.com,.img,.ima,.dsk,.vhd,.iso'
                        : '.nes,.sfc,.smc,.md,.gen,.sms,.gg,.gb,.gbc,.gba,.d64,.d80,.d82,.t64,.tap,.prg,.crt,.g64,.adf,.dms,.ipf,.lha,.hdf,.a26,.a52,.a78,.lnx,.lyx,.j64,.jag,.atr,.xfd,.atx,.xex,.cas,.car,.st,.msa,.stx,.dim,.tos,.rom,.bin,.zip,.exe,.bat,.com,.iso'
                    }
                    onChange={onFileUpload}
                    disabled={isProcessing}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                  />
                  <div
                    className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-2 h-full ${
                      config.romFile || config.osFile
                        ? 'border-sky-500/50 bg-sky-500/5'
                        : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 bg-neutral-950/50'
                    } ${isProcessing ? 'opacity-50' : ''}`}
                  >
                    {(config.romFile || config.osFile) && !isProcessing ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mb-1">
                          <FileDigit className="w-5 h-5" />
                        </div>
                        <div className="font-semibold text-white truncate max-w-full px-4 text-sm">
                          {(config.romFile || config.osFile)?.name}
                        </div>
                        <div className="text-[10px] text-sky-400 font-medium">
                          {isIbmPc && !isCustomBoot
                            ? 'Монтується з MS-DOS 6.22'
                            : 'Готово до запуску'}
                        </div>
                      </>
                    ) : isProcessing ? (
                      <>
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                        <div className="font-medium text-neutral-300 text-sm">Обробка та пакування дисків...</div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mb-1 group-hover:bg-neutral-700 group-hover:text-white transition-colors">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div className="font-medium text-neutral-300 text-sm text-center">
                          {isIbmPc
                            ? isCustomBoot
                              ? 'Виберіть завантажувальний образ ОС'
                              : 'Виберіть DOS гру або програму'
                            : config.core === 'amiga'
                            ? 'Виберіть 1, 2 або 3 файли дискет (.adf, .dms, .zip)'
                            : config.core === 'atari2600'
                            ? 'Виберіть картридж Atari 2600 (.a26, .bin, .rom)'
                            : config.core === 'atari5200'
                            ? 'Виберіть картридж Atari 5200 (.a52, .bin, .rom)'
                            : config.core === 'atari7800'
                            ? 'Виберіть картридж Atari 7800 (.a78, .bin)'
                            : config.core === 'atariLynx'
                            ? 'Виберіть картридж Atari Lynx (.lnx, .lyx, .zip)'
                            : config.core === 'atariJaguar'
                            ? 'Виберіть картридж Atari Jaguar (.j64, .jag, .rom)'
                            : config.core === 'atari8bit'
                            ? 'Виберіть дискету чи програму Atari 8-Bit (.atr, .xex, .xfd, .car)'
                            : config.core === 'atarist'
                            ? 'Виберіть дискету чи програму Atari ST (.st, .msa, .prg, .tos)'
                            : 'Виберіть файл гри / програми'}
                        </div>
                        <div className="text-[10px] text-neutral-500 text-center">
                          {isIbmPc
                            ? isCustomBoot
                              ? '.img, .vhd, .iso, .bin'
                              : '.zip, .exe, .com, .img, .ima (Опціонально)'
                            : config.core === 'c64'
                            ? '.d64, .t64, .tap, .prg, .crt, .zip'
                            : config.core === 'amiga'
                            ? 'Можна виділити кілька файлів одразу (.adf, .dms, .ipf, .zip)'
                            : config.core === 'pet'
                            ? '.prg, .d64, .d80, .tap, .zip'
                            : config.core === 'atari2600'
                            ? '.a26, .bin, .rom, .zip'
                            : config.core === 'atari5200'
                            ? '.a52, .bin, .rom, .zip (+ 5200.rom)'
                            : config.core === 'atari7800'
                            ? '.a78, .bin, .zip'
                            : config.core === 'atariLynx'
                            ? '.lnx, .lyx, .zip (+ lynxboot.img)'
                            : config.core === 'atariJaguar'
                            ? '.j64, .jag, .rom, .bin, .zip'
                            : config.core === 'atari8bit'
                            ? '.atr, .xex, .xfd, .cas, .car, .rom, .zip'
                            : config.core === 'atarist'
                            ? '.st, .msa, .stx, .dim, .prg, .tos, .zip'
                            : '.nes, .sfc, .md, .gg, .gb, .gba, .zip'}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {isIbmPc && !isCustomBoot && (
                  <div className="relative group cursor-pointer flex-1">
                    <input
                      type="file"
                      accept=".zip"
                      onChange={onZipUpload}
                      disabled={isProcessing}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div
                      className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center gap-2 h-full ${
                        config.zipFile
                          ? 'border-sky-500/50 bg-sky-500/5'
                          : 'border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800/50 bg-neutral-950/50'
                      }`}
                    >
                      {config.zipFile ? (
                        <>
                          <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mb-1">
                            <FolderOpen className="w-5 h-5" />
                          </div>
                          <div className="font-semibold text-white truncate max-w-full px-4 text-sm">
                            {config.zipFile.name}
                          </div>
                          <div className="text-[10px] text-sky-400 font-medium">
                            Монтується як Диск D:
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mb-1 group-hover:bg-neutral-700 group-hover:text-white transition-colors">
                            <FolderOpen className="w-5 h-5" />
                          </div>
                          <div className="font-medium text-neutral-300 text-sm text-center">
                            Додатковий ZIP (Опціонально)
                          </div>
                          <div className="text-[10px] text-neutral-500 text-center text-balance">
                            Монтується як Диск D:
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium text-left">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Play Button */}
            <button
              onClick={onPlay}
              disabled={!canPlay || isProcessing}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-lg font-bold transition-all duration-300 shadow-lg ${
                canPlay && !isProcessing
                  ? isUbuntu
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-sky-500 hover:bg-sky-400 text-neutral-950 shadow-sky-500/25 hover:shadow-sky-500/40 hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
                  <span>Підготовка системи...</span>
                </>
              ) : (
                <>
                  <Play className="w-6 h-6 fill-current" />
                  {isUbuntu
                    ? (config.ubuntuConfig?.bootSource === 'custom_iso' && (config.ubuntuConfig?.isoName || config.ubuntuConfig?.isoFile?.name))
                      ? `Запустити з ISO: ${config.ubuntuConfig.isoName || config.ubuntuConfig.isoFile?.name} (${(config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG).cpuCores} vCPU • ${(config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG).ramMb}MB RAM)`
                      : `Запустити Ubuntu 26 VM (${(config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG).cpuCores} vCPU • ${(config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG).ramMb}MB RAM • ${(config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG).edition.toUpperCase()})`
                    : isIbmPc
                    ? currentBootOs === 'linux'
                      ? `Запустити Linux Buildroot (${Math.max(hw.memoryMb, 64)}MB RAM)`
                      : currentBootOs === 'freedos'
                      ? `Запустити FreeDOS 7.22 (${hw.memoryMb}MB RAM)`
                      : config.osFile || config.zipFile
                      ? `Запустити IBM PC з ${(config.osFile || config.zipFile)?.name}`
                      : `Запустити MS-DOS 6.22 (${hw.memoryMb}MB RAM • ${CPU_SHORT_LABELS[hw.cpuProfile] || '486DX4'})`
                    : config.core === 'mame' && !config.romFile && config.biosFile
                    ? `Запустити MAME тільки з BIOS (${config.biosFile.name})`
                    : isMultiDiskGame
                    ? `Запустити гру (${diskFiles.length} диски)`
                    : 'Запустити емулятор'}
                </>
              )}
            </button>

            {/* Import Clone File Action */}
            {onImportCloneFile && (
              <div className="pt-2 flex items-center justify-center">
                <div className="relative group cursor-pointer inline-flex">
                  <input
                    type="file"
                    accept=".vmclone,.v86state,.json"
                    onChange={onImportCloneFile}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <button
                    type="button"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 pointer-events-none"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    Запустити збережений клон з файлу (.vmclone / .v86state)
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 text-center text-[11px] text-neutral-500 font-medium">
              {isIbmPc
                ? 'x86 Virtual Machine (SeaBIOS / v86) з налаштуванням процесора та памʼяті'
                : config.core === 'amiga'
                ? 'Для зміни дисків під час гри відкрийте меню емулятора (іконка меню внизу екрана) → Disc Control'
                : 'Hover over the emulator window and click the menu icon during gameplay to access save states, shaders, and input configuration.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
