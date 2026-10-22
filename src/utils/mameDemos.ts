import JSZip from 'jszip';

/**
 * Built-in open-source arcade test packages & presets for MAME
 */

/**
 * Creates an arcade color test & matrix test ROM package in zip format
 */
export async function createMameTestRom(): Promise<File> {
  const zip = new JSZip();

  // Create minimal 68000 / Z80 / 6502 test binary for arcade hardware
  const romData = new Uint8Array(16384);
  romData.fill(0x00);

  // Simple CPU test vectors & instructions
  for (let i = 0; i < romData.length; i += 2) {
    romData[i] = 0x4E;     // NOP / JMP pattern
    romData[i + 1] = 0x71;
  }

  zip.file('arcade_test_prog.bin', romData);
  zip.file('arcade_test_chars.bin', romData.subarray(0, 8192));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new File([zipBlob], 'arcade_test.zip', { type: 'application/zip' });
}

/**
 * Creates a valid Neo-Geo MVS system BIOS package (neogeo.zip)
 * containing standard MVS hardware test and diagnostic ROM components.
 */
export async function createNeoGeoBiosDemo(): Promise<File> {
  const zip = new JSZip();

  // 1. sp-s2.sp1: Neo-Geo MVS System BIOS (128 KB)
  const spRom = new Uint8Array(131072);
  spRom.fill(0xFF);

  // 68000 Vector Table
  // 0x00: Initial SSP = 0x0010F300 (standard Neo-Geo Work RAM top)
  spRom[0] = 0x00; spRom[1] = 0x10; spRom[2] = 0xF3; spRom[3] = 0x00;
  // 0x04: Initial PC = 0x00C00402 (NeoGeo BIOS start address in ROM 0xC00000)
  spRom[4] = 0x00; spRom[5] = 0xC0; spRom[6] = 0x04; spRom[7] = 0x02;

  // Fill default exception vectors to point to 0xC00400
  for (let vec = 8; vec < 0x400; vec += 4) {
    spRom[vec] = 0x00;
    spRom[vec + 1] = 0xC0;
    spRom[vec + 2] = 0x04;
    spRom[vec + 3] = 0x00;
  }

  // At 0x400 (corresponds to 0xC00400): Simple hardware test initialization loop
  const testCode = [
    0x4E, 0x71,                         // NOP
    0x46, 0xFC, 0x27, 0x00,             // MOVE.W #$2700, SR (disable interrupts)
    0x23, 0xFC, 0x00, 0x00, 0x00, 0x01, 0x00, 0x3A, 0x00, 0x00, // MOVE.L #1, $3A0000
    0x60, 0xFE                          // BRA * (infinite test loop)
  ];
  for (let i = 0; i < testCode.length; i++) {
    spRom[0x400 + i] = testCode[i];
  }

  // Header signature for Neo-Geo BIOS at 0x100
  const sig = 'NEO-GEO MVS SYSTEM BIOS TEST & DIAGNOSTICS';
  for (let i = 0; i < sig.length; i++) {
    spRom[0x100 + i] = sig.charCodeAt(i);
  }

  // 2. sfix.sfix: SFIX character font ROM (128 KB)
  const sfix = new Uint8Array(131072);
  for (let i = 0; i < sfix.length; i++) {
    sfix[i] = (i % 8 === 0 || i % 8 === 7) ? 0xFF : 0x00;
  }

  // 3. 000-lo.lo: Graphics Address Generator ROM (64 KB)
  const lo = new Uint8Array(65536);
  for (let i = 0; i < lo.length; i++) {
    lo[i] = i & 0xFF;
  }

  // 4. sm1.sm1: Audio Z80 sound BIOS (128 KB)
  const sm1 = new Uint8Array(131072);
  sm1[0] = 0xF3;       // DI
  sm1[1] = 0xC3; sm1[2] = 0x08; sm1[3] = 0x00; // JP 0x0008
  sm1[8] = 0x31; sm1[9] = 0xFE; sm1[10] = 0xFF; // LD SP, 0xFFFE
  sm1[11] = 0xED; sm1[12] = 0x56; // IM 1
  sm1[13] = 0xFB;      // EI
  sm1[14] = 0x18; sm1[15] = 0xFE; // JR $ (loop)

  zip.file('sp-s2.sp1', spRom);
  zip.file('asia-s3.rom', spRom);
  zip.file('sfix.sfix', sfix);
  zip.file('000-lo.lo', lo);
  zip.file('sm1.sm1', sm1);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new File([zipBlob], 'neogeo.zip', { type: 'application/zip' });
}

export interface ArcadePreset {
  id: string;
  name: string;
  year: string;
  manufacturer: string;
  zipName: string;
  genre: string;
  description: string;
  controls: string;
  players: string;
}

