import { mkfsvfat, mount } from 'libmount';
import JSZip from 'jszip';
import { safeReadFileAsArrayBuffer } from './fileUtils';

export function wrapInMbr(fatVolume: Uint8Array, sizeMB: number): Uint8Array {
  const startSector = 63;
  const capacity = fatVolume.length;
  const totalSectors = Math.floor(capacity / 512);
  const mbrDisk = new Uint8Array(startSector * 512 + capacity);

  const ptOffset = 446;
  // Partition 1
  mbrDisk[ptOffset] = 0x80; // active/bootable
  mbrDisk[ptOffset + 1] = 0x01; // Head 1
  mbrDisk[ptOffset + 2] = 0x01; // Sector 1
  mbrDisk[ptOffset + 3] = 0x00; // Cylinder 0
  mbrDisk[ptOffset + 4] = sizeMB < 32 ? 0x04 : 0x06; // 0x04 = FAT16 < 32MB, 0x06 = FAT16 >= 32MB
  mbrDisk[ptOffset + 5] = 0xfe; // End Head
  mbrDisk[ptOffset + 6] = 0xff; // End Sector/Cylinder
  mbrDisk[ptOffset + 7] = 0xff;
  mbrDisk[ptOffset + 8] = 0x3f; // LBA 63
  mbrDisk[ptOffset + 9] = 0x00;
  mbrDisk[ptOffset + 10] = 0x00;
  mbrDisk[ptOffset + 11] = 0x00;
  mbrDisk[ptOffset + 12] = totalSectors & 0xff;
  mbrDisk[ptOffset + 13] = (totalSectors >> 8) & 0xff;
  mbrDisk[ptOffset + 14] = (totalSectors >> 16) & 0xff;
  mbrDisk[ptOffset + 15] = (totalSectors >> 24) & 0xff;

  // MBR Boot signature
  mbrDisk[510] = 0x55;
  mbrDisk[511] = 0xaa;

  // Copy filesystem starting at sector 63
  mbrDisk.set(fatVolume, startSector * 512);

  return mbrDisk;
}

export async function createFat16ImageFromZip(
  zipFileOrBuffer: File | Blob | ArrayBuffer | Uint8Array,
  sizeMB: number = 32
): Promise<Uint8Array> {
  const capacity = sizeMB * 1024 * 1024;
  const img = new Uint8Array(capacity);
  
  // Create FAT16 filesystem structure
  const result = mkfsvfat(capacity, { type: 'FAT16' });
  if (!result) {
    throw new Error('Failed to create FAT16 structure');
  }
  
  // Write formatted sectors
  for (const sector of result.sectors.dataSectors) {
    img.set(sector.data, sector.i * result.sectors.bytsPerSec);
  }
  
  // Mount the in-memory disk
  const disk = mount(img);
  const fs = disk.getFileSystem();
  
  if (!fs) {
    throw new Error('Failed to mount generated FAT16 image');
  }
  
  const root = fs.getRoot();
  
  // Extract the zip
  const safeBuffer = await safeReadFileAsArrayBuffer(zipFileOrBuffer);
  const zipData = safeBuffer || zipFileOrBuffer;
  const zip = await JSZip.loadAsync(zipData);
  
  for (const [filename, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    
    // Normalize path for standard DOS 8.3 compatibility
    const parts = filename.split('/').filter(p => p.length > 0);
    if (parts.length === 0) continue;
    
    let currentDir = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let dirName = parts[i].toUpperCase().replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
      if (!dirName) dirName = 'DIR';
      let dir = currentDir.makeDir(dirName);
      if (!dir) {
        dir = currentDir.getFile(dirName);
      }
      if (dir && dir.isDirectory?.()) {
        currentDir = dir;
      }
    }
    
    const rawName = parts[parts.length - 1].toUpperCase();
    const dotIdx = rawName.lastIndexOf('.');
    let base = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
    let ext = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : '';
    base = base.replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
    ext = ext.replace(/[^A-Z0-9_-]/g, '_').slice(0, 3);
    const dosFileName = ext ? `${base}.${ext}` : base;

    try {
      const fileData = await zipEntry.async('uint8array');
      const newFile = currentDir.makeFile(dosFileName);
      if (newFile) {
        newFile.open()?.writeData(fileData);
      }
    } catch (e) {
      console.warn(`Could not write ${dosFileName} to FAT16 disk:`, e);
    }
  }
  
  // Wrap into partitioned MBR hard drive
  return wrapInMbr(img, sizeMB);
}

