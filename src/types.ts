export type SystemCore =
  | 'ubuntulinux'
  | 'nes'
  | 'famicom'
  | 'snes'
  | 'segaMD'
  | 'segaMS'
  | 'segaGG'
  | 'ibmpc'
  | 'gb'
  | 'gbc'
  | 'gba'
  | 'pet'
  | 'c64'
  | 'amiga'
  | 'atari2600'
  | 'atari5200'
  | 'atari7800'
  | 'atariLynx'
  | 'atariJaguar'
  | 'atari8bit'
  | 'atarist'
  | 'mame';

export type CpuProfile =
  | '386'
  | '486'
  | 'pentium'
  | 'pentium_pro'
  | 'pentium_2'
  | 'pentium_3'
  | 'pentium_4'
  | 'amd_k6'
  | 'turbo_max';
export type BootOrderOption = 'c_first' | 'a_first' | 'cd_first';
export type IbmPcBootOs = 'ubuntu' | 'debian' | 'linux' | 'freedos' | 'msdos' | 'custom';

export type UbuntuVersion = '26.04' | '24.04';
export type UbuntuEdition = 'desktop' | 'server' | 'ai-ml';
export type UbuntuKernel = '6.14.0-generic' | '7.0.0-rc-zen' | '6.8.0-generic';

export interface UbuntuVmConfig {
  version: UbuntuVersion;
  edition: UbuntuEdition;
  kernel: UbuntuKernel;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  hostname: string;
  enableNpu: boolean;
  enableDocker: boolean;
  enableWayland: boolean;
  theme: 'yaru-dark' | 'yaru-orange' | 'cosmic' | 'light';
  bootScript?: string;
  bootSource?: 'builtin' | 'custom_iso';
  isoFile?: File | null;
  isoName?: string;
  isoSize?: number;
}

export const DEFAULT_UBUNTU_26_CONFIG: UbuntuVmConfig = {
  version: '26.04',
  edition: 'desktop',
  kernel: '6.14.0-generic',
  cpuCores: 4,
  ramMb: 4096,
  diskGb: 64,
  hostname: 'ubuntu26-noble',
  enableNpu: true,
  enableDocker: true,
  enableWayland: true,
  theme: 'yaru-dark',
  bootScript: '#!/bin/bash\necho "Ubuntu 26.04 LTS Initialized"\n',
  bootSource: 'builtin',
  isoFile: null,
};

export interface StageRefHandle {
  getStateSnapshot: () => Promise<ArrayBuffer | null>;
}

export interface VmHardwareConfig {
  cpuProfile: CpuProfile;
  memoryMb: number; // 8, 16, 32, 64, 128, 256, 512
  vgaMemoryMb: number; // 2, 4, 8, 16
  enableSpeaker: boolean;
  enableMouse: boolean;
  bootOrder: BootOrderOption;
  acpi: boolean;
  fastboot: boolean;
  cpuMultiplier?: 1 | 2 | 4 | 8; // 1x, 2x, 4x, 8x Max Turbo
  winchesterSizeMb?: number; // 32, 64, 128, 256, 512, 1024
  ideMode?: 'lba' | 'chs';
}

export const DEFAULT_VM_HARDWARE: VmHardwareConfig = {
  cpuProfile: '486',
  memoryMb: 32,
  vgaMemoryMb: 8,
  enableSpeaker: true,
  enableMouse: true,
  bootOrder: 'c_first',
  acpi: false,
  fastboot: false,
  cpuMultiplier: 1,
  winchesterSizeMb: 64,
  ideMode: 'lba',
};

export const DEFAULT_UBUNTU_VM_HARDWARE: VmHardwareConfig = {
  cpuProfile: 'turbo_max',
  memoryMb: 128,
  vgaMemoryMb: 8,
  enableSpeaker: true,
  enableMouse: true,
  bootOrder: 'cd_first',
  acpi: true,
  fastboot: true,
  cpuMultiplier: 4,
  winchesterSizeMb: 512,
  ideMode: 'lba',
};

