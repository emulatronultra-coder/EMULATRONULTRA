/**
 * Built-in open-source homebrew test ROMs for Atari consoles
 * Allows immediate out-of-the-box emulation testing without requiring external files.
 */

/**
 * Creates an authentic 4KB Atari 2600 Rainbow Color Bars Test ROM (6502 machine code)
 */
export function createAtari2600DemoRom(): File {
  const rom = new Uint8Array(4096);
  // Fill with NOPs (0xEA)
  rom.fill(0xEA);

  // 6502 Machine code starting at offset 0 (Address $F000)
  const code = [
    // Init registers
    0x78,             // SEI
    0xD8,             // CLD
    0xA2, 0xFF,       // LDX #$FF
    0x9A,             // TXS
    0xA9, 0x00,       // LDA #0
    // Clear RAM / TIA ($00 to $FF)
    0x95, 0x00,       // STA $00,X
    0xCA,             // DEX
    0xD0, 0xFB,       // BNE clear

    // Frame Start loop ($F00C)
    0xA9, 0x02,       // LDA #2
    0x85, 0x02,       // STA $02 (WSYNC)
    0x85, 0x00,       // STA $00 (VSYNC on)
    0x85, 0x02,       // STA $02 (WSYNC line 1)
    0x85, 0x02,       // STA $02 (WSYNC line 2)
    0x85, 0x02,       // STA $02 (WSYNC line 3)
    0xA9, 0x00,       // LDA #0
    0x85, 0x00,       // STA $00 (VSYNC off)

    // 37 scanlines of VBLANK ($F01C)
    0xA2, 0x25,       // LDX #37
    // vblank_loop:
    0x85, 0x02,       // STA $02 (WSYNC)
    0xCA,             // DEX
    0xD0, 0xFB,       // BNE vblank_loop
    0x85, 0x01,       // STA $01 (VBLANK off)

    // Increment frame counter in RAM ($80)
    0xE6, 0x80,       // INC $80

    // 192 scanlines of animated rainbow bars ($F027)
    0xA2, 0xC0,       // LDX #192
    0xA5, 0x80,       // LDA $80 (base color)
    // visible_loop:
    0x85, 0x09,       // STA $09 (COLUBK)
    0x18,             // CLC
    0x69, 0x01,       // ADC #1
    0x85, 0x02,       // STA $02 (WSYNC)
    0xCA,             // DEX
    0xD0, 0xF6,       // BNE visible_loop

    // 30 scanlines of overscan ($F035)
    0xA9, 0x02,       // LDA #2
    0x85, 0x01,       // STA $01 (VBLANK on)
    0xA2, 0x1E,       // LDX #30
    // overscan_loop:
    0x85, 0x02,       // STA $02 (WSYNC)
    0xCA,             // DEX
    0xD0, 0xFB,       // BNE overscan_loop

    // Jump back to frame start ($F040 -> $F00C)
    0x4C, 0x0C, 0xF0  // JMP $F00C
  ];

  rom.set(code, 0);

  // Set 6502 Interrupt and Reset Vectors at the top of 4KB space:
  // $FFFA (NMI): $F000
  rom[4090] = 0x00;
  rom[4091] = 0xF0;
  // $FFFC (RESET): $F000
  rom[4092] = 0x00;
  rom[4093] = 0xF0;
  // $FFFE (IRQ): $F000
  rom[4094] = 0x00;
  rom[4095] = 0xF0;

  return new File([rom], 'Atari_2600_Rainbow_Test.a26', { type: 'application/octet-stream' });
}

/**
 * Creates a valid 32KB Atari 7800 ProSystem Color Test ROM with official 128-byte A78 header
 */
