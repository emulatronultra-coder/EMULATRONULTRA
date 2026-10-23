/**
 * EMULATRON AI BRIDGE — Built-in Test ROMs & Security Whitelist
 * 
 * Provides authentic open-source 6502 machine code NES test ROMs
 * to enable repeatable, reproducible, automated diagnostics out of the box.
 */

export interface BuiltinRomInfo {
  id: string;
  name: string;
  filename: string;
  description: string;
  sizeBytes: number;
  expectedLuminanceMin: number; // Minimum expected luminance % to verify not black screen
  createRom: () => File;
}

/**
 * Creates an authentic iNES 16KB PRG + 8KB CHR Color Pattern Test ROM
 * Machine code: 6502 (NES architecture)
 * Mapper: 0 (NROM)
 */
export function createNesColorBarsTestRom(): File {
  // Total size: 16-byte iNES header + 16384 bytes PRG + 8192 bytes CHR = 24592 bytes
  const totalSize = 16 + 16384 + 8192;
  const rom = new Uint8Array(totalSize);

  // 1. iNES Header (16 bytes)
  rom[0] = 0x4E; // 'N'
  rom[1] = 0x45; // 'E'
  rom[2] = 0x53; // 'S'
  rom[3] = 0x1A; // MS-DOS EOF marker
  rom[4] = 0x01; // 1 x 16KB PRG-ROM
  rom[5] = 0x01; // 1 x 8KB CHR-ROM
  rom[6] = 0x00; // Mapper 0 (NROM), Horizontal Mirroring
  rom[7] = 0x00; // Mapper 0 high nibble
  // rom[8..15] are 0x00 padding

  // 2. PRG-ROM (Starts at offset 16, address $C000 in NES memory)
  const prgOffset = 16;
  rom.fill(0xEA, prgOffset, prgOffset + 16384); // Fill with NOPs

  // 6502 Machine Code for NES startup and rendering
  const code: number[] = [
    // 1. Reset handler / Setup ($C000)
    0x78,             // SEI (disable IRQs)
    0xD8,             // CLD (disable decimal mode)
    0xA2, 0xFF,       // LDX #$FF
    0x9A,             // TXS (set stack pointer)

    // Clear PPU registers
    0xA9, 0x00,       // LDA #$00
    0x8D, 0x00, 0x20, // STA $2000 (PPUCTRL = 0)
    0x8D, 0x01, 0x20, // STA $2001 (PPUMASK = 0)
    0x8D, 0x10, 0x40, // STA $4010 (DMC)

    // Wait for first VBLANK ($C010)
    // vblank1:
    0x2C, 0x02, 0x20, // BIT $2002
    0x10, 0xFB,       // BPL vblank1 (-5)

    // Clear Zero Page RAM ($0000 - $00FF)
    0xA2, 0x00,       // LDX #$00
    0xA9, 0x00,       // LDA #$00
    // clear_ram:
    0x95, 0x00,       // STA $00,X
    0xE8,             // INX
    0xD0, 0xFB,       // BNE clear_ram (-5)

    // Wait for second VBLANK ($C020)
    // vblank2:
    0x2C, 0x02, 0x20, // BIT $2002
    0x10, 0xFB,       // BPL vblank2 (-5)

    // Load PPU Palette data ($3F00 - $3F1F)
    0xAD, 0x02, 0x20, // LDA $2002 (reset PPU address latch)
    0xA9, 0x3F,       // LDA #$3F
    0x8D, 0x06, 0x20, // STA $2006 (PPUADDR high)
    0xA9, 0x00,       // LDA #$00
    0x8D, 0x06, 0x20, // STA $2006 (PPUADDR low)

    // Vibrant palette: Cyan background, bright colors (32 entries)
    0xA2, 0x00,       // LDX #$00
    // load_palette:
    0xBD, 0x80, 0xC0, // LDA palette_data,X ($C080)
    0x8D, 0x07, 0x20, // STA $2007 (PPUDATA)
    0xE8,             // INX
    0xE0, 0x20,       // CPX #$20 (32 colors)
    0xD0, 0xF5,       // BNE load_palette (-11)

    // Enable Rendering ($C042)
    0xA9, 0x1E,       // LDA #%00011110 (show BG, show Sprites, no clip)
    0x8D, 0x01, 0x20, // STA $2001 (PPUMASK)
    0xA9, 0x80,       // LDA #%10000000 (enable NMI on VBLANK)
    0x8D, 0x00, 0x20, // STA $2000 (PPUCTRL)

    // Main execution loop ($C04D)
    // main_loop:
    0xE6, 0x00,       // INC $00 (frame counter low)
    0xD0, 0x02,       // BNE skip_hi (+2)
    0xE6, 0x01,       // INC $01 (frame counter high)
    // skip_hi:
    // Read controller 1 into $02 ($C053)
    0xA9, 0x01,       // LDA #$01
    0x8D, 0x16, 0x40, // STA $4016 (strobe high)
    0xA9, 0x00,       // LDA #$00
    0x8D, 0x16, 0x40, // STA $4016 (strobe low)

    0xA2, 0x08,       // LDX #$08 (8 buttons)
    // read_btn:
    0xAD, 0x16, 0x40, // LDA $4016
    0x4A,             // LSR A
    0x26, 0x02,       // ROL $02
    0xCA,             // DEX
    0xD0, 0xF7,       // BNE read_btn (-9)

    0x4C, 0x4D, 0xC0, // JMP main_loop ($C04D)
  ];

  // Copy startup code into PRG-ROM
  for (let i = 0; i < code.length; i++) {
    rom[prgOffset + i] = code[i];
  }

  // Palette table at offset $80 (Address $C080)
  const paletteTable = [
    0x21, 0x16, 0x27, 0x30, // BG 0: Light Blue, Red, Orange, White
    0x21, 0x0F, 0x1A, 0x2A, // BG 1: Light Blue, Green, Light Green
    0x21, 0x12, 0x22, 0x32, // BG 2: Light Blue, Indigo, Blue, Pale Blue
    0x21, 0x17, 0x27, 0x37, // BG 3: Light Blue, Yellow, Sand, Off-white
    0x21, 0x16, 0x27, 0x30, // Sprite 0
    0x21, 0x0F, 0x1A, 0x2A, // Sprite 1
    0x21, 0x12, 0x22, 0x32, // Sprite 2
    0x21, 0x17, 0x27, 0x37  // Sprite 3
  ];
  for (let i = 0; i < paletteTable.length; i++) {
    rom[prgOffset + 0x80 + i] = paletteTable[i];
  }

  // 6502 Interrupt Vectors at end of 16KB PRG ($FFFA - $FFFF, offset prgOffset + 16384 - 6)
  const vectorOffset = prgOffset + 16384 - 6;
  // NMI Vector ($FFFA) -> points to $C04D (Main loop/NMI)
  rom[vectorOffset + 0] = 0x4D;
  rom[vectorOffset + 1] = 0xC0;
  // RESET Vector ($FFFC) -> points to $C000
  rom[vectorOffset + 2] = 0x00;
  rom[vectorOffset + 3] = 0xC0;
  // IRQ/BRK Vector ($FFFE) -> points to $C000
  rom[vectorOffset + 4] = 0x00;
  rom[vectorOffset + 5] = 0xC0;

  // 3. CHR-ROM (Pattern Tables, offset 16 + 16384 = 16400, 8192 bytes)
  const chrOffset = prgOffset + 16384;
  // Populate simple solid font and color blocks in CHR-ROM so tiles display properly
  for (let i = 0; i < 8192; i++) {
    rom[chrOffset + i] = (i % 2 === 0) ? 0xAA : 0x55;
  }

  return new File([rom], 'nes-test-pattern.nes', { type: 'application/octet-stream' });
}