export interface DiskDataEntry {
  name: string;
  data: Uint8Array;
}

export interface EmulatorConfig {
  core: SystemCore;
  romFile: File | null; // For standard consoles & home computers (single file or primary entry)
  romFiles?: File[]; // For multi-disk / multi-file games (Amiga, C64, etc.)
  romBlob?: Blob | null; // In-memory bundle / blob
  romUrl: string | null;
  gameName: string;
  isMultiDisk?: boolean;
  disks?: DiskDataEntry[];
  m3uContent?: string;
  m3uFileName?: string;
  singleRomName?: string;
  biosFile?: File | null; // Optional BIOS / Kickstart ROM
  biosBlob?: Blob | null;
  biosUrl?: string | null;
  osFile?: File | null; // For IBM PC: game image (.img, .vhd, .iso) or custom OS
  zipFile?: File | null; // For IBM PC: game ZIP archive
  bootOs?: IbmPcBootOs; // Built-in OS selection: 'msdos' | 'freedos' | 'linux' | 'custom'
  customBoot?: boolean; // false = use built-in OS (default), true = boot user image directly
  hardwareConfig?: VmHardwareConfig; // VM Hardware Configuration
  ubuntuConfig?: UbuntuVmConfig; // Ubuntu Linux 26 / 24 VM Configuration
  initialState?: ArrayBuffer | null; // v86 / VM memory snapshot state buffer for machine clone & restore
}

export interface VmTab {
  id: string;
  title: string;
  core: SystemCore;
  config: EmulatorConfig;
  isPlaying: boolean;
  isProcessing: boolean;
  error: string | null;
  createdAt: number;
}

export const SUPPORTED_SYSTEMS: { id: SystemCore; name: string; icon: string }[] = [
  { id: 'ubuntulinux', name: 'Ubuntu Linux VM', icon: 'Terminal' },
  { id: 'ibmpc', name: 'IBM PC (v86)', icon: 'Cpu' },
  { id: 'c64', name: 'Commodore 64 (C64)', icon: 'Monitor' },
  { id: 'amiga', name: 'Commodore Amiga', icon: 'Monitor' },
  { id: 'pet', name: 'Commodore PET', icon: 'Monitor' },
  { id: 'famicom', name: 'Famicom / Dendy (4-Button Turbo NES)', icon: 'Gamepad2' },
  { id: 'nes', name: 'Nintendo (NES / Famicom)', icon: 'Gamepad2' },
  { id: 'snes', name: 'Super Nintendo (SNES)', icon: 'Gamepad2' },
  { id: 'segaMD', name: 'SEGA Mega Drive / Genesis', icon: 'Gamepad2' },
  { id: 'segaMS', name: 'SEGA Master System', icon: 'Gamepad2' },
  { id: 'segaGG', name: 'SEGA Game Gear', icon: 'Gamepad2' },
  { id: 'gb', name: 'Game Boy (GB)', icon: 'Gamepad2' },
  { id: 'gbc', name: 'Game Boy Color (GBC)', icon: 'Gamepad2' },
  { id: 'gba', name: 'Game Boy Advance (GBA)', icon: 'Gamepad2' },
  { id: 'atari2600', name: 'Atari 2600 (VCS)', icon: 'Gamepad2' },
  { id: 'atari5200', name: 'Atari 5200 SuperSystem', icon: 'Gamepad2' },
  { id: 'atari7800', name: 'Atari 7800 ProSystem', icon: 'Gamepad2' },
  { id: 'atariLynx', name: 'Atari Lynx (Handheld)', icon: 'Gamepad2' },
  { id: 'atariJaguar', name: 'Atari Jaguar (64-Bit)', icon: 'Gamepad2' },
  { id: 'atari8bit', name: 'Atari 8-bit (400/800/XL/XE)', icon: 'Monitor' },
  { id: 'atarist', name: 'Atari ST (520ST/1040ST/Falcon)', icon: 'Monitor' },
  { id: 'mame', name: 'MAME (Arcade Classics / Cabinet)', icon: 'Gamepad2' },
];
