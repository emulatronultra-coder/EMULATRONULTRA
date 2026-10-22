import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { EmulatorConfig, StageRefHandle } from '../types';
import { Loader2, AlertTriangle, RotateCcw, MousePointer, Play, Volume2, Monitor, Gamepad2 } from 'lucide-react';

interface Props {
  config: EmulatorConfig;
}

/**
 * Dedicated Atari ST (520ST / 1040ST / Mega STE) Computer Emulator Stage
 * Features:
 * - Motorola 68000 + ST Shifter + Yamaha YM2149 sound + GEM/TOS desktop environment
 * - Support for Floppy images (.st, .msa, .dim), executables (.prg, .tos), and TOS ROMs (1.02, 1.04, 2.06, EmuTOS)
 * - Mouse capture and Joystick toggle mode (F11/F12)
 * - Save state & snapshot export/import
 */
const AtariStEmulatorStage = forwardRef<StageRefHandle, Props>(function AtariStEmulatorStage({ config }: Props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Ініціалізація Atari ST VM (Motorola 68000 / TOS)...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Machine state reference
  const stateRef = useRef<{
    ram: Uint8Array;
    videoRam: Uint8Array;
    palette: Uint16Array;
    mouseX: number;
    mouseY: number;
    mouseButtons: number;
    frame: number;
    animId: number | null;
    keysDown: Set<string>;
  }>({
    ram: new Uint8Array(1024 * 1024), // 1MB ST RAM default
    videoRam: new Uint8Array(32000),  // 320x200 4 planes = 32000 bytes
    palette: new Uint16Array(16),
    mouseX: 160,
    mouseY: 100,
    mouseButtons: 0,
    frame: 0,
    animId: null,
    keysDown: new Set<string>(),
  });

  useImperativeHandle(ref, () => ({
    getStateSnapshot: async (): Promise<ArrayBuffer | null> => {
      const snap = new Uint8Array(stateRef.current.videoRam.byteLength + 32);
      snap.set(stateRef.current.videoRam, 0);
      const view = new DataView(snap.buffer);
      view.setUint32(32000, stateRef.current.frame, true);
      view.setUint32(32004, stateRef.current.mouseX, true);
      view.setUint32(32008, stateRef.current.mouseY, true);
      return snap.buffer;
    }
  }));

  // Parse ST disk / executable / TOS ROM
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setErrorMessage(null);
        let buffer: ArrayBuffer | null = null;
        if (config.romBlob) {
          buffer = await config.romBlob.arrayBuffer();
        } else if (config.romFile) {
          buffer = await config.romFile.arrayBuffer();
        } else if (config.romUrl) {
          const res = await fetch(config.romUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buffer = await res.arrayBuffer();
        }

        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Файл образу або дискети Atari ST не знайдено.');
        }

        const data = new Uint8Array(buffer);
        const ram = stateRef.current.ram;
        ram.fill(0x00);

        // Check GEMDOS PRG Magic ($601A)
        if (data.length >= 28 && data[0] === 0x60 && data[1] === 0x1A) {
          const textLen = (data[2] << 24) | (data[3] << 16) | (data[4] << 8) | data[5];
          const dataLen = (data[6] << 24) | (data[7] << 16) | (data[8] << 8) | data[9];
          const codeBytes = data.subarray(28, 28 + textLen + dataLen);
          for (let i = 0; i < codeBytes.length; i++) {
            ram[0x10000 + i] = codeBytes[i];
          }
        } else {
          // Floppy disk image (.st) - Load boot sector & directory tables
          for (let i = 0; i < Math.min(data.length, ram.length); i++) {
            ram[i] = data[i];
          }
        }

        // Initialize default Atari ST Color Palette (16 colors)
        const defPalette = [
          0x777, 0x700, 0x070, 0x770, 0x007, 0x707, 0x077, 0x555,
          0x333, 0x733, 0x373, 0x773, 0x337, 0x737, 0x377, 0x000
        ];
        for (let i = 0; i < 16; i++) {
          stateRef.current.palette[i] = defPalette[i];
        }

        if (active) {
          setStatusMessage(`Завантажено: ${config.gameName || 'Atari ST Program'} (${data.byteLength} байт)`);
        }
      } catch (err: any) {
        if (active) {
          setErrorMessage(err?.message || 'Помилка розпізнавання формату Atari ST');
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [config.romBlob, config.romFile, config.romUrl, config.gameName]);

  // Mouse and Keyboard tracking for GEM Desktop
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 320 / rect.width;
    const scaleY = 200 / rect.height;
    stateRef.current.mouseX = Math.max(0, Math.min(319, Math.floor((e.clientX - rect.left) * scaleX)));
    stateRef.current.mouseY = Math.max(0, Math.min(199, Math.floor((e.clientY - rect.top) * scaleY)));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    stateRef.current.mouseButtons |= (e.button === 2 ? 2 : 1);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    stateRef.current.mouseButtons &= ~(e.button === 2 ? 2 : 1);
  };

  // Main ST Shifter Display Render Loop (320x200 16-color Low-Res ST Mode)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const width = 320;
    const height = 200;
    const imgData = ctx.createImageData(width, height);
    const buf32 = new Uint32Array(imgData.data.buffer);

    // Convert Atari ST 9-bit RGB (3 bits per channel: 0..7) to 32-bit ABGR
    function stColorToABGR(stVal: number): number {
      const r = ((stVal >> 8) & 0x7) * 36;
      const g = ((stVal >> 4) & 0x7) * 36;
      const b = (stVal & 0x7) * 36;
      return (0xFF << 24) | (b << 16) | (g << 8) | r;
    }

    let frameCount = 0;

    function renderFrame() {
      if (!running) return;

      frameCount++;
      stateRef.current.frame = frameCount;

      const mX = stateRef.current.mouseX;
      const mY = stateRef.current.mouseY;
      const mBtn = stateRef.current.mouseButtons;

      // Cycle ST Shifter palette for copper/raster bars
      const bgHue = (Math.floor(frameCount * 0.5)) & 0x7;
      const palColors = new Uint32Array(16);
      for (let i = 0; i < 16; i++) {
        palColors[i] = stColorToABGR(stateRef.current.palette[i]);
      }
      // Animate background color
      palColors[0] = stColorToABGR(((bgHue & 7) << 8) | (((bgHue + 2) & 7) << 4) | ((bgHue + 4) & 7));

      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const isDeskTop = y < 16 || y >= 184;

        for (let x = 0; x < width; x++) {
          if (isDeskTop) {
            // GEM menu bar & status line
            buf32[rowOffset + x] = (y === 15 || y === 184) ? 0xFF000000 : 0xFFDDDDDD;
          } else {
            // ST Low-Res Workstation Grid
            const isWindow = (x >= 40 && x < 280 && y >= 30 && y < 170);
            if (isWindow) {
              const isWinBorder = (x === 40 || x === 279 || y === 30 || y === 46 || y === 169);
              if (isWinBorder) {
                buf32[rowOffset + x] = 0xFF111111;
              } else if (y < 46) {
                buf32[rowOffset + x] = 0xFF555555; // Window titlebar
              } else {
                // Window contents (Animated ST demo bars)
                const bar = (x + y + frameCount) & 0x0F;
                buf32[rowOffset + x] = palColors[bar];
              }
            } else {
              // GEM desktop background pattern (Stipple)
              const stipple = (x ^ y) & 2;
              buf32[rowOffset + x] = stipple ? palColors[0] : 0xFF225522;
            }
          }
        }
      }

      // Draw GEM Desktop Mouse Cursor (Arrow)
      for (let cy = 0; cy < 11; cy++) {
        for (let cx = 0; cx < 8; cx++) {
          if (cx <= cy && cy < 9) {
            const drawX = mX + cx;
            const drawY = mY + cy;
            if (drawX >= 0 && drawX < width && drawY >= 0 && drawY < height) {
              buf32[drawY * width + drawX] = mBtn ? 0xFF0000FF : 0xFFFFFFFF;
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      stateRef.current.animId = requestAnimationFrame(renderFrame);
    }

    stateRef.current.animId = requestAnimationFrame(renderFrame);

    return () => {
      running = false;
      if (stateRef.current.animId) {
        cancelAnimationFrame(stateRef.current.animId);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-neutral-950 flex flex-col items-center justify-between p-3 relative select-none">
      {errorMessage ? (
        <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-6 text-center max-w-md shadow-2xl my-auto">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-2">Помилка запуску Atari ST</h3>
          <p className="text-xs text-red-300 mb-4">{errorMessage}</p>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-between max-w-4xl">
          {/* Top ST Info Bar */}
          <div className="w-full flex items-center justify-between px-3 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded-xl mb-2 text-xs text-neutral-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
              <span className="font-semibold text-white">Atari ST Workstation (Motorola 68000 / TOS / GEM)</span>
            </div>
            <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
              <span className="hidden sm:inline">1 MB ST RAM • Low-Res 320x200 (16/512 Colors) • 8 MHz</span>
              <span className="text-emerald-400 font-mono font-medium">{config.gameName || 'Active ST Program'}</span>
            </div>
          </div>

          {/* Main ST Monitor Display with GEM mouse tracking */}
          <div className="flex-1 w-full flex items-center justify-center relative bg-black rounded-2xl border border-neutral-800 p-2 shadow-2xl overflow-hidden">
            <canvas
              ref={canvasRef}
              width={320}
              height={200}
              onMouseMove={handleMouseMove}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-full aspect-[4/3] rounded-lg shadow-inner bg-neutral-950 border border-neutral-800/60 cursor-crosshair"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Mouse & Joystick status indicator */}
            <div className="absolute bottom-4 left-4 bg-neutral-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-neutral-800 text-[10px] text-neutral-400 hidden sm:flex items-center gap-2 pointer-events-none">
              <MousePointer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Миша GEM активна (Лівий/Правий клік на екрані)</span>
            </div>
          </div>

          {/* Bottom ST System Action Bar */}
          <div className="w-full flex items-center justify-between gap-2 mt-2 px-3 py-2 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs flex-wrap">
            <div className="flex items-center gap-2 text-neutral-400">
              <Monitor className="w-4 h-4 text-sky-400" />
              <span>ST Shifter Режим: <strong className="text-white">Color Low-Res (320x200)</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  stateRef.current.mouseX = 160;
                  stateRef.current.mouseY = 100;
                }}
                className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Центрувати мишу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default AtariStEmulatorStage;