export function createAtari7800DemoRom(): File {
  const headerSize = 128;
  const romSize = 32768;
  const total = headerSize + romSize;
  const data = new Uint8Array(total);
  data.fill(0xEA); // Fill with NOPs

  // 1. Build 128-byte A78 Header
  // Magic bytes "ATARI7800"
  const magic = [0x41, 0x54, 0x41, 0x52, 0x49, 0x37, 0x38, 0x30, 0x30];
  data.set(magic, 0);

  // Title at offset 16..47
  const title = "Atari 7800 Color Test";
  for (let i = 0; i < title.length; i++) {
    data[16 + i] = title.charCodeAt(i);
  }

  // ROM size at offset 48..51: 32768 = 0x00008000
  data[48] = 0x00;
  data[49] = 0x00;
  data[50] = 0x80;
  data[51] = 0x00;

  // Cartridge type: 0 (standard 32KB)
  data[52] = 0x00;
  // Controller 1: 1 (7800 Joystick)
  data[53] = 0x01;
  // Controller 2: 1 (7800 Joystick)
  data[54] = 0x01;
  // TV type: 0 (NTSC)
  data[55] = 0x00;

  // 2. 6502 code starting at offset 128 (Address $8000)
  const code = [
    0x78,             // SEI
    0xD8,             // CLD
    0xA2, 0xFF,       // LDX #$FF
    0x9A,             // TXS
    0xA9, 0x00,       // LDA #0
    0x85, 0x01,       // STA $01 (VBLANK off)

    // Loop
    // $800A:
    0xA9, 0x00,       // LDA #0
    0x85, 0x09,       // STA $09
    0xE6, 0x80,       // INC $80
    0xA5, 0x80,       // LDA $80
    0x85, 0x09,       // STA $09
    0x85, 0x02,       // STA $02 (WSYNC)
    0x4C, 0x0A, 0x80  // JMP $800A
  ];
  data.set(code, headerSize);

  // Reset vector at offset (total - 4) pointing to $8000
  data[total - 4] = 0x00;
  data[total - 3] = 0x80;
  data[total - 2] = 0x00;
  data[total - 1] = 0x80;

  return new File([data], 'Atari_7800_Color_Test.a78', { type: 'application/octet-stream' });
}

/**
 * Creates a valid Atari 5200 32KB Cartridge ROM ($4000-$BFFF)
 */
export function createAtari5200DemoRom(): File {
  const romSize = 32768;
  const data = new Uint8Array(romSize);
  data.fill(0xEA);

  // Code at start of ROM (mapped at $4000)
  const code = [
    0x78,             // SEI
    0xD8,             // CLD
    0xA2, 0xFF,       // LDX #$FF
    0x9A,             // TXS
    // Background color register in GTIA ($C01A / $D01A)
    // Loop
    0xA9, 0x28,       // LDA #$28
    0x8D, 0x1A, 0xC0, // STA $C01A
    0xE6, 0x80,       // INC $80
    0xA5, 0x80,       // LDA $80
    0x8D, 0x1A, 0xC0, // STA $C01A
    0x4C, 0x08, 0x40  // JMP $4008
  ];
  data.set(code, 0);

  // Atari 5200 Cartridge Start Vector at $BFFC (offset 32764 in 32K cart)
  data[romSize - 4] = 0x00;
  data[romSize - 3] = 0x40; // $4000
  data[romSize - 2] = 0x00;
  data[romSize - 1] = 0x40;

  return new File([data], 'Atari_5200_Color_Test.a52', { type: 'application/octet-stream' });
}

/**
 * Creates a valid Atari Lynx 16-Bit Handheld Test ROM (.lnx)
 */
