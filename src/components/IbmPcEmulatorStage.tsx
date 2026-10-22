import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { V86 } from 'v86';
import {
  createFat16ImageFromZip,
  createFat16ImageFromSingleFile,
  createBlankWinchesterDrive,
  createBlankFloppyDisk,
} from '../utils/fat16Builder';
import { safeReadFileAsArrayBuffer } from '../utils/fileUtils';
import { VmHardwareConfig, DEFAULT_VM_HARDWARE, StageRefHandle, IbmPcBootOs } from '../types';
import { getV86StateFromEmulator } from '../utils/cloneManager';
import VmHardwareSettings from './VmHardwareSettings';
import DiskDriveManagerModal, { MountedDrivesState } from './DiskDriveManagerModal';
import {
  TerminalSquare,
  Maximize2,
  Disc,
  HardDrive,
  Cpu,
  Sliders,
  X,
  Check,
  Zap,
  Copy,
  Download,
  Database,
  Layers,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  osFile: File | null;
  zipFile: File | null;
  customBoot?: boolean;
  bootOs?: IbmPcBootOs;
  hardwareConfig?: VmHardwareConfig;
  initialState?: ArrayBuffer | null;
  onHardwareChange?: (updated: VmHardwareConfig) => void;
  onCloneMachine?: (liveStateBuffer?: ArrayBuffer | null) => void;
  onExportCloneFile?: (liveStateBuffer?: ArrayBuffer | null) => void;
}

async function fetchBinary(primaryUrl: string, ...fallbackUrls: string[]): Promise<ArrayBuffer> {
  const allUrls = [primaryUrl, ...fallbackUrls];
  let lastError: unknown = null;

  for (const url of allUrls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error(`Invalid non-binary Content-Type (${contentType}) from ${url}`);
      }
      
      const buffer = await res.arrayBuffer();
      if (!buffer || buffer.byteLength < 512) {
        throw new Error(`Buffer too small (${buffer?.byteLength || 0} bytes) from ${url}`);
      }
      return buffer;
    } catch (err) {
      lastError = err;
      console.warn(`Fetch error for ${url}:`, err);
    }
  }

  throw lastError || new Error(`Could not load binary data from any source for ${primaryUrl}`);
}

const CPU_NAMES: Record<string, string> = {
  '386': 'Intel 80386DX (33 MHz)',
  '486': 'Intel 80486DX4 (100 MHz)',
  'pentium': 'Intel Pentium MMX (166 MHz)',
  'pentium_pro': 'Intel Pentium Pro (200 MHz)',
  'pentium_2': 'Intel Pentium II (400 MHz)',
  'pentium_3': 'Intel Pentium III (1.0 GHz)',
  'pentium_4': 'Intel Pentium 4 Extreme (2.4+ GHz)',
  'amd_k6': 'AMD K6-2 3DNow! (500 MHz)',
  'turbo_max': 'Quantum JIT Turbo (Max GHz)',
};

