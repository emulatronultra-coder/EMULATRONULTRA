import { SystemCore, EmulatorConfig, VmHardwareConfig, DEFAULT_VM_HARDWARE, DiskDataEntry } from '../types';
import { safeReadFileAsArrayBuffer } from './fileUtils';

export interface VmClonePayload {
  version: number;
  format: 'webemu-clone';
  createdAt: string;
  gameName: string;
  core: SystemCore;
  hardwareConfig?: VmHardwareConfig;
  customBoot?: boolean;
  isMultiDisk?: boolean;
  singleRomName?: string;
  m3uContent?: string;
  m3uFileName?: string;
  stateDataB64?: string | null;
  osFile?: { name: string; dataB64: string } | null;
  zipFile?: { name: string; dataB64: string } | null;
  biosFile?: { name: string; dataB64: string } | null;
  romFile?: { name: string; dataB64: string } | null;
  disks?: Array<{ name: string; dataB64: string }>;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function base64ToFile(base64: string, filename: string, mimeType = 'application/octet-stream'): File {
  const buffer = base64ToBuffer(base64);
  return new File([buffer], filename, { type: mimeType });
}

export async function getV86StateFromEmulator(v86Instance: any): Promise<ArrayBuffer | null> {
  if (!v86Instance || typeof v86Instance.save_state !== 'function') return null;
  return new Promise((resolve) => {
    try {
      const res = v86Instance.save_state((err: any, state: ArrayBuffer) => {
        if (err || !state) {
          console.warn('v86 save_state callback error:', err);
          resolve(null);
        } else {
          resolve(state);
        }
      });
      if (res && typeof res.then === 'function') {
        res.then(resolve).catch((e: any) => {
          console.warn('v86 save_state promise error:', e);
          resolve(null);
        });
      }
    } catch (e) {
      console.warn('v86 save_state exception:', e);
      resolve(null);
    }
  });
}

export async function exportVmCloneFile(
  config: EmulatorConfig,
  customTitle?: string,
  liveStateBuffer?: ArrayBuffer | null
): Promise<void> {
  const stateBuffer = liveStateBuffer || config.initialState || null;
  const stateDataB64 = stateBuffer ? bufferToBase64(stateBuffer) : null;

  let osFileData: { name: string; dataB64: string } | null = null;
  if (config.osFile) {
    const buf = await safeReadFileAsArrayBuffer(config.osFile);
    if (buf) {
      osFileData = { name: config.osFile.name, dataB64: bufferToBase64(buf) };
    }
  }

  let zipFileData: { name: string; dataB64: string } | null = null;
  if (config.zipFile) {
    const buf = await safeReadFileAsArrayBuffer(config.zipFile);
    if (buf) {
      zipFileData = { name: config.zipFile.name, dataB64: bufferToBase64(buf) };
    }
  }

  let biosFileData: { name: string; dataB64: string } | null = null;
  if (config.biosFile) {
    const buf = await safeReadFileAsArrayBuffer(config.biosFile);
    if (buf) {
      biosFileData = { name: config.biosFile.name, dataB64: bufferToBase64(buf) };
    }
  }

  let romFileData: { name: string; dataB64: string } | null = null;
  if (config.romFile) {
    const buf = await safeReadFileAsArrayBuffer(config.romFile);
    if (buf) {
      romFileData = { name: config.romFile.name, dataB64: bufferToBase64(buf) };
    }
  }

  let disksData: Array<{ name: string; dataB64: string }> | undefined = undefined;
  if (config.disks && config.disks.length > 0) {
    disksData = config.disks.map(d => ({
      name: d.name,
      dataB64: bufferToBase64(d.data.buffer as ArrayBuffer),
    }));
  }

  const payload: VmClonePayload = {
    version: 1,
    format: 'webemu-clone',
    createdAt: new Date().toISOString(),
    gameName: config.gameName || 'Machine',
    core: config.core,
    hardwareConfig: config.hardwareConfig || DEFAULT_VM_HARDWARE,
    customBoot: config.customBoot,
    isMultiDisk: config.isMultiDisk,
    singleRomName: config.singleRomName,
    m3uContent: config.m3uContent,
    m3uFileName: config.m3uFileName,
    stateDataB64,
    osFile: osFileData,
    zipFile: zipFileData,
    biosFile: biosFileData,
    romFile: romFileData,
    disks: disksData,
  };

  const jsonStr = JSON.stringify(payload);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const cleanTitle = (customTitle || config.gameName || `${config.core}_machine`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  const filename = `${cleanTitle}_clone.vmclone`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importVmCloneFromFile(file: File): Promise<{
  core: SystemCore;
  config: EmulatorConfig;
  title: string;
}> {
  const fileNameLower = file.name.toLowerCase();

  // If raw .v86state binary file
  if (fileNameLower.endsWith('.v86state')) {
    const buffer = await safeReadFileAsArrayBuffer(file);
    if (!buffer) {
      throw new Error(`Failed to read state file: ${file.name}`);
    }
    const cleanName = file.name.replace(/\.v86state$/i, '');
    return {
      core: 'ibmpc',
      title: `${cleanName} (v86 Snapshot)`,
      config: {
        core: 'ibmpc',
        romFile: null,
        romFiles: [],
        romUrl: null,
        gameName: cleanName,
        hardwareConfig: DEFAULT_VM_HARDWARE,
        initialState: buffer,
      },
    };
  }

  // Parse .vmclone JSON bundle file
  const text = await file.text();
  let payload: VmClonePayload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    throw new Error('Недійсний формат файлу клону. Будь ласка, виберіть файл .vmclone або .v86state.');
  }

  if (payload.format !== 'webemu-clone' && !payload.core) {
    throw new Error('Файл не містить конфігурації емулятора WebEmu.');
  }

  const initialState = payload.stateDataB64 ? base64ToBuffer(payload.stateDataB64) : null;
  const osFile = payload.osFile ? base64ToFile(payload.osFile.dataB64, payload.osFile.name) : null;
  const zipFile = payload.zipFile ? base64ToFile(payload.zipFile.dataB64, payload.zipFile.name) : null;
  const biosFile = payload.biosFile ? base64ToFile(payload.biosFile.dataB64, payload.biosFile.name) : null;
  const biosUrl = biosFile ? URL.createObjectURL(biosFile) : null;

  const romFile = payload.romFile ? base64ToFile(payload.romFile.dataB64, payload.romFile.name) : null;

  let disks: DiskDataEntry[] | undefined = undefined;
  if (payload.disks && payload.disks.length > 0) {
    disks = payload.disks.map(d => ({
      name: d.name,
      data: new Uint8Array(base64ToBuffer(d.dataB64)),
    }));
  }

  let romBlob: Blob | null = romFile;
  let romUrl: string | null = romFile ? URL.createObjectURL(romFile) : null;

  if (disks && disks.length > 0) {
    const firstDiskBlob = new Blob([disks[0].data], { type: 'application/octet-stream' });
    romBlob = firstDiskBlob;
    romUrl = URL.createObjectURL(firstDiskBlob);
  }

  const restoredConfig: EmulatorConfig = {
    core: payload.core || 'ibmpc',
    romFile,
    romFiles: romFile ? [romFile] : [],
    romBlob,
    romUrl,
    gameName: payload.gameName || 'Imported Clone',
    isMultiDisk: payload.isMultiDisk,
    disks,
    m3uContent: payload.m3uContent,
    m3uFileName: payload.m3uFileName,
    singleRomName: payload.singleRomName,
    biosFile,
    biosBlob: biosFile,
    biosUrl,
    osFile,
    zipFile,
    customBoot: payload.customBoot,
    hardwareConfig: payload.hardwareConfig || DEFAULT_VM_HARDWARE,
    initialState,
  };

  return {
    core: payload.core || 'ibmpc',
    title: `${payload.gameName || 'Machine'} (Imported)`,
    config: restoredConfig,
  };
}
