import JSZip from 'jszip';

export interface DiskEntry {
  name: string;
  data: Uint8Array;
}

export interface MultiDiskBundleResult {
  blob: Blob;
  blobUrl: string;
  bundleFileName: string;
  gameName: string;
  isMultiDisk: boolean;
  diskCount: number;
  disks?: DiskEntry[];
  m3uContent?: string;
  m3uFileName?: string;
  singleRomName?: string;
}

/**
 * Extracts a clean game name from a disk filename by removing disk numbers, extensions, and tags.
 * e.g., "Monkey Island (Disk 1 of 4).adf" -> "Monkey Island"
 */
export function extractCleanGameName(fileName: string): string {
  let name = fileName.replace(/\.[^/.]+$/, ''); // remove extension
  // Remove common disk tags: (Disk 1), [Disk 1 of 3], _Disk1, - Disk 1, (Disk A), etc.
  name = name.replace(/[-_.\s]*[\(\[]?\s*(?:disk|disc|side|part)\s*[0-9a-zA-Z]+(?:\s*of\s*[0-9]+)?\s*[\)\]]?/gi, '');
  // Clean up any remaining trailing hyphens or underscores
  name = name.trim().replace(/[-_]+$/, '').trim();
  return name || 'Game';
}

/**
 * Natural sort for disk files so Disk 1, Disk 2, Disk 3 ... Disk 10 stay in exact numerical order.
 */