const IbmPcEmulatorStage = forwardRef<StageRefHandle, Props>(function IbmPcEmulatorStage({
  osFile,
  zipFile,
  customBoot = false,
  bootOs = 'msdos',
  hardwareConfig = DEFAULT_VM_HARDWARE,
  initialState = null,
  onHardwareChange,
  onCloneMachine,
  onExportCloneFile,
}: Props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>('Initializing IBM PC Virtual Machine...');
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mounted drives state for storage manager
  const [drivesState, setDrivesState] = useState<MountedDrivesState>({
    hda: { name: 'MS-DOS 6.22 (Winchester C:)', isSystem: true },
  });

  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDiskModal, setShowDiskModal] = useState<boolean>(false);
  const [localHardware, setLocalHardware] = useState<VmHardwareConfig>(hardwareConfig);
  const [bootKey, setBootKey] = useState<number>(0);
  const [isCapturingState, setIsCapturingState] = useState<boolean>(false);

  // Drive activity LED states
  const [floppyLed, setFloppyLed] = useState<boolean>(false);
  const [hddLed, setHddLed] = useState<boolean>(false);
  const [cdromLed, setCdromLed] = useState<boolean>(false);

  // Custom persistent references for manually attached drives
  const customHdaRef = useRef<ArrayBuffer | null>(null);
  const customHdbRef = useRef<ArrayBuffer | null>(null);

  const emulatorRef = useRef<V86 | null>(null);

  const pulseLed = (type: 'floppy' | 'hdd' | 'cd') => {
    if (type === 'floppy') {
      setFloppyLed(true);
      setTimeout(() => setFloppyLed(false), 350);
    } else if (type === 'hdd') {
      setHddLed(true);
      setTimeout(() => setHddLed(false), 350);
    } else if (type === 'cd') {
      setCdromLed(true);
      setTimeout(() => setCdromLed(false), 350);
    }
  };

  useImperativeHandle(ref, () => ({
    getStateSnapshot: async () => {
      if (emulatorRef.current) {
        return await getV86StateFromEmulator(emulatorRef.current);
      }
      return null;
    }
  }));

  // Sync incoming hardwareConfig with local draft
  useEffect(() => {
    setLocalHardware(hardwareConfig);
  }, [hardwareConfig]);

  const sendCommand = (text: string) => {
    if (emulatorRef.current) {
      try {
        emulatorRef.current.keyboard_send_text(text + '\n');
        pulseLed('hdd');
        containerRef.current?.focus();
      } catch (e) {
        console.warn('Could not send keyboard input:', e);
      }
    }
  };

  const handleApplyHardware = () => {
    onHardwareChange?.(localHardware);
    setShowSettingsModal(false);
    // Reboot VM with updated hardware options
    setBootKey(prev => prev + 1);
  };

  const handleCloneClick = async () => {
    setIsCapturingState(true);
    let stateBuf: ArrayBuffer | null = null;
    if (emulatorRef.current) {
      stateBuf = await getV86StateFromEmulator(emulatorRef.current);
    }
    setIsCapturingState(false);
    onCloneMachine?.(stateBuf);
  };

  const handleExportClick = async () => {
    setIsCapturingState(true);
    let stateBuf: ArrayBuffer | null = null;
    if (emulatorRef.current) {
      stateBuf = await getV86StateFromEmulator(emulatorRef.current);
    }
    setIsCapturingState(false);
    onExportCloneFile?.(stateBuf);
  };

  // HOT-SWAP DISK HANDLERS (v86 live methods)
  const handleMountFda = async (fileOrBuffer: File | Uint8Array, name: string) => {
    pulseLed('floppy');
    let buffer: ArrayBuffer | null = null;
    if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      buffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
    }

    if (!buffer) {
      console.warn(`Could not read FDA file: ${name}`);
      return;
    }

    if (emulatorRef.current) {
      try {
        emulatorRef.current.set_fda({ buffer });
        pulseLed('floppy');
      } catch (err) {
        console.warn('Live FDA swap fallback:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      fda: { name, buffer, sizeText: `${Math.round(buffer.byteLength / 1024)} KB` },
    }));
  };

  const handleEjectFda = () => {
    pulseLed('floppy');
    if (emulatorRef.current) {
      try {
        emulatorRef.current.eject_fda();
      } catch (err) {
        console.warn('FDA eject error:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      fda: undefined,
    }));
  };

  const handleMountFdb = async (fileOrBuffer: File | Uint8Array, name: string) => {
    pulseLed('floppy');
    let buffer: ArrayBuffer | null = null;
    if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      buffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
    }

    if (!buffer) {
      console.warn(`Could not read FDB file: ${name}`);
      return;
    }

    if (emulatorRef.current) {
      try {
        emulatorRef.current.set_fdb({ buffer });
        pulseLed('floppy');
      } catch (err) {
        console.warn('Live FDB swap fallback:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      fdb: { name, buffer, sizeText: `${Math.round(buffer.byteLength / 1024)} KB` },
    }));
  };

  const handleEjectFdb = () => {
    pulseLed('floppy');
    if (emulatorRef.current) {
      try {
        emulatorRef.current.eject_fdb();
      } catch (err) {
        console.warn('FDB eject error:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      fdb: undefined,
    }));
  };

  const handleMountCdrom = async (fileOrBuffer: File | Uint8Array, name: string) => {
    pulseLed('cd');
    let buffer: ArrayBuffer | null = null;
    if (fileOrBuffer instanceof Uint8Array) {
      buffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      buffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
    }

    if (!buffer) {
      console.warn(`Could not read CD-ROM file: ${name}`);
      return;
    }

    if (emulatorRef.current) {
      try {
        emulatorRef.current.set_cdrom({ buffer });
        pulseLed('cd');
      } catch (err) {
        console.warn('Live CD-ROM swap fallback:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      cdrom: { name, buffer, sizeText: `${Math.round(buffer.byteLength / (1024 * 1024))} MB` },
    }));
  };

  const handleEjectCdrom = () => {
    pulseLed('cd');
    if (emulatorRef.current) {
      try {
        emulatorRef.current.eject_cdrom();
      } catch (err) {
        console.warn('CD-ROM eject error:', err);
      }
    }
    setDrivesState(prev => ({
      ...prev,
      cdrom: undefined,
    }));
  };

  const handleMountHda = async (fileOrBuffer: File | Uint8Array, name: string, isZip: boolean = false) => {
    pulseLed('hdd');
    let diskBuffer: ArrayBuffer | null = null;
    if (isZip && (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob)) {
      const fat16 = await createFat16ImageFromZip(fileOrBuffer, hardwareConfig.winchesterSizeMb || 64);
      diskBuffer = fat16.buffer as ArrayBuffer;
    } else if (fileOrBuffer instanceof Uint8Array) {
      diskBuffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      diskBuffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
    }

    if (!diskBuffer) {
      console.warn(`Could not read HDA file: ${name}`);
      return;
    }

    customHdaRef.current = diskBuffer;
    setDrivesState(prev => ({
      ...prev,
      hda: { name, buffer: diskBuffer!, sizeText: `${Math.round(diskBuffer!.byteLength / (1024 * 1024))} MB`, isSystem: false },
    }));
    setBootKey(prev => prev + 1);
  };

  const handleEjectHda = () => {
    customHdaRef.current = null;
    setDrivesState(prev => ({
      ...prev,
      hda: { name: 'MS-DOS 6.22 (Winchester C:)', isSystem: true },
    }));
    setBootKey(prev => prev + 1);
  };

  const handleMountHdb = async (fileOrBuffer: File | Uint8Array, name: string, isZip: boolean = false) => {
    pulseLed('hdd');
    let diskBuffer: ArrayBuffer | null = null;
    if (isZip && (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob)) {
      const fat16 = await createFat16ImageFromZip(fileOrBuffer, 64);
      diskBuffer = fat16.buffer as ArrayBuffer;
    } else if (fileOrBuffer instanceof File) {
      const isSingleProgram = /\.(exe|com|bat|txt|bas)$/i.test(fileOrBuffer.name);
      if (isSingleProgram) {
        const fat16 = await createFat16ImageFromSingleFile(fileOrBuffer, 16);
        diskBuffer = fat16.buffer as ArrayBuffer;
      } else {
        diskBuffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
      }
    } else if (fileOrBuffer instanceof Uint8Array) {
      diskBuffer = fileOrBuffer.buffer as ArrayBuffer;
    } else {
      diskBuffer = await safeReadFileAsArrayBuffer(fileOrBuffer);
    }

    if (!diskBuffer) {
      console.warn(`Could not read HDB file: ${name}`);
      return;
    }

    customHdbRef.current = diskBuffer;
    setDrivesState(prev => ({
      ...prev,
      hdb: { name, buffer: diskBuffer!, sizeText: `${Math.round(diskBuffer!.byteLength / (1024 * 1024))} MB` },
    }));
    setBootKey(prev => prev + 1);
  };

  const handleEjectHdb = () => {
    customHdbRef.current = null;
    setDrivesState(prev => ({
      ...prev,
      hdb: undefined,
    }));
    setBootKey(prev => prev + 1);
  };

  useEffect(() => {
    let isMounted = true;

    async function startVm() {
      if (!containerRef.current) return;

      setIsBooting(true);
      setError(null);

      try {
        setStatus('Loading BIOS & hardware firmware...');

        const [seabiosBuffer, vgabiosBuffer] = await Promise.all([
          fetchBinary(
            '/bios/seabios.bin',
            'https://raw.githubusercontent.com/copy/v86/master/bios/seabios.bin'
          ),
          fetchBinary(
            '/bios/vgabios.bin',
            'https://raw.githubusercontent.com/copy/v86/master/bios/vgabios.bin'
          ),
        ]);

        if (!isMounted) return;

        // Reset screen container with clean terminal + canvas
        const container = containerRef.current;
        container.innerHTML = `
          <div style="white-space: pre; font: 14px monospace; line-height: 14px; color: #f3f4f6; background-color: #000; outline: none; user-select: text;"></div>
          <canvas style="display: none"></canvas>
        `;

        const effectiveBootOs: IbmPcBootOs = customBoot ? 'custom' : bootOs;

        // Memory configuration: dynamically sized for OS within safe WebAssembly limits
        let targetMemMb = hardwareConfig.memoryMb || 64;
        if (effectiveBootOs === 'ubuntu') {
          targetMemMb = Math.min(Math.max(targetMemMb, 128), 256);
        } else if (effectiveBootOs === 'debian') {
          targetMemMb = Math.min(Math.max(targetMemMb, 128), 256);
        } else if (effectiveBootOs === 'linux') {
          targetMemMb = Math.min(Math.max(targetMemMb, 64), 128);
        } else {
          targetMemMb = Math.min(Math.max(targetMemMb, 16), 128);
        }
        const memBytes = targetMemMb * 1024 * 1024;
        const vgaBytes = Math.min(hardwareConfig.vgaMemoryMb || 8, 16) * 1024 * 1024;

        const v86Options: any = {
          wasm_path: '/v86/v86.wasm',
          memory_size: memBytes,
          vga_memory_size: vgaBytes,
          disable_speaker: hardwareConfig.enableSpeaker === false,
          disable_mouse: hardwareConfig.enableMouse === false,
          screen_container: container,
          bios: { buffer: seabiosBuffer },
          vga_bios: { buffer: vgabiosBuffer },
          autostart: true,
        };

        if (initialState && initialState.byteLength > 0) {
          setStatus('Restoring cloned VM state snapshot...');
          v86Options.initial_state = { buffer: initialState };
        }

        const newDrivesState: MountedDrivesState = {};

        // 1. If custom Winchester C: is active
        if (customHdaRef.current) {
          v86Options.hda = { buffer: customHdaRef.current };
          newDrivesState.hda = drivesState.hda || { name: 'Custom Winchester C:', isSystem: false };
        }

        // 2. If custom Winchester D: is active
        if (customHdbRef.current) {
          v86Options.hdb = { buffer: customHdbRef.current };
          newDrivesState.hdb = drivesState.hdb || { name: 'Winchester D:', isSystem: false };
        }

        // 3. Mount active Floppy A / Floppy B if previously inserted
        if (drivesState.fda?.buffer) {
          v86Options.fda = { buffer: drivesState.fda.buffer };
          newDrivesState.fda = drivesState.fda;
        }
        if (drivesState.fdb?.buffer) {
          v86Options.fdb = { buffer: drivesState.fdb.buffer };
          newDrivesState.fdb = drivesState.fdb;
        }

        if (effectiveBootOs === 'ubuntu') {
          setStatus('Loading Ubuntu Linux (x86 Bare-Metal Kernel & CD-ROM ISO)...');
          let isoBuffer: ArrayBuffer | null = null;
          let isoName = 'Ubuntu Linux (x86 Bare-Metal Live)';

          if (osFile && osFile.name.toLowerCase().endsWith('.iso')) {
            setStatus(`Reading custom Ubuntu ISO: ${osFile.name}...`);
            isoBuffer = await safeReadFileAsArrayBuffer(osFile);
            if (isoBuffer) {
              isoName = osFile.name;
            }
          }

          if (!isoBuffer) {
            isoBuffer = await fetchBinary(
              '/images/ubuntu.iso',
              '/images/linux.iso',
              '/images/debian.iso'
            );
          }

          v86Options.cdrom = { buffer: isoBuffer };
          v86Options.boot_order = 0x312; // Boot from CD-ROM first
          newDrivesState.cdrom = { name: isoName };

          const attachedFile = zipFile || (osFile && !osFile.name.toLowerCase().endsWith('.iso') ? osFile : null);
          if (attachedFile) {
            const fileNameLower = attachedFile.name.toLowerCase();
            try {
              if (fileNameLower.endsWith('.zip')) {
                setStatus(`Mounting ${attachedFile.name} as /dev/hda...`);
                const zipBuffer = await createFat16ImageFromZip(attachedFile, 64);
                v86Options.hda = { buffer: zipBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else if (/\.(xex|atr|xfd|car|rom|bin|exe|com|bat|txt|bas|sh|c|py)$/i.test(fileNameLower)) {
                setStatus(`Building virtual FAT16 disk for ${attachedFile.name}...`);
                const diskBuffer = await createFat16ImageFromSingleFile(attachedFile, 32);
                v86Options.hda = { buffer: diskBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else {
                const fileBuffer = await safeReadFileAsArrayBuffer(attachedFile);
                if (fileBuffer) {
                  v86Options.hda = { buffer: fileBuffer };
                  newDrivesState.hda = { name: attachedFile.name, isSystem: false };
                }
              }
            } catch (err) {
              console.warn('Could not mount secondary storage disk:', err);
            }
          }
        } else if (effectiveBootOs === 'custom' && osFile) {
          setStatus(`Loading custom OS image ${osFile.name}...`);
          let osBuffer = await safeReadFileAsArrayBuffer(osFile);
          
          if (!osBuffer) {
            console.warn(`Could not read custom OS file ${osFile.name}, falling back to built-in system image.`);
            osBuffer = await fetchBinary('/images/msdos.img');
          }

          const isFloppy =
            osFile.name.toLowerCase().endsWith('.img') && osBuffer.byteLength <= 2880 * 1024;
          const isIso = osFile.name.toLowerCase().endsWith('.iso');

          if (isIso) {
            v86Options.cdrom = { buffer: osBuffer };
            v86Options.boot_order = 0x312;
            newDrivesState.cdrom = { name: osFile.name };
          } else if (isFloppy) {
            v86Options.fda = { buffer: osBuffer };
            newDrivesState.fda = { name: osFile.name };
          } else {
            v86Options.hda = { buffer: osBuffer };
            newDrivesState.hda = { name: osFile.name, isSystem: true };
          }

          if (zipFile) {
            try {
              setStatus(`Building FAT16 Virtual Disk from ${zipFile.name}...`);
              const zipBuffer = await createFat16ImageFromZip(zipFile, 32);
              if (isFloppy) {
                v86Options.hda = { buffer: zipBuffer.buffer };
                newDrivesState.hda = { name: zipFile.name, isSystem: false };
              } else {
                v86Options.hdb = { buffer: zipBuffer.buffer };
                newDrivesState.hdb = { name: zipFile.name };
              }
            } catch (err) {
              console.warn('Could not mount attached zip file:', err);
            }
          }
        } else if (effectiveBootOs === 'debian') {
          // Debian GNU/Linux (i386 distribution with full GNU userland and Linux kernel)
          setStatus('Loading Debian GNU/Linux (i386) distribution ISO...');
          const debianBuffer = await fetchBinary(
            '/images/debian.iso',
            '/images/linux.iso',
            '/images/ubuntu.iso'
          );

          v86Options.cdrom = { buffer: debianBuffer };
          v86Options.boot_order = 0x312; // Boot from CD-ROM first
          newDrivesState.cdrom = { name: 'Debian GNU/Linux (i386)' };

          const attachedFile = zipFile || osFile;
          if (attachedFile) {
            const fileNameLower = attachedFile.name.toLowerCase();
            try {
              if (fileNameLower.endsWith('.zip')) {
                setStatus(`Mounting ${attachedFile.name} as /dev/hda...`);
                const zipBuffer = await createFat16ImageFromZip(attachedFile, 64);
                v86Options.hda = { buffer: zipBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else if (/\.(xex|atr|xfd|car|rom|bin|exe|com|bat|txt|bas|sh|c|py)$/i.test(fileNameLower)) {
                setStatus(`Building virtual FAT16 disk for ${attachedFile.name}...`);
                const diskBuffer = await createFat16ImageFromSingleFile(attachedFile, 32);
                v86Options.hda = { buffer: diskBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else {
                const fileBuffer = await safeReadFileAsArrayBuffer(attachedFile);
                if (fileBuffer) {
                  v86Options.hda = { buffer: fileBuffer };
                  newDrivesState.hda = { name: attachedFile.name, isSystem: false };
                }
              }
            } catch (err) {
              console.warn('Could not mount attached storage:', err);
            }
          }
        } else if (effectiveBootOs === 'linux') {
          // Linux (Buildroot x86 ISO with BusyBox)
          setStatus('Loading Linux kernel & ramdisk ISO...');
          const linuxBuffer = await fetchBinary(
            '/images/linux.iso',
            '/images/debian.iso',
            '/images/ubuntu.iso'
          );

          v86Options.cdrom = { buffer: linuxBuffer };
          v86Options.boot_order = 0x312; // Boot from CD-ROM first
          newDrivesState.cdrom = { name: 'Linux (Buildroot x86)' };

          const attachedFile = zipFile || osFile;
          if (attachedFile) {
            const fileNameLower = attachedFile.name.toLowerCase();
            try {
              if (fileNameLower.endsWith('.zip')) {
                setStatus(`Mounting ${attachedFile.name} as /dev/hda...`);
                const zipBuffer = await createFat16ImageFromZip(attachedFile, 32);
                v86Options.hda = { buffer: zipBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else if (/\.(xex|atr|xfd|car|rom|bin|exe|com|bat|txt|bas|sh|c|py)$/i.test(fileNameLower)) {
                setStatus(`Building virtual FAT16 disk for ${attachedFile.name}...`);
                const diskBuffer = await createFat16ImageFromSingleFile(attachedFile, 16);
                v86Options.hda = { buffer: diskBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else {
                const fileBuffer = await safeReadFileAsArrayBuffer(attachedFile);
                if (fileBuffer) {
                  v86Options.hda = { buffer: fileBuffer };
                  newDrivesState.hda = { name: attachedFile.name, isSystem: false };
                }
              }
            } catch (err) {
              console.warn('Could not mount attached disk:', err);
            }
          }
        } else if (effectiveBootOs === 'freedos') {
          // FreeDOS 7.22 (Floppy boot)
          setStatus('Loading FreeDOS 7.22 System Floppy...');
          const freedosBuffer = await fetchBinary(
            '/images/freedos722.img'
          );

          v86Options.fda = { buffer: freedosBuffer };
          newDrivesState.fda = { name: 'FreeDOS 7.22 Boot Floppy' };
          v86Options.boot_order = 0x213; // Floppy first

          const attachedFile = zipFile || osFile;
          if (attachedFile) {
            const fileNameLower = attachedFile.name.toLowerCase();
            try {
              if (fileNameLower.endsWith('.zip')) {
                setStatus(`Building FAT16 Virtual Disk from ${attachedFile.name}...`);
                const zipBuffer = await createFat16ImageFromZip(attachedFile, 32);
                v86Options.hda = { buffer: zipBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else if (
                fileNameLower.endsWith('.exe') ||
                fileNameLower.endsWith('.com') ||
                fileNameLower.endsWith('.bat')
              ) {
                const exeBuffer = await createFat16ImageFromSingleFile(attachedFile, 16);
                v86Options.hda = { buffer: exeBuffer.buffer };
                newDrivesState.hda = { name: attachedFile.name, isSystem: false };
              } else {
                const fileBuffer = await safeReadFileAsArrayBuffer(attachedFile);
                if (fileBuffer) {
                  v86Options.hda = { buffer: fileBuffer };
                  newDrivesState.hda = { name: attachedFile.name, isSystem: false };
                }
              }
            } catch (err) {
              console.warn('Could not mount attached disk in FreeDOS:', err);
            }
          }
        } else {
          // Standard / Recommended mode: MS-DOS 6.22 (Winchester HDD C:)
          if (!v86Options.hda) {
            setStatus('Loading MS-DOS 6.22 Winchester Hard Disk...');
            const msdosBuffer = await fetchBinary(
              '/images/msdos.img'
            );
            v86Options.hda = { buffer: msdosBuffer };
            newDrivesState.hda = { name: 'MS-DOS 6.22 (Winchester C:)', isSystem: true };
          }

          const attachedFile = zipFile || osFile;
          if (attachedFile && !v86Options.hdb) {
            const fileNameLower = attachedFile.name.toLowerCase();
            try {
              if (fileNameLower.endsWith('.zip')) {
                setStatus(`Building FAT16 Virtual Disk from ${attachedFile.name}...`);
                const zipBuffer = await createFat16ImageFromZip(attachedFile, 32);
                v86Options.hdb = { buffer: zipBuffer.buffer };
                newDrivesState.hdb = { name: attachedFile.name };
              } else if (
                fileNameLower.endsWith('.exe') ||
                fileNameLower.endsWith('.com') ||
                fileNameLower.endsWith('.bat')
              ) {
                setStatus(`Packaging ${attachedFile.name} into Virtual Drive...`);
                const exeBuffer = await createFat16ImageFromSingleFile(attachedFile, 16);
                v86Options.hdb = { buffer: exeBuffer.buffer };
                newDrivesState.hdb = { name: attachedFile.name };
              } else {
                const fileBuffer = await safeReadFileAsArrayBuffer(attachedFile);
                if (fileBuffer) {
                  const isFloppySize = fileBuffer.byteLength <= 2880 * 1024;
                  if (isFloppySize && !v86Options.fda) {
                    v86Options.fda = { buffer: fileBuffer };
                    newDrivesState.fda = { name: attachedFile.name };
                  } else {
                    v86Options.hdb = { buffer: fileBuffer };
                    newDrivesState.hdb = { name: attachedFile.name };
                  }
                }
              }
            } catch (err) {
              console.warn('Could not mount attached disk in MS-DOS:', err);
            }
          }

          // Boot order setting
          if (hardwareConfig.bootOrder === 'a_first') {
            v86Options.boot_order = 0x213; // Floppy first
          } else {
            v86Options.boot_order = 0x132; // Hard drive first
          }
        }

        if (!isMounted) return;

        setDrivesState(newDrivesState);
        setStatus(initialState ? 'Restoring cloned state...' : 'Booting IBM PC...');

        const vm = new V86(v86Options);
        emulatorRef.current = vm;

        vm.add_listener('emulator-ready', () => {
          if (!isMounted) return;
          setIsBooting(false);
          pulseLed('hdd');
        });

        (vm as any).add_listener('screen-fill-buffer', () => {
          if (!isMounted) return;
          setIsBooting(false);
        });

        (vm as any).add_listener('screen-set-mode', () => {
          if (!isMounted) return;
          setIsBooting(false);
        });

        if (isMounted) {
          if (initialState) {
            setStatus('Cloned State Loaded • VM Running');
          } else if (effectiveBootOs === 'ubuntu') {
            setStatus('Ubuntu Linux (x86 Bare-Metal) Live • Loading Shell...');
          } else if (effectiveBootOs === 'debian') {
            setStatus('Debian GNU/Linux (i386) Ready • Shell (~#)');
          } else if (effectiveBootOs === 'linux') {
            setStatus('Linux (Buildroot x86) Ready • BusyBox Terminal (~#)');
          } else if (effectiveBootOs === 'freedos') {
            setStatus('FreeDOS 7.22 Ready • Floppy Drive A:');
          } else if (newDrivesState.hdb) {
            setStatus(`MS-DOS 6.22 Ready • Drive D: (${newDrivesState.hdb.name})`);
          } else if (newDrivesState.fda) {
            setStatus(`MS-DOS 6.22 Ready • Floppy A: (${newDrivesState.fda.name})`);
          } else {
            setStatus('MS-DOS 6.22 Ready • Winchester C: Active');
          }
        }
      } catch (err: any) {
        console.error('Error launching v86 VM:', err);
        if (isMounted) {
          setIsBooting(false);
          setError(err.message || 'Failed to start Virtual Machine');
        }
      }
    }

    startVm();

    return () => {
      isMounted = false;
      if (emulatorRef.current) {
        try {
          emulatorRef.current.stop();
        } catch (e) {
          console.warn('Error stopping VM:', e);
        }
        emulatorRef.current = null;
      }
    };
  }, [osFile, zipFile, customBoot, bootOs, hardwareConfig, bootKey, initialState]);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const cpuLabel = CPU_NAMES[hardwareConfig.cpuProfile] || 'Intel Pentium III (1.0 GHz)';

  return (
    <div className="w-full h-full bg-black flex flex-col relative overflow-hidden select-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-10 px-2.5 sm:px-4 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 flex items-center justify-between z-20 text-xs">
        {/* Left: CPU, RAM & Activity LEDs */}
        <div className="flex items-center gap-2 sm:gap-3 text-neutral-300 font-mono">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <TerminalSquare className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">IBM PC</span>
          </div>

          {/* CPU & Memory pill */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-1.5 text-neutral-300 text-[11px] bg-neutral-800/80 hover:bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700/60 transition-colors cursor-pointer"
            title="Змінити процесор або конфігурацію обладнання"
          >
            <Cpu className="w-3 h-3 text-sky-400" />
            <span className="truncate max-w-[110px] sm:max-w-none font-semibold">
              {cpuLabel.split(' (')[0]}
            </span>
            <span className="text-neutral-600">|</span>
            <span className="text-emerald-400 font-bold">{hardwareConfig.memoryMb}MB</span>
          </button>

          {/* Drive Activity LEDs */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-neutral-400 font-mono pl-1">
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                floppyLed
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-500'
              }`}
              title="Індикатор звернення до дискети (Floppy Drive A/B)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${floppyLed ? 'bg-emerald-400 animate-ping' : 'bg-neutral-700'}`} />
              <span>FDD</span>
            </div>

            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                hddLed
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-500'
              }`}
              title="Індикатор звернення до вінчестера (HDD Winchester C/D)"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hddLed ? 'bg-amber-400 animate-ping' : 'bg-neutral-700'}`} />
              <span>HDD</span>
            </div>

            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
                cdromLed
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-500'
              }`}
              title="Індикатор оптичного приводу CD-ROM"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cdromLed ? 'bg-purple-400' : 'bg-neutral-700'}`} />
              <span>CD</span>
            </div>
          </div>
        </div>

        {/* Center: Drive Manager Shortcut & DOS/Debian Shortcuts */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          {/* Main Disk & Winchester Storage Manager Button */}
          <button
            onClick={() => setShowDiskModal(true)}
            className="px-2.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/40 transition-colors flex items-center gap-1.5 font-semibold cursor-pointer shadow-sm shadow-sky-500/10"
            title="Відкрити менеджер зміни дискет, дисків та вінчестера"
          >
            <Database className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Дискети / Вінчестер</span>
            <span className="sm:hidden">Диски</span>
          </button>

          {bootOs === 'debian' ? (
            <>
              <button
                onClick={() => sendCommand('apt update')}
                className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/40 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                title="Refresh APT package lists"
              >
                apt update
              </button>
              <button
                onClick={() => sendCommand('neofetch')}
                className="hidden md:inline-flex px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors items-center gap-1 cursor-pointer"
                title="Display Debian OS and system info"
              >
                neofetch
              </button>
            </>
          ) : bootOs === 'linux' ? (
            <>
              <button
                onClick={() => sendCommand('ls -la')}
                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white border border-emerald-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                title="List directory contents"
              >
                ls -la
              </button>
            </>
          ) : (
            <>
              {drivesState.fda && (
                <button
                  onClick={() => sendCommand('a:')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-sky-400 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title={`Перейти на дискету A: (${drivesState.fda.name})`}
                >
                  <Disc className="w-3 h-3 text-sky-400" />
                  <span>A:</span>
                </button>
              )}
              {drivesState.hda && (
                <button
                  onClick={() => sendCommand('c:')}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-400 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Перейти на вінчестер C:"
                >
                  <HardDrive className="w-3 h-3 text-amber-400" />
                  <span>C:</span>
                </button>
              )}
              {drivesState.hdb && (
                <button
                  onClick={() => sendCommand('d:')}
                  className="px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/40 transition-colors flex items-center gap-1 cursor-pointer"
                  title={`Перейти на диск D: (${drivesState.hdb.name})`}
                >
                  <HardDrive className="w-3 h-3 text-sky-400" />
                  <span>D:</span>
                </button>
              )}
              <button
                onClick={() => sendCommand('dir')}
                className="hidden md:inline-block px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors cursor-pointer"
                title="List files in current directory"
              >
                DIR
              </button>
            </>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Clone VM Button */}
          <button
            onClick={handleCloneClick}
            disabled={isCapturingState}
            className="px-2 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white border border-sky-500/40 transition-colors flex items-center gap-1 font-medium text-[11px] cursor-pointer"
            title="Клонувати цю машину з її поточним станом у нову вкладку"
          >
            <Copy className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">{isCapturingState ? '...' : 'Клон'}</span>
          </button>

          {/* Export Clone File Button */}
          <button
            onClick={handleExportClick}
            disabled={isCapturingState}
            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1 font-medium text-[11px] cursor-pointer"
            title="Зберегти клон цієї машини у файл (.vmclone)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Експорт</span>
          </button>

          {/* Hardware Configuration Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1 font-medium text-[11px] cursor-pointer"
            title="Налаштування процесора, пам'яті та обладнання"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">CPU & RAM</span>
          </button>

          <button
            onClick={handleFullscreen}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
            title="На весь екран"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Screen Area */}
      <div
        className="flex-1 w-full flex items-center justify-center bg-black overflow-hidden pt-10 relative cursor-pointer"
        onClick={() => containerRef.current?.focus()}
      >
        <div
          ref={containerRef}
          tabIndex={0}
          className="flex items-center justify-center outline-none"
          style={{
            transform: 'scale(1.15)',
            transformOrigin: 'center center',
          }}
        />

        {/* Booting Loader Overlay */}
        {isBooting && !error && (
          <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-10 p-6 pointer-events-none">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                <Cpu className="w-8 h-8 text-sky-400 animate-pulse" />
              </div>
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin absolute -bottom-1 -right-1" />
            </div>
            <div className="text-center space-y-1.5 max-w-md">
              <div className="text-white font-mono text-sm font-semibold tracking-wide flex items-center justify-center gap-2">
                <span>Ініціалізація x86 Віртуальної Машини</span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                {status || 'Завантаження BIOS та системного образу...'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 bg-neutral-900/80 px-3 py-1 rounded-full border border-neutral-800">
              <span>{cpuLabel.split(' (')[0]}</span>
              <span>•</span>
              <span className="text-sky-400">{hardwareConfig.memoryMb || 128} MB RAM</span>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-neutral-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-10 p-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="text-center space-y-2 max-w-md">
              <h3 className="text-base font-bold text-white">Помилка запуску Віртуальної Машини</h3>
              <p className="text-xs text-rose-300 font-mono bg-rose-950/40 p-3 rounded-xl border border-rose-800/40 text-left overflow-auto max-h-32">
                {error}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setBootKey(prev => prev + 1);
                }}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg shadow-sky-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Спробувати знову (Restart VM)
              </button>
              <button
                type="button"
                onClick={() => setShowDiskModal(true)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" />
                Змінити диск
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DISK & WINCHESTER MANAGER MODAL */}
      <DiskDriveManagerModal
        isOpen={showDiskModal}
        onClose={() => setShowDiskModal(false)}
        drives={drivesState}
        onMountFda={handleMountFda}
        onEjectFda={handleEjectFda}
        onMountFdb={handleMountFdb}
        onEjectFdb={handleEjectFdb}
        onMountHda={handleMountHda}
        onEjectHda={handleEjectHda}
        onMountHdb={handleMountHdb}
        onEjectHdb={handleEjectHdb}
        onMountCdrom={handleMountCdrom}
        onEjectCdrom={handleEjectCdrom}
      />

      {/* Hardware Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-sky-400" />
                <h3 className="text-lg font-bold text-white">Налаштування апаратної конфігурації VM</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <VmHardwareSettings hardware={localHardware} onChange={setLocalHardware} />

            <div className="flex items-center justify-between pt-5 mt-5 border-t border-neutral-800">
              <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Зміна процесора та RAM перезапустить емулятор</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleApplyHardware}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Застосувати та перезапустити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default IbmPcEmulatorStage;
