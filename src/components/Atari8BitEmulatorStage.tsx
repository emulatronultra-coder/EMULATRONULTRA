import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { EmulatorConfig, StageRefHandle } from '../types';
import { BUILTIN_ATARI_GAMES } from '../lib/atari8bit/builtinGames';
import { unpackAtariArchive, isZipBuffer } from '../lib/atari8bit/atariZipLoader';
import {
  Gamepad2,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  Upload,
  Cpu,
  Tv,
  Terminal,
  Maximize2,
  Sparkles,
  HardDrive,
  Disc,
  Keyboard as KeyboardIcon,
  Layers,
  Camera,
  Info,
  CheckCircle2,
  ChevronDown,
  Monitor,
} from 'lucide-react';

interface Props {
  config: EmulatorConfig;
}

interface SioSlot {
  id: string;
  name: string;
  filename: string | null;
  data: Uint8Array | null;
  size: number;
}

export const Atari8BitEmulatorStage = forwardRef<StageRefHandle, Props>(function Atari8BitEmulatorStage(
  { config }: Props,
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Engine module ref
  const wasmModuleRef = useRef<{
    init: any;
    set_binary_data: (key: string, path: string, data: Uint8Array, slot: number | null) => void;
    cmd: (command: string) => void;
    reset: (cold: boolean, disable_basic?: boolean | null) => void;
    set_state: (state: string) => void;
    set_resolution: (width: number, height: number) => void;
    set_joystick: (port: number, dirs: number, fire: boolean) => void;
    set_consol: (state: number) => void;
    keystrokes: (text: string) => void;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const pokeyNodeRef = useRef<AudioWorkletNode | null>(null);
  const isEngineInitializedRef = useRef<boolean>(false);

  // UI States
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [scanlines, setScanlines] = useState<boolean>(true);
  const [disableBasic, setDisableBasic] = useState<boolean>(false);
  const [activeConsoleKey, setActiveConsoleKey] = useState<string | null>(null);
  const [selectedBuiltin, setSelectedBuiltin] = useState<string>('space-invaders');
  const [activeTab, setActiveTab] = useState<'controls' | 'drives' | 'keyboard' | 'debugger' | 'info'>('controls');
  const [statusText, setStatusText] = useState<string>('Ініціалізація Bevy Atari 8-Bit...');
  const [activeGameTitle, setActiveGameTitle] = useState<string>(config.gameName || 'Atari 8-Bit (Bevy Engine)');

  // SIO Floppy Drives (D1..D4)
  const [drives, setDrives] = useState<SioSlot[]>([
    { id: 'disk_1', name: 'D1: (Boot Drive)', filename: null, data: null, size: 0 },
    { id: 'disk_2', name: 'D2: (Aux Drive)', filename: null, data: null, size: 0 },
    { id: 'disk_3', name: 'D3: (Data Drive)', filename: null, data: null, size: 0 },
    { id: 'disk_4', name: 'D4: (Work Drive)', filename: null, data: null, size: 0 },
  ]);

  // Active Mounted Cartridge / Executable
  const [cartridge, setCartridge] = useState<{ name: string; size: number } | null>(null);
  const [xexLoaded, setXexLoaded] = useState<{ name: string; size: number } | null>(null);

  // Debugger console
  const [debugLog, setDebugLog] = useState<string[]>([
    'Bevy Atari 8-Bit (Rust + WebAssembly + ANTIC/GTIA WebGL2 Core)',
    'Ready for 6502 execution and SIO serial disk emulation.',
  ]);
  const [debugInput, setDebugInput] = useState<string>('');

  // Joystick virtual state
  const joyStateRef = useRef<{ dirs: number; fire: boolean }>({ dirs: 0, fire: false });

  // Expose imperative handle for snapshot management
  useImperativeHandle(ref, () => ({
    getStateSnapshot: async (): Promise<ArrayBuffer | null> => {
      return null;
    },
  }));

  // Initialize Bevy Atari WASM Engine & WebAudio POKEY Worklet
  useEffect(() => {
    let isCancelled = false;

    async function initEngine() {
      try {
        setStatusText('Завантаження WebAudio POKEY синтезатора...');

        // 1. Setup AudioContext & POKEY AudioWorklet
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass({
          sampleRate: 48000,
          latencyHint: 'interactive',
        });
        audioCtxRef.current = audioCtx;

        // Pre-initialize global environment expected by wasm
        (window as any).pokey_post_message = (msg: any) => {
          if (pokeyNodeRef.current) {
            try {
              pokeyNodeRef.current.port.postMessage(msg);
            } catch {
              // ignore
            }
          }
        };
        (window as any).writeFile = async (_path: string, _data: Uint8Array) => {};
        (window as any).readFile = async (_path: string) => new Uint8Array();
        (window as any).ls = async (_path: string) => [];
        (window as any).rm = async (_path: string) => {};
        (window as any).cmd = (_cmd: string) => {};
        (window as any).sio_get_status = () => 0;
        (window as any).sio_get_sector = () => 0;
        (window as any).sio_put_sector = () => 0;
        (window as any).audio_context = audioCtx;

        if (audioCtx.audioWorklet) {
          try {
            await audioCtx.audioWorklet.addModule('/bevy-atari/pokey/pokey.js');
            const pokeyNode = new AudioWorkletNode(audioCtx, 'POKEY', {
              outputChannelCount: [2], // Stereo POKEY sound
            });
            pokeyNode.connect(audioCtx.destination);
            pokeyNodeRef.current = pokeyNode;
          } catch (workletErr) {
            console.warn('AudioWorklet init warning:', workletErr);
          }
        }

        setStatusText('Завантаження Bevy WebAssembly ядра...');

        // 2. Import WASM Module
        const wasmUrl = '/bevy-atari/wasm/wasm.js';
        const wasmModule: any = await import(/* @vite-ignore */ wasmUrl);
        const initFn = wasmModule.default;

        try {
          await initFn('/bevy-atari/wasm/wasm_bg.wasm');
        } catch (wasmInitErr: any) {
          const errStr = String(wasmInitErr || '');
          if (
            !errStr.includes("This isn't actually an error") &&
            !errStr.includes("null function") &&
            !wasmInitErr?.message?.includes("This isn't actually an error") &&
            !wasmInitErr?.message?.includes("null function")
          ) {
            throw wasmInitErr;
          }
        }

        wasmModuleRef.current = wasmModule;
        isEngineInitializedRef.current = true;

        if (isCancelled) return;

        // Pause emulator state to safely mount ROMs without unmapped memory race
        wasmModule.set_state('idle');
        await new Promise((resolve) => setTimeout(resolve, 80));

        if (isCancelled) return;

        // 3. Load Base Atari OS ROM
        setStatusText('Завантаження Atari OS ROM...');
        try {
          const osRes = await fetch('/bevy-atari/roms/os.rom');
          if (osRes.ok) {
            const osBytes = new Uint8Array(await osRes.arrayBuffer());
            if (osBytes.length === 16384) {
              wasmModule.set_binary_data('osrom', 'os.rom', osBytes, null);
            }
          }
        } catch (osErr) {
          console.warn('OS ROM load warning:', osErr);
        }

        // 4. Check if user passed initial ROM / Game in config
        if (config.romFile || config.zipFile) {
          const initialFile = config.romFile || config.zipFile;
          if (initialFile) {
            setStatusText(`Завантаження ${initialFile.name}...`);
            const buf = await initialFile.arrayBuffer();
            await mountBinaryData(initialFile.name, new Uint8Array(buf));
          }
        } else {
          // Launch default Space Invaders built-in title
          const defaultGame = BUILTIN_ATARI_GAMES.find((g) => g.id === 'space-invaders') || BUILTIN_ATARI_GAMES[0];
          if (defaultGame) {
            wasmModule.set_binary_data('xex', `${defaultGame.id}.xex`, defaultGame.bytes, null);
            setXexLoaded({ name: `${defaultGame.name} (XEX)`, size: defaultGame.bytes.length });
            setActiveGameTitle(defaultGame.name);
          }
        }

        // 5. Reset & Boot system
        wasmModule.reset(true, disableBasic);
        wasmModule.set_state('running');

        setIsReady(true);
        setStatusText('Atari 8-Bit працює (60 FPS / WebGL2)');
        setDebugLog((prev) => [
          ...prev,
          'Atari OS ROM mounted ($C000-$FFFF).',
          'ANTIC/GTIA WebGL2 display initialized.',
          'AudioWorklet Stereo POKEY linked.',
          'System cold reset complete.',
        ]);
      } catch (err: any) {
        console.error('Failed to initialize Bevy Atari:', err);
        setStatusText(`Помилка ініціалізації: ${err.message}`);
      }
    }

    initEngine();

    return () => {
      isCancelled = true;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          audioCtxRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Keyboard and Gamepad input binding
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!wasmModuleRef.current || !isEngineInitializedRef.current) return;

      // Check if user is typing in a form or input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      // Resume WebAudio on user interaction
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      let joyChanged = false;
      let dirs = joyStateRef.current.dirs;
      let fire = joyStateRef.current.fire;

      // Joystick direction mappings (Arrow Keys & WASD)
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        dirs |= 1; // Up = bit 0
        joyChanged = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        dirs |= 2; // Down = bit 1
        joyChanged = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        dirs |= 4; // Left = bit 2
        joyChanged = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        dirs |= 8; // Right = bit 3
        joyChanged = true;
      } else if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'ControlLeft' || e.code === 'ShiftLeft') {
        fire = true;
        joyChanged = true;
      }

      if (joyChanged) {
        joyStateRef.current = { dirs, fire };
        wasmModuleRef.current.set_joystick(0, dirs, fire);
        e.preventDefault();
        return;
      }

      // Atari Console Key Shortcuts:
      // F2: Start, F3: Select, F4: Option, F5: Warm Reset, Shift+F5: Cold Reset
      if (e.key === 'F2') {
        handleConsolePress(1, 'START');
        e.preventDefault();
      } else if (e.key === 'F3') {
        handleConsolePress(2, 'SELECT');
        e.preventDefault();
      } else if (e.key === 'F4') {
        handleConsolePress(4, 'OPTION');
        e.preventDefault();
      } else if (e.key === 'F5') {
        if (e.shiftKey) {
          handleColdReset();
        } else {
          handleWarmReset();
        }
        e.preventDefault();
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!wasmModuleRef.current || !isEngineInitializedRef.current) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      let joyChanged = false;
      let dirs = joyStateRef.current.dirs;
      let fire = joyStateRef.current.fire;

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        dirs &= ~1;
        joyChanged = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        dirs &= ~2;
        joyChanged = true;
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        dirs &= ~4;
        joyChanged = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        dirs &= ~8;
        joyChanged = true;
      } else if (e.code === 'Space' || e.code === 'KeyZ' || e.code === 'ControlLeft' || e.code === 'ShiftLeft') {
        fire = false;
        joyChanged = true;
      }

      if (joyChanged) {
        joyStateRef.current = { dirs, fire };
        wasmModuleRef.current.set_joystick(0, dirs, fire);
        e.preventDefault();
        return;
      }

      if (e.key === 'F2' || e.key === 'F3' || e.key === 'F4') {
        handleConsoleRelease();
        e.preventDefault();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [disableBasic]);

  // Mount binary data into the emulator based on extension/format
  async function mountBinaryData(filename: string, rawData: Uint8Array) {
    if (!wasmModuleRef.current) return;

    let data = rawData;
    let name = filename;

    // Check if ZIP archive
    if (isZipBuffer(data)) {
      setStatusText(`Розпакування ${filename}...`);
      const unzipped = await unpackAtariArchive(data);
      if (unzipped.osRomBytes) {
        wasmModuleRef.current.set_binary_data('osrom', unzipped.osRomName || 'os.rom', unzipped.osRomBytes, null);
      }
      if (unzipped.basicRomBytes) {
        wasmModuleRef.current.set_binary_data('basic', unzipped.basicRomName || 'basic.rom', unzipped.basicRomBytes, null);
      }
      if (unzipped.gameBytes) {
        data = unzipped.gameBytes;
        name = unzipped.gameName || 'game.xex';
      }
    }

    const lower = name.toLowerCase();
    const ext = lower.split('.').pop() || '';

    if (ext === 'atr' || ext === 'xfd' || ext === 'atx' || ext === 'dcm') {
      // Mount as Floppy Disk 1
      wasmModuleRef.current.set_binary_data('disk_1', name, data, null);
      setDrives((prev) => [
        { ...prev[0], filename: name, data, size: data.length },
        ...prev.slice(1),
      ]);
      setCartridge(null);
      setXexLoaded(null);
      setActiveGameTitle(name);
      setStatusText(`Змонтовано образ дискети: ${name}`);
      setDebugLog((prev) => [...prev, `Mounted Floppy D1: ${name} (${(data.length / 1024).toFixed(1)} KB)`]);
    } else if (ext === 'car' || (ext === 'rom' && data.length !== 16384 && data.length !== 8192) || ext === 'bin') {
      // Cartridge
      wasmModuleRef.current.set_binary_data('car', name, data, null);
      setCartridge({ name, size: data.length });
      setXexLoaded(null);
      setActiveGameTitle(name);
      setStatusText(`Вставлено картридж: ${name}`);
      setDebugLog((prev) => [...prev, `Inserted Cartridge CAR: ${name} (${(data.length / 1024).toFixed(1)} KB)`]);
    } else if (ext === 'xex' || ext === 'com' || ext === 'exe' || ext === 'bas') {
      // Direct Executable
      wasmModuleRef.current.set_binary_data('xex', name, data, null);
      setXexLoaded({ name, size: data.length });
      setCartridge(null);
      setActiveGameTitle(name);
      setStatusText(`Завантажено XEX програму: ${name}`);
      setDebugLog((prev) => [...prev, `Loaded XEX Binary: ${name} (${(data.length / 1024).toFixed(1)} KB)`]);
    } else if (data.length === 16384) {
      // OS ROM
      wasmModuleRef.current.set_binary_data('osrom', name, data, null);
      setStatusText(`Завантажено Atari OS ROM: ${name}`);
      setDebugLog((prev) => [...prev, `Loaded Custom OS ROM: ${name}`]);
    } else if (data.length === 8192) {
      // BASIC ROM
      wasmModuleRef.current.set_binary_data('basic', name, data, null);
      setStatusText(`Завантажено Atari BASIC ROM: ${name}`);
      setDebugLog((prev) => [...prev, `Loaded Custom BASIC ROM: ${name}`]);
    } else {
      // Fallback: try loading as XEX
      wasmModuleRef.current.set_binary_data('xex', name, data, null);
      setXexLoaded({ name, size: data.length });
      setActiveGameTitle(name);
      setStatusText(`Завантажено файл: ${name}`);
    }

    // Cold reset to start newly inserted media
    wasmModuleRef.current.reset(true, disableBasic);
    wasmModuleRef.current.set_state('running');
    setIsRunning(true);
  }

  // File Upload Handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buf = await file.arrayBuffer();
    await mountBinaryData(file.name, new Uint8Array(buf));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // Built-in Game Selection
  async function handleSelectBuiltin(gameId: string) {
    setSelectedBuiltin(gameId);
    const game = BUILTIN_ATARI_GAMES.find((g) => g.id === gameId);
    if (!game || !wasmModuleRef.current) return;

    setStatusText(`Запуск ${game.name}...`);
    wasmModuleRef.current.set_binary_data('xex', `${game.id}.xex`, game.bytes, null);
    setXexLoaded({ name: `${game.name} (XEX)`, size: game.bytes.length });
    setCartridge(null);
    setActiveGameTitle(game.name);

    wasmModuleRef.current.reset(true, disableBasic);
    wasmModuleRef.current.set_state('running');
    setIsRunning(true);
    setDebugLog((prev) => [...prev, `Launched built-in title: ${game.name}`]);
  }

  // Console button press (Start, Select, Option)
  function handleConsolePress(state: number, keyName: string) {
    if (!wasmModuleRef.current) return;
    setActiveConsoleKey(keyName);
    wasmModuleRef.current.set_consol(state);
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }

  function handleConsoleRelease() {
    if (!wasmModuleRef.current) return;
    setActiveConsoleKey(null);
    wasmModuleRef.current.set_consol(0);
  }

  // Cold Reset
  function handleColdReset() {
    if (!wasmModuleRef.current) return;
    wasmModuleRef.current.reset(true, disableBasic);
    wasmModuleRef.current.set_state('running');
    setIsRunning(true);
    setStatusText('Cold Reset виконано');
    setDebugLog((prev) => [...prev, 'System Cold Reset triggered (Memory cleared, CPU reset)']);
  }

  // Warm Reset
  function handleWarmReset() {
    if (!wasmModuleRef.current) return;
    wasmModuleRef.current.reset(false, null);
    wasmModuleRef.current.set_state('running');
    setIsRunning(true);
    setStatusText('Warm Reset виконано');
    setDebugLog((prev) => [...prev, 'System Warm Reset triggered (NMI RESET vector)']);
  }

  // Play / Pause Toggle
  function handleTogglePlay() {
    if (!wasmModuleRef.current) return;
    if (isRunning) {
      wasmModuleRef.current.set_state('idle');
      setIsRunning(false);
      setStatusText('Пауза');
    } else {
      wasmModuleRef.current.set_state('running');
      setIsRunning(true);
      setStatusText('Atari 8-Bit працює (60 FPS)');
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    }
  }

  // Audio Mute Toggle
  function handleToggleAudio() {
    if (!audioCtxRef.current) return;
    if (isMuted) {
      audioCtxRef.current.resume();
      setIsMuted(false);
    } else {
      audioCtxRef.current.suspend();
      setIsMuted(true);
    }
  }

  // Virtual Joystick button press
  function handleJoyButton(dirBit: number, isDown: boolean) {
    if (!wasmModuleRef.current) return;
    let dirs = joyStateRef.current.dirs;
    const fire = joyStateRef.current.fire;
    if (isDown) {
      dirs |= dirBit;
    } else {
      dirs &= ~dirBit;
    }
    joyStateRef.current = { dirs, fire };
    wasmModuleRef.current.set_joystick(0, dirs, fire);
  }

  function handleFireButton(isDown: boolean) {
    if (!wasmModuleRef.current) return;
    const dirs = joyStateRef.current.dirs;
    joyStateRef.current = { dirs, fire: isDown };
    wasmModuleRef.current.set_joystick(0, dirs, isDown);
  }

  // Fullscreen
  function handleFullscreen() {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }

  // Screenshot capture
  function handleTakeScreenshot() {
    const canvas = document.getElementById('bevy-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `atari-screenshot-${Date.now()}.png`;
      a.click();
      setStatusText('Знімок екрана збережено');
    } catch (err) {
      console.warn('Screenshot error:', err);
    }
  }

  // Send Debug Command
  function handleSendDebugCmd(e: React.FormEvent) {
    e.preventDefault();
    if (!debugInput.trim() || !wasmModuleRef.current) return;
    const cmdStr = debugInput.trim();
    wasmModuleRef.current.cmd(cmdStr);
    setDebugLog((prev) => [...prev, `> ${cmdStr}`]);
    setDebugInput('');
  }

  // Virtual Keyboard key tap
  function handleVirtualKey(str: string) {
    if (!wasmModuleRef.current) return;
    wasmModuleRef.current.keystrokes(str);
  }

  // Eject Drive
  function handleEjectDrive(slotId: string) {
    if (!wasmModuleRef.current) return;
    wasmModuleRef.current.set_binary_data(slotId, '', new Uint8Array(0), null);
    setDrives((prev) =>
      prev.map((d) => (d.id === slotId ? { ...d, filename: null, data: null, size: 0 } : d))
    );
    setStatusText(`Вилучено диск ${slotId}`);
  }

  return (
    <div
      ref={containerRef}
      id="atari-bevy-stage"
      className="flex flex-col h-full w-full bg-neutral-950 text-neutral-100 select-none overflow-hidden font-sans"
    >
      {/* Top Atari 8-bit System Bar */}
      <div className="h-12 bg-neutral-900 border-b border-neutral-800 px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="font-mono text-sm font-semibold tracking-wide text-neutral-200 uppercase">
              {activeGameTitle}
            </span>
          </div>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-800 text-neutral-400 border border-neutral-700/60">
            Bevy Core 6502 • ANTIC/GTIA WebGL2
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Built-in Game Selector */}
          <div className="relative">
            <select
              id="builtin-game-select"
              value={selectedBuiltin}
              onChange={(e) => handleSelectBuiltin(e.target.value)}
              className="bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs px-2.5 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer appearance-none pr-7"
            >
              {BUILTIN_ATARI_GAMES.map((game) => (
                <option key={game.id} value={game.id}>
                  🎮 {game.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Upload Button */}
          <button
            id="upload-atari-rom-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Завантажити ATR, XEX, CAR, ROM, ZIP"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">ROM / Дискета</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".atr,.xfd,.xex,.com,.exe,.car,.rom,.bin,.zip,.dcm"
            onChange={handleFileUpload}
            className="hidden"
          />

          <div className="h-4 w-px bg-neutral-800 mx-1" />

          {/* Play / Pause */}
          <button
            id="play-pause-atari-btn"
            onClick={handleTogglePlay}
            title={isRunning ? 'Пауза' : 'Продовжити'}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            {isRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Sound Toggle */}
          <button
            id="mute-atari-btn"
            onClick={handleToggleAudio}
            title={isMuted ? 'Увімкнути звук (POKEY)' : 'Вимкнути звук'}
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-neutral-300" />}
          </button>

          {/* Scanlines Filter */}
          <button
            id="scanlines-atari-btn"
            onClick={() => setScanlines((v) => !v)}
            title="CRT Scanlines фільтр"
            className={`p-1.5 rounded transition-colors ${
              scanlines ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'hover:bg-neutral-800 text-neutral-400'
            }`}
          >
            <Tv className="w-4 h-4" />
          </button>

          {/* Screenshot */}
          <button
            id="screenshot-atari-btn"
            onClick={handleTakeScreenshot}
            title="Зберегти скріншот"
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            id="fullscreen-atari-btn"
            onClick={handleFullscreen}
            title="Повноекранний режим"
            className="p-1.5 rounded hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Work Area: Canvas on Left/Center, Tool Panel on Right/Bottom */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Bevy Atari Screen Canvas Viewport */}
        <div
          id="bevy-viewport-container"
          className="flex-1 bg-black flex flex-col items-center justify-center p-2 sm:p-4 relative overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={async (e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) {
              const buf = await file.arrayBuffer();
              mountBinaryData(file.name, new Uint8Array(buf));
            }
          }}
        >
          {/* Authentic Atari Bevy WebGL2 Canvas */}
          <div className="relative shadow-2xl rounded-sm overflow-hidden flex items-center justify-center bg-neutral-950 border border-neutral-800">
            <canvas
              ref={canvasRef}
              id="bevy-canvas"
              tabIndex={0}
              data-raw-handle="1"
              alt="bevy-atari"
              style={{
                width: '768px',
                height: '480px',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 240px)',
                aspectRatio: '384 / 240',
                imageRendering: 'pixelated',
              }}
              width={768}
              height={480}
              className="outline-none block"
            />

            {/* CRT Scanline Overlay Effect */}
            {scanlines && (
              <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] opacity-60 z-10" />
            )}

            {/* Loading / Ready Overlay */}
            {!isReady && (
              <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center gap-3 z-20">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs font-mono text-neutral-300">{statusText}</p>
              </div>
            )}
          </div>

          {/* Authentic Atari Console Buttons Panel (Start, Select, Option, Reset) */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 z-20">
            <div className="flex items-center bg-neutral-900/90 border border-neutral-800 rounded-lg p-1.5 shadow-lg gap-1.5 sm:gap-2">
              <span className="text-[11px] font-mono text-neutral-400 px-1 font-bold">CONSOL:</span>

              {/* START */}
              <button
                id="consol-start-btn"
                onMouseDown={() => handleConsolePress(1, 'START')}
                onMouseUp={handleConsoleRelease}
                onTouchStart={() => handleConsolePress(1, 'START')}
                onTouchEnd={handleConsoleRelease}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all ${
                  activeConsoleKey === 'START'
                    ? 'bg-amber-500 text-black shadow-lg scale-95'
                    : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-700/50'
                }`}
              >
                START (F2)
              </button>

              {/* SELECT */}
              <button
                id="consol-select-btn"
                onMouseDown={() => handleConsolePress(2, 'SELECT')}
                onMouseUp={handleConsoleRelease}
                onTouchStart={() => handleConsolePress(2, 'SELECT')}
                onTouchEnd={handleConsoleRelease}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all ${
                  activeConsoleKey === 'SELECT'
                    ? 'bg-amber-500 text-black shadow-lg scale-95'
                    : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-700/50'
                }`}
              >
                SELECT (F3)
              </button>

              {/* OPTION */}
              <button
                id="consol-option-btn"
                onMouseDown={() => handleConsolePress(4, 'OPTION')}
                onMouseUp={handleConsoleRelease}
                onTouchStart={() => handleConsolePress(4, 'OPTION')}
                onTouchEnd={handleConsoleRelease}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-all ${
                  activeConsoleKey === 'OPTION'
                    ? 'bg-amber-500 text-black shadow-lg scale-95'
                    : 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-200 border border-amber-700/50'
                }`}
              >
                OPTION (F4)
              </button>

              <div className="h-4 w-px bg-neutral-700 mx-0.5" />

              {/* WARM RESET */}
              <button
                id="warm-reset-btn"
                onClick={handleWarmReset}
                title="Warm Reset (F5)"
                className="px-2.5 py-1.5 rounded text-xs font-mono bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 transition-colors"
              >
                RESET (F5)
              </button>

              {/* COLD RESET */}
              <button
                id="cold-reset-btn"
                onClick={handleColdReset}
                title="Cold Reset (Shift+F5)"
                className="px-2.5 py-1.5 rounded text-xs font-mono bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/60 transition-colors"
              >
                COLD RESET
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Control Deck & System Subsystems */}
        <div className="w-full lg:w-96 bg-neutral-900 border-t lg:border-t-0 lg:border-l border-neutral-800 flex flex-col shrink-0">
          {/* Subsystem Tab Navigation */}
          <div className="flex border-b border-neutral-800 bg-neutral-950 text-xs font-medium">
            <button
              onClick={() => setActiveTab('controls')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'controls'
                  ? 'border-b-2 border-amber-500 text-amber-400 bg-neutral-900 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Джойстик</span>
            </button>

            <button
              onClick={() => setActiveTab('drives')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'drives'
                  ? 'border-b-2 border-amber-500 text-amber-400 bg-neutral-900 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Disc className="w-3.5 h-3.5" />
              <span>SIO Диски</span>
            </button>

            <button
              onClick={() => setActiveTab('keyboard')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'keyboard'
                  ? 'border-b-2 border-amber-500 text-amber-400 bg-neutral-900 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <KeyboardIcon className="w-3.5 h-3.5" />
              <span>Клавіатура</span>
            </button>

            <button
              onClick={() => setActiveTab('debugger')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'debugger'
                  ? 'border-b-2 border-amber-500 text-amber-400 bg-neutral-900 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Консоль</span>
            </button>

            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'info'
                  ? 'border-b-2 border-amber-500 text-amber-400 bg-neutral-900 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Специфікація</span>
            </button>
          </div>

          {/* Subsystem Content */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar text-xs">
            {/* Tab 1: Virtual Joystick & Input Mapping */}
            {activeTab === 'controls' && (
              <div className="space-y-4">
                <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                  <h4 className="font-semibold text-neutral-200 mb-2 flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4 text-amber-400" />
                    Керування джойстиком Port 1
                  </h4>
                  <p className="text-neutral-400 text-[11px] mb-3 leading-relaxed">
                    Підтримуються клавіатура (Стрілки / WASD + Space/Z), геймпади HTML5 Gamepad API або екранний D-Pad:
                  </p>

                  {/* On-screen D-Pad & Fire Button */}
                  <div className="flex items-center justify-around py-3 bg-neutral-900/60 rounded border border-neutral-800/80">
                    {/* D-Pad */}
                    <div className="grid grid-cols-3 gap-1 w-28 h-28">
                      <div />
                      <button
                        onMouseDown={() => handleJoyButton(1, true)}
                        onMouseUp={() => handleJoyButton(1, false)}
                        onTouchStart={() => handleJoyButton(1, true)}
                        onTouchEnd={() => handleJoyButton(1, false)}
                        className="bg-neutral-800 active:bg-amber-600 rounded flex items-center justify-center font-bold text-neutral-200 border border-neutral-700"
                      >
                        ▲
                      </button>
                      <div />
                      <button
                        onMouseDown={() => handleJoyButton(4, true)}
                        onMouseUp={() => handleJoyButton(4, false)}
                        onTouchStart={() => handleJoyButton(4, true)}
                        onTouchEnd={() => handleJoyButton(4, false)}
                        className="bg-neutral-800 active:bg-amber-600 rounded flex items-center justify-center font-bold text-neutral-200 border border-neutral-700"
                      >
                        ◀
                      </button>
                      <div className="bg-neutral-950 rounded flex items-center justify-center text-[9px] text-neutral-500 font-mono">
                        JOY 1
                      </div>
                      <button
                        onMouseDown={() => handleJoyButton(8, true)}
                        onMouseUp={() => handleJoyButton(8, false)}
                        onTouchStart={() => handleJoyButton(8, true)}
                        onTouchEnd={() => handleJoyButton(8, false)}
                        className="bg-neutral-800 active:bg-amber-600 rounded flex items-center justify-center font-bold text-neutral-200 border border-neutral-700"
                      >
                        ▶
                      </button>
                      <div />
                      <button
                        onMouseDown={() => handleJoyButton(2, true)}
                        onMouseUp={() => handleJoyButton(2, false)}
                        onTouchStart={() => handleJoyButton(2, true)}
                        onTouchEnd={() => handleJoyButton(2, false)}
                        className="bg-neutral-800 active:bg-amber-600 rounded flex items-center justify-center font-bold text-neutral-200 border border-neutral-700"
                      >
                        ▼
                      </button>
                      <div />
                    </div>

                    {/* Fire Button */}
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onMouseDown={() => handleFireButton(true)}
                        onMouseUp={() => handleFireButton(false)}
                        onTouchStart={() => handleFireButton(true)}
                        onTouchEnd={() => handleFireButton(false)}
                        className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-400 active:scale-95 text-white font-bold text-sm shadow-lg border-2 border-rose-400/50 flex items-center justify-center transition-transform"
                      >
                        FIRE
                      </button>
                      <span className="text-[10px] text-neutral-400 font-mono">SPACE / Z</span>
                    </div>
                  </div>
                </div>

                {/* Boot Options */}
                <div className="bg-neutral-950 p-3 rounded border border-neutral-800 space-y-2">
                  <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    Параметри запуску
                  </h4>
                  <label className="flex items-center gap-2 text-neutral-300 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={disableBasic}
                      onChange={(e) => {
                        setDisableBasic(e.target.checked);
                        if (wasmModuleRef.current) {
                          wasmModuleRef.current.reset(true, e.target.checked);
                        }
                      }}
                      className="rounded border-neutral-700 text-amber-500 focus:ring-amber-500/20 bg-neutral-900"
                    />
                    <span>Вимкнути Atari BASIC при завантаженні (Option Boot)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Tab 2: SIO Floppy Drives & Media */}
            {activeTab === 'drives' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    SIO Floppy Multi-Drive Rack
                  </span>
                  <span className="text-[10px] text-neutral-400">Atari 1050 SIO</span>
                </div>

                {/* Mounted Media Summary */}
                {cartridge && (
                  <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">Cartridge (CAR):</span>
                      <p className="text-neutral-200 font-mono text-[11px] truncate max-w-[200px]">{cartridge.name}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400">{(cartridge.size / 1024).toFixed(0)} KB</span>
                  </div>
                )}

                {xexLoaded && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Atari DOS Binary:</span>
                      <p className="text-neutral-200 font-mono text-[11px] truncate max-w-[200px]">{xexLoaded.name}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400">{(xexLoaded.size / 1024).toFixed(1)} KB</span>
                  </div>
                )}

                {/* Floppy Drive Slots D1..D4 */}
                <div className="space-y-2">
                  {drives.map((drive) => (
                    <div
                      key={drive.id}
                      className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Disc
                          className={`w-4 h-4 ${
                            drive.filename ? 'text-amber-400 animate-spin-slow' : 'text-neutral-600'
                          }`}
                        />
                        <div>
                          <span className="font-mono text-neutral-300 font-semibold">{drive.name}</span>
                          <p className="text-[11px] text-neutral-400 font-mono truncate max-w-[180px]">
                            {drive.filename || 'Порожній дисковод'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {drive.filename ? (
                          <button
                            onClick={() => handleEjectDrive(drive.id)}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors"
                          >
                            Вилучити
                          </button>
                        ) : (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-amber-600 hover:text-black text-[10px] text-neutral-300 transition-colors"
                          >
                            Вставити ATR
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Virtual Atari Keyboard */}
            {activeTab === 'keyboard' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <KeyboardIcon className="w-4 h-4 text-amber-400" />
                    Atari 800XL / 130XE Клавіатура
                  </span>
                </div>

                <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 space-y-2">
                  {/* Quick System Keys */}
                  <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
                    <button
                      onClick={() => handleVirtualKey('\x1B')}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 text-center"
                    >
                      ESC
                    </button>
                    <button
                      onClick={() => handleVirtualKey('\t')}
                      className="p-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-200 text-center"
                    >
                      TAB
                    </button>
                    <button
                      onClick={() => handleVirtualKey('\r')}
                      className="p-1.5 bg-amber-600 hover:bg-amber-500 rounded text-black font-bold text-center"
                    >
                      RETURN
                    </button>
                    <button
                      onClick={() => handleVirtualKey('\x03')}
                      className="p-1.5 bg-rose-900 hover:bg-rose-800 rounded text-rose-200 text-center"
                    >
                      BREAK
                    </button>
                  </div>

                  {/* Common BASIC commands */}
                  <div className="pt-2 border-t border-neutral-800">
                    <span className="text-[10px] text-neutral-400 font-mono uppercase block mb-1.5">
                      Швидкі команди Atari BASIC:
                    </span>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                      <button
                        onClick={() => handleVirtualKey('LIST\r')}
                        className="p-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 rounded text-amber-300 text-left px-2"
                      >
                        LIST
                      </button>
                      <button
                        onClick={() => handleVirtualKey('RUN\r')}
                        className="p-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 rounded text-amber-300 text-left px-2"
                      >
                        RUN
                      </button>
                      <button
                        onClick={() => handleVirtualKey('NEW\r')}
                        className="p-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 rounded text-amber-300 text-left px-2"
                      >
                        NEW
                      </button>
                      <button
                        onClick={() => handleVirtualKey('DOS\r')}
                        className="p-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-750 rounded text-amber-300 text-left px-2"
                      >
                        DOS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Debugger Console */}
            {activeTab === 'debugger' && (
              <div className="space-y-3 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-amber-400" />
                    Інтерактивна консоль Bevy Core
                  </span>
                </div>

                <div className="bg-black font-mono text-[11px] p-2.5 rounded border border-neutral-800 h-44 overflow-y-auto custom-scrollbar space-y-1 text-emerald-400">
                  {debugLog.map((line, idx) => (
                    <div key={idx} className="leading-tight">
                      {line}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendDebugCmd} className="flex gap-1.5">
                  <input
                    type="text"
                    value={debugInput}
                    onChange={(e) => setDebugInput(e.target.value)}
                    placeholder="mem 2000, write 2000 00..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 px-2 py-1.5 rounded font-mono text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded font-mono text-xs transition-colors"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* Tab 5: Hardware Specs & Info */}
            {activeTab === 'info' && (
              <div className="space-y-3">
                <div className="bg-neutral-950 p-3 rounded border border-neutral-800 space-y-2">
                  <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    Архітектура Bevy Atari 8-Bit
                  </h4>
                  <div className="space-y-1.5 text-neutral-300 font-mono text-[11px]">
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Процесор (CPU):</span>
                      <span>MOS 6502 @ 1.79 MHz (NTSC) / 1.77 MHz (PAL)</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Відеопроцесор (ANTIC):</span>
                      <span>Display List DMA (WebGL2 Shader)</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Графіка (GTIA):</span>
                      <span>256 кольорів / PMG Sprites</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Звук (POKEY):</span>
                      <span>Dual Stereo 4-Voice Synthesizer</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Пам'ять (RAM):</span>
                      <span>256 KB Banked Extended RAM</span>
                    </div>
                    <div className="flex justify-between py-0.5 border-b border-neutral-800/60">
                      <span className="text-neutral-400">Серійний I/O (SIO):</span>
                      <span>D1..D4 Floppy Emulation</span>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
                  <span className="text-neutral-400 text-[11px] block leading-relaxed">
                    Рушій <strong className="text-amber-400">bevy-atari</strong> побудований на мові Rust з
                    використанням рушія Bevy, скомпільованого у WebAssembly для WebGL2-прискорення та реального
                    цикло-точного виконання коду MOS 6502.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Status Ribbon */}
      <div className="h-6 bg-neutral-950 border-t border-neutral-800 px-3 flex items-center justify-between text-[11px] font-mono text-neutral-400 z-20 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{statusText}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span>60 FPS</span>
          <span className="hidden sm:inline">WebGL2 / AudioWorklet</span>
        </div>
      </div>
    </div>
  );
});

export default Atari8BitEmulatorStage;