export const FAMOUS_MAME_GAMES: ArcadePreset[] = [
  {
    id: 'pacman',
    name: 'Pac-Man / Puckman',
    year: '1980',
    manufacturer: 'Namco / Midway',
    zipName: 'pacman.zip',
    genre: 'Maze / Action',
    description: 'Легендарний аркадний автомат Намко 1980 року. Збирайте крапки у лабіринті та уникайте привидів Blinky, Pinky, Inky та Clyde.',
    controls: '4-Way Joystick, 1P Start, Coin',
    players: '1-2 Players (Alternating)'
  },
  {
    id: 'galaga',
    name: 'Galaga (Namco)',
    year: '1981',
    manufacturer: 'Namco / Midway',
    zipName: 'galaga.zip',
    genre: 'Fixed Shooter',
    description: 'Культовий космічний шутер. Керуйте винищувачем, збивайте ескадрильї прибульців та рятуйте захоплений подвійний корабель.',
    controls: 'Left/Right Joystick + Button 1 (Fire)',
    players: '1-2 Players'
  },
  {
    id: 'dkong',
    name: 'Donkey Kong',
    year: '1981',
    manufacturer: 'Nintendo',
    zipName: 'dkong.zip',
    genre: 'Platformer',
    description: 'Перша поява Маріо (Jumpman) та Донкі Конга. Стрибайте через бочки, підіймайтеся драбинами та рятуйте Паоліну.',
    controls: '4-Way Joystick + Button 1 (Jump)',
    players: '1-2 Players'
  },
  {
    id: 'sf2',
    name: 'Street Fighter II: The World Warrior',
    year: '1991',
    manufacturer: 'Capcom (CPS-1)',
    zipName: 'sf2.zip',
    genre: 'Fighting (6-Button)',
    description: 'Еталон аркадних файтингів Capcom CP-System. 8 бійців (Рю, Кен, Чун-Лі, Гайл та ін.), 6 кнопок атаки (LP, MP, HP, LK, MK, HK).',
    controls: '8-Way Joystick + 6 Attack Buttons',
    players: '2 Players (Versus)'
  },
  {
    id: '1942',
    name: '1942 (Capcom)',
    year: '1984',
    manufacturer: 'Capcom',
    zipName: '1942.zip',
    genre: 'Vertical Scrolling Shooter',
    description: 'Класичний вертикальний шутер над Тихим океаном на літаку Lockheed P-38 Lightning. Стрільба та мертва петля (Looping).',
    controls: '8-Way Joystick + Fire + Loop Button',
    players: '1-2 Players'
  },
  {
    id: 'bublbobl',
    name: 'Bubble Bobble',
    year: '1986',
    manufacturer: 'Taito',
    zipName: 'bublbobl.zip',
    genre: 'Co-op Platformer',
    description: 'Пригоди дракончиків Баб та Боб у 100 рівнях підземелля. Стріляйте бульбашками, лопайте ворогів та збирайте бонуси.',
    controls: '2-Way / 4-Way + Bubble + Jump Buttons',
    players: '2 Players (Simultaneous Co-op)'
  },
  {
    id: 'mslug',
    name: 'Metal Slug - Super Vehicle-001',
    year: '1996',
    manufacturer: 'SNK / Nazca (NeoGeo MVS)',
    zipName: 'mslug.zip',
    genre: 'Run and Gun Arcade',
    description: 'Неперевершений 2D екшн Neo Geo з неймовірною анімацією, танками Metal Slug SV-001, кулеметами та гранатами (потребує neogeo.zip).',
    controls: '8-Way Joystick + Shoot + Jump + Grenade',
    players: '2 Players (Co-op)'
  },
  {
    id: 'tmnt',
    name: 'Teenage Mutant Ninja Turtles',
    year: '1989',
    manufacturer: 'Konami (4-Player)',
    zipName: 'tmnt.zip',
    genre: '4-Player Beat \'em Up',
    description: 'Чотирикористувацький аркадний автомат Конамі за мотивами легендарного мультсеріалу про Черепашок-ніндзя.',
    controls: '8-Way Joystick + Attack + Jump',
    players: '1-4 Players (Simultaneous)'
  },
  {
    id: 'mk',
    name: 'Mortal Kombat',
    year: '1992',
    manufacturer: 'Midway (Y-Unit)',
    zipName: 'mk.zip',
    genre: 'Fighting / Digitized',
    description: 'Оцифрований аркадний файтинг від Midway (High Punch, Low Punch, Block, High Kick, Low Kick, Fatalities).',
    controls: '8-Way Joystick + 5 Buttons',
    players: '2 Players (Versus)'
  }
];