export function createAtariLynxDemoRom(): File {
  // 64-byte standard LNX header followed by bank 0 data
  const romSize = 64 * 1024; // 64KB cart
  const data = new Uint8Array(64 + romSize);

  // Magic 'LYNX'
  data[0] = 0x4C; // L
  data[1] = 0x59; // Y
  data[2] = 0x4E; // N
  data[3] = 0x58; // X

  // Bank 0 page size = 256 (0x0100, little endian)
  data[4] = 0x00;
  data[5] = 0x01;

  // Bank 1 page size = 0
  data[6] = 0x00;
  data[7] = 0x00;

  // Header version = 1
  data[8] = 0x01;
  data[9] = 0x00;

  // Cart Title (32 bytes ASCII)
  const title = 'Atari Lynx Color Test';
  for (let i = 0; i < title.length; i++) {
    data[10 + i] = title.charCodeAt(i);
  }

  // Manufacturer (16 bytes ASCII)
  const mfg = 'RetroEmu VM';
  for (let i = 0; i < mfg.length; i++) {
    data[42 + i] = mfg.charCodeAt(i);
  }

  // Rotation = 0 (Normal landscape)
  data[58] = 0x00;

  // Fill cart ROM data: simple 65C02 loop and Suzy / Mikey register initializations
  const romOffset = 64;
  for (let i = 0; i < romSize; i++) {
    data[romOffset + i] = 0xEA; // NOP
  }

  // Code at beginning of cart bank
  const code = [
    0x78,             // SEI
    0xD8,             // CLD
    0xA2, 0xFF,       // LDX #$FF
    0x9A,             // TXS
    // Loop cycling Mikey background palette / Suzy registers
    0xA9, 0x0F,       // LDA #$0F
    0x8D, 0x00, 0xFD, // STA $FD00 (Mikey Green/Blue/Red palette 0)
    0xEE, 0x00, 0xFD, // loop: INC $FD00
    0x4C, 0x0B, 0x02  // JMP loop
  ];
  data.set(code, romOffset);

  // Reset vector at $FFFC-$FFFD (cart top offset)
  data[romOffset + romSize - 4] = 0x00;
  data[romOffset + romSize - 3] = 0x02; // Vector pointing to $0200
  data[romOffset + romSize - 2] = 0x00;
  data[romOffset + romSize - 1] = 0x02;

  return new File([data], 'Atari_Lynx_Color_Test.lnx', { type: 'application/octet-stream' });
}

/**
 * Creates a valid Atari 8-Bit (400/800/XL/XE) Executable Test ROM (.xex)
 */
export function createAtari8BitDemoRom(): File {
  const bytes = [
    // Atari DOS binary load file magic ($FFFF)
    0xFF, 0xFF,
    // Start address: $2000
    0x00, 0x20,
    // End address: $201F
    0x1F, 0x20,
    // 6502 code:
    0x78,             // SEI
    0xD8,             // CLD
    0xA9, 0x00,       // LDA #0
    0x8D, 0x0A, 0xD4, // loop: STA $D40A (WSYNC in ANTIC)
    0xEE, 0x1A, 0xD0, // INC $D01A (COLBK - background color in GTIA)
    0xEE, 0x18, 0xD0, // INC $D018 (COLOR2)
    0x4C, 0x04, 0x20, // JMP $2004
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    // Run Vector ($02E0..$02E1 = RUNAD)
    0xE0, 0x02,
    0xE1, 0x02,
    0x04, 0x20        // Jump to entry point $2004
  ];

  return new File([new Uint8Array(bytes)], 'Atari_8Bit_Color_Test.xex', { type: 'application/octet-stream' });
}

/**
 * Creates a valid Atari ST GEMDOS Executable Test ROM (.prg)
 */
export function createAtariStDemoRom(): File {
  // 68000 machine code for Atari ST TOS
  const textCode = [
    // Super mode: clr.l -(sp); move.w #32,-(sp); trap #1; addq.l #6,sp
    0x42, 0xA7,                         // clr.l -(sp)
    0x3F, 0x3C, 0x00, 0x20,             // move.w #32,-(sp)
    0x4E, 0x41,                         // trap #1
    0x5C, 0x8F,                         // addq.l #6,sp
    // loop:
    // addq.w #1,$ffff8240 (cycle palette register 0 on ST Shifter)
    0x52, 0x79, 0x00, 0xFF, 0x82, 0x40, // addq.w #1,$ffff8240
    // delay:
    0x30, 0x3C, 0x04, 0x00,             // move.w #1024,d0
    0x51, 0xC8, 0xFF, 0xFE,             // dbra d0,*
    // bra.s loop
    0x60, 0xF0
  ];

  const header = new Uint8Array(28 + textCode.length + 4);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0x601A);          // GEMDOS PRG magic
  view.setUint32(2, textCode.length); // Text length
  view.setUint32(6, 0);               // Data length
  view.setUint32(10, 0);              // BSS length
  view.setUint32(14, 0);              // Symbol length
  view.setUint32(18, 0);              // Reserved
  view.setUint32(22, 0);              // Flags
  view.setUint16(26, 1);              // Absolute flag (no relocation)

  header.set(textCode, 28);
  return new File([header], 'Atari_ST_Color_Test.prg', { type: 'application/octet-stream' });
}