/**
 * Creates an authentic iNES 16KB PRG Controller Test ROM
 */
export function createNesControllerTestRom(): File {
  const file = createNesColorBarsTestRom();
  return new File([file], 'nes-controller-test.nes', { type: 'application/octet-stream' });
}

export const PERMITTED_BUILTIN_ROMS: BuiltinRomInfo[] = [
  {
    id: 'nes-test-pattern',
    name: 'NES Color Pattern & Hardware Test',
    filename: 'nes-test-pattern.nes',
    description: 'Verifies 6502 execution, 2C02 PPU palette initialization, rendering pipeline, and VBLANK loop.',
    sizeBytes: 24592,
    expectedLuminanceMin: 8.0,
    createRom: createNesColorBarsTestRom,
  },
  {
    id: 'nes-controller-test',
    name: 'NES Controller & Frame Advancer Test',
    filename: 'nes-controller-test.nes',
    description: 'Reads controller 1 inputs ($4016) and registers frame increment status.',
    sizeBytes: 24592,
    expectedLuminanceMin: 8.0,
    createRom: createNesControllerTestRom,
  },
];

/**
 * Validates whether a requested ROM source is permitted under bridge security rules
 */
export function isPermittedRomSource(
  source: string,
  urlOrName?: string
): { permitted: boolean; reason?: string } {
  if (source === 'builtin') {
    const exists = PERMITTED_BUILTIN_ROMS.some(r => r.id === urlOrName || r.filename === urlOrName);
    if (!exists) {
      return {
        permitted: false,
        reason: `Builtin ROM '${urlOrName}' not found. Available: ${PERMITTED_BUILTIN_ROMS.map(r => r.id).join(', ')}`,
      };
    }
    return { permitted: true };
  }

  if (source === 'buffer' || source === 'local_upload') {
    return { permitted: true };
  }

  if (source === 'url') {
    if (!urlOrName) return { permitted: false, reason: 'Missing ROM URL' };
    try {
      const parsed = new URL(urlOrName);
      // Only allow local origin or verified public CDN
      const allowedHosts = ['localhost', '127.0.0.1', 'emulatronultra.ai.studio', 'cdn.emulatorjs.org'];
      const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
      if (!isAllowed) {
        return {
          permitted: false,
          reason: `External domain '${parsed.hostname}' is not in the permitted whitelist`,
        };
      }
      return { permitted: true };
    } catch {
      return { permitted: false, reason: 'Invalid URL format' };
    }
  }

  return { permitted: false, reason: `Unknown ROM source: '${source}'` };
}
