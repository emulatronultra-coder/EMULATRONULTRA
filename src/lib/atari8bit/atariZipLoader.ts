import JSZip from 'jszip';

export interface UnpackedAtariArchive {
  isZip: boolean;
  gameBytes?: Uint8Array;
  gameName?: string;
  osRomBytes?: Uint8Array;
  osRomName?: string;
  basicRomBytes?: Uint8Array;
  basicRomName?: string;
  files: { name: string; size: number; bytes: Uint8Array }[];
  summary: string;
}

/**
 * Checks if a byte array starts with the ZIP PK signature (0x50, 0x4B, 0x03, 0x04)
 */
export function isZipBuffer(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4B && (data[2] === 0x03 || data[2] === 0x05);
}

/**
 * Unpacks any ZIP archive containing Atari 8-Bit games or BIOS files (e.g. a800.zip)
 */
export async function unpackAtariArchive(buffer: ArrayBuffer | Uint8Array): Promise<UnpackedAtariArchive> {
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (!isZipBuffer(u8)) {
    return {
      isZip: false,
      gameBytes: u8,
      gameName: 'atari_file.xex',
      files: [{ name: 'atari_file.xex', size: u8.length, bytes: u8 }],
      summary: 'Raw Atari Binary',
    };
  }

  const zip = await JSZip.loadAsync(u8);
  const extractedFiles: { name: string; size: number; bytes: Uint8Array }[] = [];

  for (const [filename, fileEntry] of Object.entries(zip.files)) {
    if (fileEntry.dir) continue;
    // Skip OS X metadata artifacts
    if (filename.includes('__MACOSX') || filename.startsWith('.')) continue;

    const fileData = await fileEntry.async('uint8array');
    extractedFiles.push({
      name: filename.split('/').pop() || filename,
      size: fileData.length,
      bytes: fileData,
    });
  }

  if (extractedFiles.length === 0) {
    throw new Error('ZIP-архів не містить валідних файлів для Atari.');
  }

  let osRomBytes: Uint8Array | undefined;
  let osRomName: string | undefined;
  let basicRomBytes: Uint8Array | undefined;
  let basicRomName: string | undefined;
  let gameBytes: Uint8Array | undefined;
  let gameName: string | undefined;

  // 1. Search for Atari BIOS / OS ROMs (typical in a800.zip)
  for (const file of extractedFiles) {
    const lower = file.name.toLowerCase();

    // Atari XL/XE OS (16KB) or Atari 400/800 OS-B / OS-A (10KB)
    if (
      (lower.includes('atarixl') || lower.includes('atariosb') || lower.includes('ataria') || lower.includes('os-b') || lower.includes('xl.rom')) &&
      (file.size === 16384 || file.size === 10240 || file.size === 16384 + 16 || file.size === 10240 + 16)
    ) {
      osRomBytes = file.bytes;
      osRomName = file.name;
    }

    // Atari BASIC ROM (8KB)
    if (
      (lower.includes('ataribas') || lower.includes('basic.rom') || lower.includes('basic.bin')) &&
      (file.size === 8192 || file.size === 8192 + 16)
    ) {
      basicRomBytes = file.bytes;
      basicRomName = file.name;
    }
  }

  // Fallback check for OS if not matched by name: 16KB or 10KB ROM
  if (!osRomBytes) {
    const potentialOs = extractedFiles.find(
      (f) => f.size === 16384 || f.size === 10240
    );
    if (potentialOs) {
      osRomBytes = potentialOs.bytes;
      osRomName = potentialOs.name;
    }
  }

  // 2. Search for playable Atari game files (.xex, .atr, .xfd, .car, .dcm, .com, .exe, .bin)
  const playableExtensions = /\.(xex|atr|xfd|dcm|car|cas|com|exe)$/i;
  const gameCandidate = extractedFiles.find(
    (f) => playableExtensions.test(f.name) && f.name !== osRomName && f.name !== basicRomName
  );

  if (gameCandidate) {
    gameBytes = gameCandidate.bytes;
    gameName = gameCandidate.name;
  } else {
    // If no .xex or .atr, search for non-BIOS binary files
    const otherBin = extractedFiles.find(
      (f) => f.name !== osRomName && f.name !== basicRomName && (f.name.endsWith('.bin') || f.name.endsWith('.rom'))
    );
    if (otherBin) {
      gameBytes = otherBin.bytes;
      gameName = otherBin.name;
    }
  }

  let summary = `Розархівовано ${extractedFiles.length} файл(ів).`;
  if (gameName) {
    summary += ` Знайдено гру: ${gameName}`;
  }
  if (osRomName) {
    summary += ` BIOS OS: ${osRomName}`;
  }
  if (basicRomName) {
    summary += ` BASIC: ${basicRomName}`;
  }

  return {
    isZip: true,
    gameBytes,
    gameName,
    osRomBytes,
    osRomName,
    basicRomBytes,
    basicRomName,
    files: extractedFiles,
    summary,
  };
}