export function sortDiskFiles(files: File[]): File[] {
  return [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Generates an in-memory package with an .m3u playlist and disk entries for multi-disk systems (Amiga, C64, etc.)
 */
export async function createMultiDiskBundle(
  files: File[],
  suggestedName?: string,
  isMame?: boolean
): Promise<MultiDiskBundleResult> {
  if (files.length === 0) {
    throw new Error('No files provided');
  }

  // Case 0: For MAME / Arcade ROMs, always keep the zip file intact as a single ROM package
  if (isMame && files.length === 1) {
    const file = files[0];
    const cleanName = suggestedName || extractCleanGameName(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    return {
      blob: file,
      blobUrl: URL.createObjectURL(file),
      bundleFileName: file.name,
      gameName: cleanName,
      isMultiDisk: false,
      diskCount: 1,
      disks: [{ name: file.name, data }],
      singleRomName: file.name,
    };
  }

  // Case 1: Single non-zip file
  if (files.length === 1 && !files[0].name.toLowerCase().endsWith('.zip')) {
    const file = files[0];
    const cleanName = suggestedName || extractCleanGameName(file.name);
    const data = new Uint8Array(await file.arrayBuffer());
    return {
      blob: file,
      blobUrl: URL.createObjectURL(file),
      bundleFileName: file.name,
      gameName: cleanName,
      isMultiDisk: false,
      diskCount: 1,
      disks: [{ name: file.name, data }],
      singleRomName: file.name,
    };
  }

  // Case 2: Single ZIP file
  if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
    const zipFile = files[0];
    const cleanName = suggestedName || extractCleanGameName(zipFile.name);
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const allFiles = Object.keys(zip.files).filter(
        f => !zip.files[f].dir && !f.startsWith('__MACOSX') && !f.startsWith('.')
      );

      const diskFileNames = allFiles
        .filter(f => /\.(adf|dms|ipf|d64|g64|prg|tap|t64|img|ima|cue|bin|iso|nes|sfc|smc|md|gen|sms|gg|gb|gbc|gba|a26|a52|a78|lnx|lyx|j64|jag|atr|xfd|atx|xex|cas|car|st|msa|stx|dim|tos|rom|chd|pbp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      // Extract all disk/track entries into memory
      const diskEntries: DiskEntry[] = [];
      for (const fName of diskFileNames) {
        const u8 = await zip.files[fName].async('uint8array');
        const baseName = fName.split('/').pop() || fName;
        diskEntries.push({ name: baseName, data: u8 });
      }

      // Check if this is a CUE + BIN image set
      const cueFiles = diskEntries.filter(d => d.name.toLowerCase().endsWith('.cue'));
      if (cueFiles.length === 1) {
        // Single CD image with cue/bin: boot directly from the .cue file
        const cueEntry = cueFiles[0];
        const blob = new Blob([cueEntry.data]);
        return {
          blob,
          blobUrl: URL.createObjectURL(blob),
          bundleFileName: cueEntry.name,
          gameName: cleanName,
          isMultiDisk: false,
          diskCount: 1,
          disks: diskEntries,
          singleRomName: cueEntry.name,
        };
      }

      // Floppy multi-disk or multi-CUE CD setup
      const isMulti = diskEntries.length > 1;
      const m3uName = `${cleanName}.m3u`;
      const m3uList = cueFiles.length > 1 ? cueFiles : diskEntries;
      const m3uContent = isMulti ? m3uList.map(d => d.name).join('\n') : undefined;

      const blob = isMulti
        ? new Blob([m3uContent || ''], { type: 'text/plain' })
        : (diskEntries.length === 1 ? new Blob([diskEntries[0].data]) : zipFile);

      return {
        blob,
        blobUrl: URL.createObjectURL(blob),
        bundleFileName: isMulti ? m3uName : (diskEntries[0]?.name || zipFile.name),
        gameName: cleanName,
        isMultiDisk: isMulti,
        diskCount: diskEntries.length || 1,
        disks: diskEntries,
        m3uContent,
        m3uFileName: isMulti ? m3uName : undefined,
        singleRomName: diskEntries.length === 1 ? diskEntries[0].name : undefined,
      };
    } catch (err) {
      console.warn('Failed to parse zip archive with JSZip, using raw file:', err);
      const data = new Uint8Array(await zipFile.arrayBuffer());
      return {
        blob: zipFile,
        blobUrl: URL.createObjectURL(zipFile),
        bundleFileName: zipFile.name,
        gameName: cleanName,
        isMultiDisk: false,
        diskCount: 1,
        disks: [{ name: zipFile.name, data }],
        singleRomName: zipFile.name,
      };
    }
  }

  // Case 3: Multiple individual files selected (2, 3, 4, etc.)
  const sorted = sortDiskFiles(files);
  const cleanName = suggestedName || extractCleanGameName(sorted[0].name);

  const diskEntries: DiskEntry[] = [];
  for (const file of sorted) {
    const arrayBuffer = await file.arrayBuffer();
    diskEntries.push({
      name: file.name,
      data: new Uint8Array(arrayBuffer),
    });
  }

  // Check if multiple files contain exactly one .cue file (e.g. game.cue + game.bin)
  const cueFiles = diskEntries.filter(d => d.name.toLowerCase().endsWith('.cue'));
  if (cueFiles.length === 1) {
    const cueEntry = cueFiles[0];
    const blob = new Blob([cueEntry.data]);
    return {
      blob,
      blobUrl: URL.createObjectURL(blob),
      bundleFileName: cueEntry.name,
      gameName: cleanName,
      isMultiDisk: false,
      diskCount: 1,
      disks: diskEntries,
      singleRomName: cueEntry.name,
    };
  }

  // True multi-disk setup (e.g. Disk1.adf, Disk2.adf, Disk3.adf)
  const m3uFileName = `${cleanName}.m3u`;
  const m3uList = cueFiles.length > 1 ? cueFiles : diskEntries;
  const m3uContent = m3uList.map(d => d.name).join('\n');
  const m3uBlob = new Blob([m3uContent], { type: 'text/plain' });

  return {
    blob: m3uBlob,
    blobUrl: URL.createObjectURL(m3uBlob),
    bundleFileName: m3uFileName,
    gameName: cleanName,
    isMultiDisk: true,
    diskCount: sorted.length,
    disks: diskEntries,
    m3uContent,
    m3uFileName,
  };
}