export async function createFat16ImageFromSingleFile(
  file: File | Blob | { name: string; buffer: ArrayBuffer },
  sizeMB: number = 16
): Promise<Uint8Array> {
  const capacity = sizeMB * 1024 * 1024;
  const img = new Uint8Array(capacity);
  
  const result = mkfsvfat(capacity, { type: 'FAT16' });
  if (!result) {
    throw new Error('Failed to create FAT16 structure');
  }
  
  for (const sector of result.sectors.dataSectors) {
    img.set(sector.data, sector.i * result.sectors.bytsPerSec);
  }
  
  const disk = mount(img);
  const fs = disk.getFileSystem();
  if (!fs) throw new Error('Failed to mount generated FAT16 image');
  
  const root = fs.getRoot();
  const rawFileName = 'name' in file ? file.name : 'PROGRAM.EXE';
  const rawName = rawFileName.toUpperCase();
  const dotIdx = rawName.lastIndexOf('.');
  let base = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
  let ext = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : '';
  base = base.replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
  ext = ext.replace(/[^A-Z0-9_-]/g, '_').slice(0, 3);
  const dosFileName = ext ? `${base}.${ext}` : base;

  let buffer: ArrayBuffer | null = null;
  if ('buffer' in file && file.buffer instanceof ArrayBuffer) {
    buffer = file.buffer;
  } else {
    buffer = await safeReadFileAsArrayBuffer(file as File | Blob);
  }

  const fileData = buffer ? new Uint8Array(buffer) : new Uint8Array(0);
  const newFile = root.makeFile(dosFileName);
  if (newFile) {
    newFile.open()?.writeData(fileData);
  }

  // Create auto-launch batch script
  const startBat = root.makeFile('START.BAT');
  if (startBat) {
    const batContent = `@ECHO OFF\r\nECHO Launching ${dosFileName}...\r\n${dosFileName}\r\n`;
    startBat.open()?.writeData(new TextEncoder().encode(batContent));
  }

  return wrapInMbr(img, sizeMB);
}

export function createFat16ImageFromBuffer(fileName: string, fileData: Uint8Array, sizeMB: number = 16): Uint8Array {
  const capacity = sizeMB * 1024 * 1024;
  const img = new Uint8Array(capacity);

  const result = mkfsvfat(capacity, { type: 'FAT16' });
  if (!result) {
    throw new Error('Failed to create FAT16 structure');
  }

  for (const sector of result.sectors.dataSectors) {
    img.set(sector.data, sector.i * result.sectors.bytsPerSec);
  }

  const disk = mount(img);
  const fs = disk.getFileSystem();
  if (!fs) throw new Error('Failed to mount generated FAT16 image');

  const root = fs.getRoot();
  const rawName = fileName.toUpperCase();
  const dotIdx = rawName.lastIndexOf('.');
  let base = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
  let ext = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : '';
  base = base.replace(/[^A-Z0-9_-]/g, '_').slice(0, 8);
  ext = ext.replace(/[^A-Z0-9_-]/g, '_').slice(0, 3);
  const dosFileName = ext ? `${base}.${ext}` : base;

  const newFile = root.makeFile(dosFileName);
  if (newFile) {
    newFile.open()?.writeData(fileData);
  }

  const startBat = root.makeFile('START.BAT');
  if (startBat) {
    const batContent = `@ECHO OFF\r\nECHO Launching ${dosFileName}...\r\n${dosFileName}\r\n`;
    startBat.open()?.writeData(new TextEncoder().encode(batContent));
  }

  return wrapInMbr(img, sizeMB);
}

export function createBlankWinchesterDrive(sizeMB: number = 64, _volumeLabel: string = 'WINCHEST'): Uint8Array {
  const capacity = sizeMB * 1024 * 1024;
  const img = new Uint8Array(capacity);

  const result = mkfsvfat(capacity, { type: 'FAT16' });
  if (!result) {
    throw new Error('Failed to format FAT16 Winchester Hard Disk');
  }

  for (const sector of result.sectors.dataSectors) {
    img.set(sector.data, sector.i * result.sectors.bytsPerSec);
  }

  const disk = mount(img);
  const fs = disk.getFileSystem();
  if (fs) {
    const root = fs.getRoot();
    const infoFile = root.makeFile('README.TXT');
    if (infoFile) {
      const text = `IBM PC Virtual Winchester Hard Disk (${sizeMB} MB)\r\nFormatted: FAT16 with Master Boot Record (MBR)\r\nReady for MS-DOS / Windows / FreeDOS data storage.\r\n`;
      infoFile.open()?.writeData(new TextEncoder().encode(text));
    }
  }

  return wrapInMbr(img, sizeMB);
}

export function createBlankFloppyDisk(sizeKB: 1440 | 720 | 2880 = 1440, _volumeLabel: string = 'FLOPPY'): Uint8Array {
  const capacity = sizeKB * 1024;
  const img = new Uint8Array(capacity);

  const result = mkfsvfat(capacity, { type: 'FAT12' });
  if (!result) {
    throw new Error('Failed to format FAT12 Floppy Disk');
  }

  for (const sector of result.sectors.dataSectors) {
    img.set(sector.data, sector.i * result.sectors.bytsPerSec);
  }

  const disk = mount(img);
  const fs = disk.getFileSystem();
  if (fs) {
    const root = fs.getRoot();
    const infoFile = root.makeFile('DISK.TXT');
    if (infoFile) {
      const text = `Virtual 3.5" Floppy Disk (${sizeKB} KB)\r\nFormatted FAT12. Ready for data exchange in DOS.\r\n`;
      infoFile.open()?.writeData(new TextEncoder().encode(text));
    }
  }

  return img;
}



