import React, { useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { EmulatorConfig, SystemCore, StageRefHandle } from '../types';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  config: EmulatorConfig;
  onSwitchToAtari?: () => void;
}

// Maps internal SystemCore to the exact core name recognized by EmulatorJS
const EMULATOR_JS_CORE_MAP: Record<SystemCore, string> = {
  ubuntulinux: '',
  ibmpc: '', // Handled by v86
  nes: 'nes',
  famicom: 'nes',
  snes: 'snes',
  segaMD: 'segaMD',
  segaMS: 'segaMS',
  segaGG: 'segaGG',
  gb: 'gb',
  // EmulatorJS uses the 'gb' (Gambatte) core for both GB and GBC ROMs.
  gbc: 'gb',
  gba: 'gba',
  pet: 'pet',
  c64: 'c64',
  amiga: 'amiga',
  atari2600: 'atari2600',
  atari5200: 'atari5200',
  atari7800: 'atari7800',
  atariLynx: 'lynx',
  atariJaguar: 'jaguar',
  atari8bit: '',
  atarist: '',
  mame: 'mame2003',
};

const CORE_DEFAULT_EXTENSIONS: Partial<Record<SystemCore, string>> = {
  segaGG: '.gg',
  segaMS: '.sms',
  segaMD: '.md',
  nes: '.nes',
  famicom: '.nes',
  snes: '.sfc',
  gb: '.gb',
  gbc: '.gbc',
  gba: '.gba',
  pet: '.prg',
  c64: '.d64',
  amiga: '.adf',
  atari2600: '.a26',
  atari5200: '.a52',
  atari7800: '.a78',
  atariLynx: '.lnx',
  atariJaguar: '.j64',
  atari8bit: '.atr',
  atarist: '.st',
  mame: '.zip',
};

declare global {
  interface Window {
    __EJS_ACTIVE_ROM__?: Uint8Array | null;
    __EJS_ACTIVE_ROM_NAME__?: string | null;
    __EJS_ACTIVE_BIOS__?: Uint8Array | null;
    __EJS_ACTIVE_BIOS_NAME__?: string | null;
    __EJS_ACTIVE_DISKS__?: Record<string, Uint8Array> | null;
    __EJS_M3U_CONTENT__?: string | null;
    __EJS_M3U_NAME__?: string | null;
    __EJS_ACTIVE_STATE__?: Uint8Array | null;
  }
}

const EmulatorStage = forwardRef<StageRefHandle, Props>(function EmulatorStage({ config, onSwitchToAtari }: Props, ref) {
  const [iframeKey, setIframeKey] = useState(0);
  const [isPreparing, setIsPreparing] = useState(true);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [turboSpeedMs, setTurboSpeedMs] = useState<number>(40); // 25 Hz default
  const [autoTurboA, setAutoTurboA] = useState<boolean>(false);
  const [autoTurboB, setAutoTurboB] = useState<boolean>(false);
  const [autoTurboAB, setAutoTurboAB] = useState<boolean>(false);

  // Helper to post messages to the emulator iframe
  const postToIframe = (data: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(data, '*');
    }
  };

  type ControllerBtn =
    | 'A'
    | 'B'
    | 'AB'
    | 'SELECT'
    | 'START'
    | 'COIN1'
    | 'COIN2'
    | '1P_START'
    | '2P_START'
    | 'BTN1'
    | 'BTN2'
    | 'BTN3'
    | 'BTN4'
    | 'BTN5'
    | 'BTN6'
    | 'MAME_MENU'
    | 'MAME_SERVICE'
    | 'MAME_RESET'
    | 'MAME_SCRLK'
    | 'MAME_F1'
    | 'MAME_F2'
    | 'MAME_F3';

  const handleStartTurbo = (btn: 'A' | 'B' | 'AB') => {
    postToIframe({ type: 'EJS_START_TURBO', button: btn, speedMs: turboSpeedMs });
  };

  const handleStopTurbo = (btn: 'A' | 'B' | 'AB') => {
    postToIframe({ type: 'EJS_STOP_TURBO', button: btn });
  };

  const handlePressBtn = (btn: ControllerBtn) => {
    postToIframe({ type: 'EJS_PRESS_BTN', button: btn });
  };

  const handleReleaseBtn = (btn: ControllerBtn) => {
    postToIframe({ type: 'EJS_RELEASE_BTN', button: btn });
  };

  const toggleAutoTurboA = () => {
    setAutoTurboA(prev => {
      const next = !prev;
      if (next) handleStartTurbo('A');
      else handleStopTurbo('A');
      return next;
    });
  };

  const toggleAutoTurboB = () => {
    setAutoTurboB(prev => {
      const next = !prev;
      if (next) handleStartTurbo('B');
      else handleStopTurbo('B');
      return next;
    });
  };

  const toggleAutoTurboAB = () => {
    setAutoTurboAB(prev => {
      const next = !prev;
      if (next) handleStartTurbo('AB');
      else handleStopTurbo('AB');
      return next;
    });
  };

  // Keyboard hotkeys for Turbo A (KeyQ), Turbo B (KeyW), A+B (KeyE)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyQ') {
        handleStartTurbo('A');
      } else if (e.code === 'KeyW') {
        handleStartTurbo('B');
      } else if (e.code === 'KeyE') {
        handlePressBtn('AB');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') {
        if (!autoTurboA) handleStopTurbo('A');
      } else if (e.code === 'KeyW') {
        if (!autoTurboB) handleStopTurbo('B');
      } else if (e.code === 'KeyE') {
        if (!autoTurboAB) handleReleaseBtn('AB');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [turboSpeedMs, autoTurboA, autoTurboB, autoTurboAB]);

  useImperativeHandle(ref, () => ({
    getStateSnapshot: (): Promise<ArrayBuffer | null> => {
      return new Promise((resolve) => {
        if (!iframeRef.current || !iframeRef.current.contentWindow) {
          resolve(null);
          return;
        }
        const channel = new MessageChannel();
        const timeout = setTimeout(() => resolve(null), 2500);
        channel.port1.onmessage = (evt) => {
          clearTimeout(timeout);
          if (evt.data && evt.data.success && evt.data.state) {
            resolve(evt.data.state);
          } else {
            resolve(null);
          }
        };
        try {
          iframeRef.current.contentWindow.postMessage({ type: 'EJS_GET_STATE' }, '*', [channel.port2]);
        } catch (err) {
          clearTimeout(timeout);
          resolve(null);
        }
      });
    }
  }));

  // Prepare binary data for EmulatorJS in memory so it avoids browser blob URL fetch restrictions
  useEffect(() => {
    let isCancelled = false;

    async function prepareData() {
      setIsPreparing(true);
      setPrepareError(null);

      try {
        // 1. Prepare multi-disk or single ROM binary buffers
        if (config.disks && config.disks.length > 1) {
          const disksMap: Record<string, Uint8Array> = {};
          config.disks.forEach(d => {
            disksMap[d.name] = d.data;
          });
          window.__EJS_ACTIVE_DISKS__ = disksMap;
          window.__EJS_M3U_CONTENT__ = config.m3uContent || null;
          window.__EJS_M3U_NAME__ = config.m3uFileName || 'game.m3u';
          window.__EJS_ACTIVE_ROM__ = null;
          window.__EJS_ACTIVE_ROM_NAME__ = null;
        } else if (config.disks && config.disks.length === 1) {
          window.__EJS_ACTIVE_ROM__ = config.disks[0].data;
          window.__EJS_ACTIVE_ROM_NAME__ = config.singleRomName || config.disks[0].name;
          window.__EJS_ACTIVE_DISKS__ = null;
          window.__EJS_M3U_CONTENT__ = null;
          window.__EJS_M3U_NAME__ = null;
        } else {
          let romBuffer: ArrayBuffer | null = null;
          if (config.romBlob) {
            romBuffer = await config.romBlob.arrayBuffer();
          } else if (config.romFile) {
            romBuffer = await config.romFile.arrayBuffer();
          } else if (config.romUrl) {
            const res = await fetch(config.romUrl);
            if (!res.ok) throw new Error(`Не вдалося завантажити образ гри (HTTP ${res.status})`);
            romBuffer = await res.arrayBuffer();
          } else if (config.core === 'mame' && (config.biosBlob || config.biosFile || config.biosUrl)) {
            // MAME running directly with arcade system BIOS (e.g. neogeo.zip, qsound.zip, pgm.zip)
            if (config.biosBlob) {
              romBuffer = await config.biosBlob.arrayBuffer();
            } else if (config.biosFile) {
              romBuffer = await config.biosFile.arrayBuffer();
            } else if (config.biosUrl) {
              const res = await fetch(config.biosUrl);
              if (res.ok) romBuffer = await res.arrayBuffer();
            }
          }

          if (!romBuffer) {
            throw new Error('Файл або образ гри відсутній.');
          }

          const resolvedRomName =
            config.singleRomName ||
            config.romFile?.name ||
            (config.core === 'mame' && !config.romFile && config.biosFile ? config.biosFile.name : null) ||
            config.gameName ||
            'game.zip';

          window.__EJS_ACTIVE_ROM__ = new Uint8Array(romBuffer);
          window.__EJS_ACTIVE_ROM_NAME__ = resolvedRomName;
          window.__EJS_ACTIVE_DISKS__ = null;
          window.__EJS_M3U_CONTENT__ = null;
          window.__EJS_M3U_NAME__ = null;
        }

        // 2. Prepare optional BIOS Binary Buffer
        let biosBuffer: ArrayBuffer | null = null;
        if (config.biosBlob) {
          biosBuffer = await config.biosBlob.arrayBuffer();
        } else if (config.biosFile) {
          biosBuffer = await config.biosFile.arrayBuffer();
        } else if (config.biosUrl) {
          const res = await fetch(config.biosUrl);
          if (res.ok) {
            biosBuffer = await res.arrayBuffer();
          }
        }

        if (isCancelled) return;

        window.__EJS_ACTIVE_BIOS__ = biosBuffer ? new Uint8Array(biosBuffer) : null;
        window.__EJS_ACTIVE_BIOS_NAME__ = config.biosFile?.name || null;
        if (config.initialState && config.initialState.byteLength > 0) {
          window.__EJS_ACTIVE_STATE__ = new Uint8Array(config.initialState);
        } else {
          window.__EJS_ACTIVE_STATE__ = null;
        }

        setIsPreparing(false);
        setIframeKey(k => k + 1);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('Failed to prepare emulator ROM buffer:', err);
        setPrepareError(err?.message || 'Не вдалося підготувати дані гри до запуску.');
        setIsPreparing(false);
      }
    }

    prepareData();

    return () => {
      isCancelled = true;
      window.__EJS_ACTIVE_ROM__ = null;
      window.__EJS_ACTIVE_ROM_NAME__ = null;
      window.__EJS_ACTIVE_BIOS__ = null;
      window.__EJS_ACTIVE_DISKS__ = null;
      window.__EJS_M3U_CONTENT__ = null;
      window.__EJS_M3U_NAME__ = null;
      window.__EJS_ACTIVE_STATE__ = null;
    };
  }, [
    config.romBlob,
    config.romFile,
    config.romUrl,
    config.disks,
    config.m3uContent,
    config.m3uFileName,
    config.biosBlob,
    config.biosFile,
    config.biosUrl,
    config.core
  ]);

  const canRenderStage = !!(
    config.romUrl ||
    config.romBlob ||
    config.romFile ||
    config.disks?.length ||
    (config.core === 'mame' && (config.biosFile || config.biosBlob || config.biosUrl))
  );

  if (!canRenderStage) return null;

  if (isPreparing) {
    return (
      <div className="w-full h-full bg-neutral-950 rounded-xl flex flex-col items-center justify-center border border-neutral-800 shadow-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mb-4">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1">Підготовка емулятора</h3>
        <p className="text-xs text-neutral-400 max-w-sm">
          Завантаження та підготовка дисків {config.gameName || 'гри'} у памʼять...
        </p>
      </div>
    );
  }

  if (prepareError) {
    return (
      <div className="w-full h-full bg-neutral-950 rounded-xl flex flex-col items-center justify-center border border-red-500/30 shadow-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Помилка підготовки гри</h3>
        <p className="text-xs text-red-300 max-w-md mb-6">{prepareError}</p>
        <button
          type="button"
          onClick={() => setIframeKey(k => k + 1)}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border border-neutral-700"
        >
          <RotateCcw className="w-4 h-4" />
          Спробувати знову
        </button>
      </div>
    );
  }

  const emulatorJsCore = EMULATOR_JS_CORE_MAP[config.core] || config.core;

  // Compute clean safe file name
  let targetFileName = config.isMultiDisk
    ? config.m3uFileName || `${config.gameName || 'game'}.m3u`
    : config.singleRomName || config.romFile?.name || config.gameName || 'game';

  const defaultExt = CORE_DEFAULT_EXTENSIONS[config.core] || '';
  if (config.core === 'segaGG' && !/\.gg$/i.test(targetFileName)) {
    targetFileName = `${targetFileName.replace(/\.[^/.]+$/, '')}.gg`;
  } else if (!/\.[a-zA-Z0-9]+$/i.test(targetFileName) && defaultExt) {
    targetFileName = `${targetFileName}${defaultExt}`;
  }

  const safeGameName = targetFileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Retro Emulator</title>
        <style>
            body, html { 
                margin: 0; 
                padding: 0; 
                width: 100%; 
                height: 100%; 
                overflow: hidden; 
                background-color: #0a0a0a;
                font-family: system-ui, -apple-system, sans-serif;
            }
            #game { 
                width: 100%; 
                height: 100%; 
            }
        </style>
    </head>
    <body>
        <div id="game"></div>
        <script>
            // Protect blob URLs from being revoked prematurely by EmulatorJS during HEAD/GET verification requests
            URL.revokeObjectURL = function() {};

            window.EJS_player = '#game';
            window.EJS_core = '${emulatorJsCore}';
            window.EJS_color = '#0ea5e9';
            window.EJS_startOnLoaded = true;
            window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';

            // Set optimal Amiga compatibility options for PUAE core
            if ('${emulatorJsCore}' === 'puae') {
                window.EJS_defaultOptions = {
                    'puae_model': 'A500',
                    'puae_floppy_speed': '100',
                    'puae_cpu_compatibility': 'exact',
                    'puae_immediate_blits': 'false'
                };
            }

            const externalFiles = {};

            // Helper to safely write files into Emscripten virtual filesystem
            function injectToFS(fs, path, data) {
                if (!fs || !data || !path) return;
                try {
                    const normalized = path.replace(/^\\/+/, '');
                    const parts = normalized.split('/');
                    let cur = '';
                    for (let i = 0; i < parts.length - 1; i++) {
                        if (parts[i].trim()) {
                            cur += (cur ? '/' : '') + parts[i];
                            try { fs.mkdir(cur); } catch (e) {}
                            try { fs.mkdir('/' + cur); } catch (e) {}
                            try { fs.mkdir('/home/web_user/retroarch/userdata/' + cur); } catch (e) {}
                        }
                    }
                    try { fs.writeFile('/' + normalized, data); } catch (e) {}
                    try { fs.writeFile(normalized, data); } catch (e) {}
                    try { fs.writeFile('/home/web_user/retroarch/userdata/' + normalized, data); } catch (e) {}
                } catch (err) {
                    console.warn('FS injection notice for ' + path, err);
                }
            }

            // Listener for parent window state queries
            window.addEventListener('message', async function(e) {
                if (e.data && e.data.type === 'EJS_GET_STATE') {
                    const port = e.ports[0];
                    try {
                        if (window.EJS_emulator && window.EJS_emulator.gameManager) {
                            const state = await window.EJS_emulator.gameManager.getState();
                            if (state) {
                                const buf = state.buffer ? state.buffer.slice(state.byteOffset, state.byteOffset + state.byteLength) : state;
                                port?.postMessage({ success: true, state: buf });
                            } else {
                                port?.postMessage({ success: false, state: null });
                            }
                        } else {
                            port?.postMessage({ success: false, state: null });
                        }
                    } catch (err) {
                        port?.postMessage({ success: false, state: null, error: String(err) });
                    }
                }
            });

            // Keyboard event simulation for Turbo & Combo buttons
            function fireKeyEvent(code, key, keyCode, isDown) {
                var type = isDown ? 'keydown' : 'keyup';
                var ev;
                try {
                    ev = new KeyboardEvent(type, {
                        key: key,
                        code: code,
                        keyCode: keyCode,
                        which: keyCode,
                        bubbles: true,
                        cancelable: true,
                        composed: true
                    });
                } catch (e) {
                    ev = document.createEvent('Event');
                    ev.initEvent(type, true, true);
                }
                try {
                    Object.defineProperty(ev, 'keyCode', { get: function() { return keyCode; }, configurable: true });
                    Object.defineProperty(ev, 'which', { get: function() { return keyCode; }, configurable: true });
                    Object.defineProperty(ev, 'code', { get: function() { return code; }, configurable: true });
                    Object.defineProperty(ev, 'key', { get: function() { return key; }, configurable: true });
                } catch (e) {}

                var targets = [
                    window,
                    document,
                    document.body,
                    document.getElementById('game'),
                    document.querySelector('canvas'),
                    document.querySelector('iframe'),
                    document.activeElement
                ];

                for (var i = 0; i < targets.length; i++) {
                    if (targets[i] && targets[i].dispatchEvent) {
                        try {
                            targets[i].dispatchEvent(ev);
                        } catch (err) {}
                    }
                }
            }

            function pressButton(btn) {
                if (btn === 'A') {
                    fireKeyEvent('KeyZ', 'z', 90, true);
                    fireKeyEvent('KeyA', 'a', 65, true);
                } else if (btn === 'B') {
                    fireKeyEvent('KeyX', 'x', 88, true);
                    fireKeyEvent('KeyS', 's', 83, true);
                } else if (btn === 'AB') {
                    fireKeyEvent('KeyZ', 'z', 90, true);
                    fireKeyEvent('KeyA', 'a', 65, true);
                    fireKeyEvent('KeyX', 'x', 88, true);
                    fireKeyEvent('KeyS', 's', 83, true);
                } else if (btn === 'SELECT') {
                    fireKeyEvent('KeyV', 'v', 86, true);
                    fireKeyEvent('ShiftRight', 'Shift', 16, true);
                    fireKeyEvent('KeyC', 'c', 67, true);
                } else if (btn === 'START') {
                    fireKeyEvent('Enter', 'Enter', 13, true);
                } else if (btn === 'COIN1') {
                    fireKeyEvent('Digit5', '5', 53, true);
                } else if (btn === 'COIN2') {
                    fireKeyEvent('Digit6', '6', 54, true);
                } else if (btn === '1P_START') {
                    fireKeyEvent('Digit1', '1', 49, true);
                } else if (btn === '2P_START') {
                    fireKeyEvent('Digit2', '2', 50, true);
                } else if (btn === 'BTN1') {
                    fireKeyEvent('ControlLeft', 'Control', 17, true);
                    fireKeyEvent('KeyZ', 'z', 90, true);
                } else if (btn === 'BTN2') {
                    fireKeyEvent('AltLeft', 'Alt', 18, true);
                    fireKeyEvent('KeyX', 'x', 88, true);
                } else if (btn === 'BTN3') {
                    fireKeyEvent('Space', ' ', 32, true);
                    fireKeyEvent('KeyC', 'c', 67, true);
                } else if (btn === 'BTN4') {
                    fireKeyEvent('ShiftLeft', 'Shift', 16, true);
                    fireKeyEvent('KeyV', 'v', 86, true);
                } else if (btn === 'BTN5') {
                    fireKeyEvent('KeyS', 's', 83, true);
                } else if (btn === 'BTN6') {
                    fireKeyEvent('KeyD', 'd', 68, true);
                } else if (btn === 'MAME_MENU') {
                    fireKeyEvent('Tab', 'Tab', 9, true);
                } else if (btn === 'MAME_SERVICE') {
                    fireKeyEvent('F2', 'F2', 113, true);
                } else if (btn === 'MAME_RESET') {
                    fireKeyEvent('F3', 'F3', 114, true);
                } else if (btn === 'MAME_SCRLK') {
                    fireKeyEvent('ScrollLock', 'ScrollLock', 145, true);
                } else if (btn === 'MAME_F1') {
                    fireKeyEvent('F1', 'F1', 112, true);
                } else if (btn === 'MAME_F2') {
                    fireKeyEvent('F2', 'F2', 113, true);
                } else if (btn === 'MAME_F3') {
                    fireKeyEvent('F3', 'F3', 114, true);
                }
            }

            function releaseButton(btn) {
                if (btn === 'A') {
                    fireKeyEvent('KeyZ', 'z', 90, false);
                    fireKeyEvent('KeyA', 'a', 65, false);
                } else if (btn === 'B') {
                    fireKeyEvent('KeyX', 'x', 88, false);
                    fireKeyEvent('KeyS', 's', 83, false);
                } else if (btn === 'AB') {
                    fireKeyEvent('KeyZ', 'z', 90, false);
                    fireKeyEvent('KeyA', 'a', 65, false);
                    fireKeyEvent('KeyX', 'x', 88, false);
                    fireKeyEvent('KeyS', 's', 83, false);
                } else if (btn === 'SELECT') {
                    fireKeyEvent('KeyV', 'v', 86, false);
                    fireKeyEvent('ShiftRight', 'Shift', 16, false);
                    fireKeyEvent('KeyC', 'c', 67, false);
                } else if (btn === 'START') {
                    fireKeyEvent('Enter', 'Enter', 13, false);
                } else if (btn === 'COIN1') {
                    fireKeyEvent('Digit5', '5', 53, false);
                } else if (btn === 'COIN2') {
                    fireKeyEvent('Digit6', '6', 54, false);
                } else if (btn === '1P_START') {
                    fireKeyEvent('Digit1', '1', 49, false);
                } else if (btn === '2P_START') {
                    fireKeyEvent('Digit2', '2', 50, false);
                } else if (btn === 'BTN1') {
                    fireKeyEvent('ControlLeft', 'Control', 17, false);
                    fireKeyEvent('KeyZ', 'z', 90, false);
                } else if (btn === 'BTN2') {
                    fireKeyEvent('AltLeft', 'Alt', 18, false);
                    fireKeyEvent('KeyX', 'x', 88, false);
                } else if (btn === 'BTN3') {
                    fireKeyEvent('Space', ' ', 32, false);
                    fireKeyEvent('KeyC', 'c', 67, false);
                } else if (btn === 'BTN4') {
                    fireKeyEvent('ShiftLeft', 'Shift', 16, false);
                    fireKeyEvent('KeyV', 'v', 86, false);
                } else if (btn === 'BTN5') {
                    fireKeyEvent('KeyS', 's', 83, false);
                } else if (btn === 'BTN6') {
                    fireKeyEvent('KeyD', 'd', 68, false);
                } else if (btn === 'MAME_MENU') {
                    fireKeyEvent('Tab', 'Tab', 9, false);
                } else if (btn === 'MAME_SERVICE') {
                    fireKeyEvent('F2', 'F2', 113, false);
                } else if (btn === 'MAME_RESET') {
                    fireKeyEvent('F3', 'F3', 114, false);
                } else if (btn === 'MAME_SCRLK') {
                    fireKeyEvent('ScrollLock', 'ScrollLock', 145, false);
                } else if (btn === 'MAME_F1') {
                    fireKeyEvent('F1', 'F1', 112, false);
                } else if (btn === 'MAME_F2') {
                    fireKeyEvent('F2', 'F2', 113, false);
                } else if (btn === 'MAME_F3') {
                    fireKeyEvent('F3', 'F3', 114, false);
                }
            }

            var turboIntervals = {};
            function startTurbo(btn, speedMs) {
                stopTurbo(btn);
                var state = false;
                turboIntervals[btn] = setInterval(function() {
                    state = !state;
                    if (state) {
                        pressButton(btn);
                        if (btn === 'A') fireKeyEvent('KeyQ', 'q', 81, true);
                        if (btn === 'B') fireKeyEvent('KeyE', 'e', 69, true);
                    } else {
                        releaseButton(btn);
                        if (btn === 'A') fireKeyEvent('KeyQ', 'q', 81, false);
                        if (btn === 'B') fireKeyEvent('KeyE', 'e', 69, false);
                    }
                }, speedMs || 40);
            }

            function stopTurbo(btn) {
                if (turboIntervals[btn]) {
                    clearInterval(turboIntervals[btn]);
                    delete turboIntervals[btn];
                }
                releaseButton(btn);
                if (btn === 'A') fireKeyEvent('KeyQ', 'q', 81, false);
                if (btn === 'B') fireKeyEvent('KeyE', 'e', 69, false);
            }

            window.addEventListener('message', function(e) {
                if (!e.data || typeof e.data !== 'object') return;
                if (e.data.type === 'EJS_PRESS_BTN') {
                    pressButton(e.data.button);
                } else if (e.data.type === 'EJS_RELEASE_BTN') {
                    releaseButton(e.data.button);
                } else if (e.data.type === 'EJS_START_TURBO') {
                    startTurbo(e.data.button, e.data.speedMs);
                } else if (e.data.type === 'EJS_STOP_TURBO') {
                    stopTurbo(e.data.button);
                }
            });

            // Hook into EmulatorJS database / FS mount event to write binary data directly
            window.EJS_ready = function() {
                if (window.EJS_emulator) {
                    window.EJS_emulator.on('start', function() {
                        if (window.parent && window.parent.__EJS_ACTIVE_STATE__ && window.parent.__EJS_ACTIVE_STATE__.byteLength > 0) {
                            var stateData = window.parent.__EJS_ACTIVE_STATE__;
                            setTimeout(function() {
                                try {
                                    if (window.EJS_emulator && window.EJS_emulator.gameManager) {
                                        window.EJS_emulator.gameManager.loadState(stateData);
                                    }
                                } catch (err) {
                                    console.warn('Auto restore state error:', err);
                                }
                            }, 350);
                        }
                    });

                    window.EJS_emulator.on('saveDatabaseLoaded', function(fs) {
                        // 1. Inject PUAE / RetroArch core options file directly
                        if ('${emulatorJsCore}' === 'puae') {
                            const puaeConfig = [
                                'puae_model = "A500"',
                                'puae_floppy_speed = "100"',
                                'puae_cpu_compatibility = "exact"',
                                'puae_immediate_blits = "false"',
                                'puae_sound_interpol = "anti-aliasing"'
                            ].join('\\n');
                            const cfgBytes = new TextEncoder().encode(puaeConfig);
                            injectToFS(fs, 'retroarch-core-options.cfg', cfgBytes);
                            injectToFS(fs, 'system/retroarch-core-options.cfg', cfgBytes);
                            injectToFS(fs, 'config/PUAE/PUAE.opt', cfgBytes);
                        }

                        // 2. Inject Kickstart / System ROM / BIOS
                        if (window.parent && window.parent.__EJS_ACTIVE_BIOS__ && window.parent.__EJS_ACTIVE_BIOS__.byteLength > 0) {
                            const biosData = window.parent.__EJS_ACTIVE_BIOS__;
                            const biosNames = [
                                'kick34005.A500', 'system/kick34005.A500',
                                'kick13.rom', 'system/kick13.rom',
                                'kick40068.A1200', 'system/kick40068.A1200',
                                'kick37175.A500', 'system/kick37175.A500',
                                'kick33180.A500', 'system/kick33180.A500',
                                'kick40063.A600', 'system/kick40063.A600',
                                'kick.rom', 'system/kick.rom',
                                '5200.rom', 'system/5200.rom',
                                'ATARI5200.ROM', 'system/ATARI5200.ROM',
                                '7800 BIOS (U).rom', 'system/7800 BIOS (U).rom',
                                'jagboot.rom', 'system/jagboot.rom',
                                'jagcd.rom', 'system/jagcd.rom',
                                'lynxboot.img', 'system/lynxboot.img',
                                'tos.img', 'system/tos.img',
                                'tos.rom', 'system/tos.rom',
                                'tos102.img', 'system/tos102.img',
                                'tos104.img', 'system/tos104.img',
                                'tos206.img', 'system/tos206.img',
                                'emutos.img', 'system/emutos.img',
                                'ATARIXL.ROM', 'system/ATARIXL.ROM',
                                'ATARIBAS.ROM', 'system/ATARIBAS.ROM',
                                'ATARIOSB.ROM', 'system/ATARIOSB.ROM',
                                'ATARIOSA.ROM', 'system/ATARIOSA.ROM',
                                'a800.zip', 'system/a800.zip', 'roms/a800.zip',
                                'atari800.zip', 'system/atari800.zip', 'roms/atari800.zip',
                                'neogeo.zip', 'system/neogeo.zip', 'roms/neogeo.zip',
                                'qsound.zip', 'system/qsound.zip', 'roms/qsound.zip',
                                'pgm.zip', 'system/pgm.zip', 'roms/pgm.zip',
                                'decocass.zip', 'system/decocass.zip', 'roms/decocass.zip'
                            ];
                            if (window.parent && window.parent.__EJS_ACTIVE_BIOS_NAME__) {
                                const customName = window.parent.__EJS_ACTIVE_BIOS_NAME__;
                                biosNames.push(customName, 'system/' + customName, 'roms/' + customName);
                            }
                            for (const bName of biosNames) {
                                injectToFS(fs, bName, biosData);
                            }
                        }

                        // 3. Inject all disk images / ROM assets
                        if (window.parent && window.parent.__EJS_ACTIVE_DISKS__) {
                            const disks = window.parent.__EJS_ACTIVE_DISKS__;
                            for (const [dName, dBytes] of Object.entries(disks)) {
                                injectToFS(fs, dName, dBytes);
                                injectToFS(fs, 'roms/' + dName, dBytes);
                                injectToFS(fs, 'system/' + dName, dBytes);
                            }
                        }

                        // 4. Inject .m3u playlist file
                        if (window.parent && window.parent.__EJS_M3U_NAME__ && window.parent.__EJS_M3U_CONTENT__) {
                            const mName = window.parent.__EJS_M3U_NAME__;
                            const mContent = window.parent.__EJS_M3U_CONTENT__;
                            const mBytes = new TextEncoder().encode(mContent);
                            injectToFS(fs, mName, mBytes);
                            injectToFS(fs, 'game.m3u', mBytes);
                        }

                        // 5. Inject single ROM
                        if (window.parent && window.parent.__EJS_ACTIVE_ROM__ && window.parent.__EJS_ACTIVE_ROM__.byteLength > 0) {
                            const rName = window.parent.__EJS_ACTIVE_ROM_NAME__ || '${safeGameName}';
                            const rBytes = window.parent.__EJS_ACTIVE_ROM__;
                            injectToFS(fs, rName, rBytes);
                            injectToFS(fs, 'roms/' + rName, rBytes);
                            injectToFS(fs, 'system/' + rName, rBytes);
                            if (rName.toLowerCase().includes('a800')) {
                                injectToFS(fs, 'a800.zip', rBytes);
                                injectToFS(fs, 'roms/a800.zip', rBytes);
                                injectToFS(fs, 'system/a800.zip', rBytes);
                            }
                        }
                    });
                }
            };

            // 1. Register Kickstart ROM / BIOS in externalFiles
            if (window.parent && window.parent.__EJS_ACTIVE_BIOS__ && window.parent.__EJS_ACTIVE_BIOS__.byteLength > 0) {
                const biosBlob = new Blob([window.parent.__EJS_ACTIVE_BIOS__], { type: 'application/octet-stream' });
                const biosBlobUrl = URL.createObjectURL(biosBlob);
                // Note: Do NOT set window.EJS_biosUrl to blob URLs! EmulatorJS's downloadBios tries to fetch/extract
                // blob URLs as archives and writes to invalid paths, causing the emulator to freeze on "Downloading Game BIOS".
                // Instead, the BIOS data is directly and safely written to Emscripten FS (root, system/, etc.) in saveDatabaseLoaded.

                const biosNames = [
                    'kick34005.A500', 'system/kick34005.A500',
                    'kick13.rom', 'system/kick13.rom',
                    'kick40068.A1200', 'system/kick40068.A1200',
                    'kick37175.A500', 'system/kick37175.A500',
                    'kick33180.A500', 'system/kick33180.A500',
                    'kick40063.A600', 'system/kick40063.A600',
                    'kick.rom', 'system/kick.rom',
                    '5200.rom', 'system/5200.rom',
                    'ATARI5200.ROM', 'system/ATARI5200.ROM',
                    '7800 BIOS (U).rom', 'system/7800 BIOS (U).rom',
                    'jagboot.rom', 'system/jagboot.rom',
                    'jagcd.rom', 'system/jagcd.rom',
                    'lynxboot.img', 'system/lynxboot.img',
                    'tos.img', 'system/tos.img',
                    'tos.rom', 'system/tos.rom',
                    'tos102.img', 'system/tos102.img',
                    'tos104.img', 'system/tos104.img',
                    'tos206.img', 'system/tos206.img',
                    'emutos.img', 'system/emutos.img',
                    'ATARIXL.ROM', 'system/ATARIXL.ROM',
                    'ATARIBAS.ROM', 'system/ATARIBAS.ROM',
                    'ATARIOSB.ROM', 'system/ATARIOSB.ROM',
                    'ATARIOSA.ROM', 'system/ATARIOSA.ROM',
                    'a800.zip', 'system/a800.zip', 'roms/a800.zip',
                    'atari800.zip', 'system/atari800.zip', 'roms/atari800.zip',
                    'neogeo.zip', 'system/neogeo.zip', 'roms/neogeo.zip',
                    'qsound.zip', 'system/qsound.zip', 'roms/qsound.zip',
                    'pgm.zip', 'system/pgm.zip', 'roms/pgm.zip',
                    'decocass.zip', 'system/decocass.zip', 'roms/decocass.zip'
                ];
                if (window.parent && window.parent.__EJS_ACTIVE_BIOS_NAME__) {
                    const customName = window.parent.__EJS_ACTIVE_BIOS_NAME__;
                    biosNames.push(customName, 'system/' + customName, 'roms/' + customName);
                }
                for (const bName of biosNames) {
                    externalFiles[bName] = biosBlobUrl;
                    externalFiles['/' + bName] = biosBlobUrl;
                }
            }

            // 2. Multi-Disk vs Single ROM handling
            const hasMultiDisks = window.parent && window.parent.__EJS_ACTIVE_DISKS__ && Object.keys(window.parent.__EJS_ACTIVE_DISKS__).length > 1;

            if (hasMultiDisks) {
                const disks = window.parent.__EJS_ACTIVE_DISKS__;
                const m3uName = window.parent.__EJS_M3U_NAME__ || '${safeGameName}';
                const m3uContent = window.parent.__EJS_M3U_CONTENT__ || Object.keys(disks).join('\\n');

                // Register all disk files in externalFiles
                for (const [diskName, diskBytes] of Object.entries(disks)) {
                    const diskBlob = new Blob([diskBytes], { type: 'application/octet-stream' });
                    const diskBlobUrl = URL.createObjectURL(diskBlob);
                    externalFiles[diskName] = diskBlobUrl;
                    externalFiles['/' + diskName] = diskBlobUrl;
                }

                // Register .m3u playlist file as primary gameUrl
                const m3uBlob = new Blob([m3uContent], { type: 'text/plain' });
                const m3uUrl = URL.createObjectURL(m3uBlob);
                externalFiles[m3uName] = m3uUrl;
                externalFiles['/' + m3uName] = m3uUrl;

                window.EJS_gameName = m3uName;
                window.EJS_gameUrl = m3uUrl;
            } else if (window.parent && window.parent.__EJS_ACTIVE_ROM__ && window.parent.__EJS_ACTIVE_ROM__.byteLength > 0) {
                const romName = window.parent.__EJS_ACTIVE_ROM_NAME__ || '${safeGameName}';
                const romBlob = new Blob([window.parent.__EJS_ACTIVE_ROM__], { type: 'application/octet-stream' });
                const romUrl = URL.createObjectURL(romBlob);

                // If multi-file single ROM (e.g. CUE + BIN tracks), also register track files
                if (window.parent && window.parent.__EJS_ACTIVE_DISKS__) {
                    const allTracks = window.parent.__EJS_ACTIVE_DISKS__;
                    for (const [trackName, trackBytes] of Object.entries(allTracks)) {
                        const trackBlob = new Blob([trackBytes], { type: 'application/octet-stream' });
                        const trackBlobUrl = URL.createObjectURL(trackBlob);
                        externalFiles[trackName] = trackBlobUrl;
                        externalFiles['/' + trackName] = trackBlobUrl;
                    }
                }

                window.EJS_gameName = romName;
                window.EJS_gameUrl = romUrl;
            } else if ('${config.romUrl || ''}') {
                window.EJS_gameName = '${safeGameName}';
                window.EJS_gameUrl = '${config.romUrl || ''}';
            }

            if (Object.keys(externalFiles).length > 0) {
                window.EJS_externalFiles = externalFiles;
            }

            window.EJS_threads = false;

            // Safe fallback patches to prevent EmulatorJS hangs
            const setupSafetyTimer = setInterval(function() {
                if (window.EmulatorJS && window.EmulatorJS.prototype) {
                    clearInterval(setupSafetyTimer);
                    // 1. Bypass downloadBios: prevents hanging on blob URLs because BIOS data is already written to FS directly
                    window.EmulatorJS.prototype.downloadBios = function() {
                        return Promise.resolve();
                    };
                    // 2. Protect setupDisksMenu from throwing UI errors on disk insertion
                    const origSetupDisks = window.EmulatorJS.prototype.setupDisksMenu;
                    if (origSetupDisks) {
                        window.EmulatorJS.prototype.setupDisksMenu = function() {
                            try {
                                origSetupDisks.call(this);
                            } catch (err) {
                                console.warn('Protected setupDisksMenu execution:', err);
                            }
                        };
                    }
                }
            }, 10);
        </script>
        <script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>
    </body>
    </html>
  `;

  const isNesCore = config.core === 'nes' || config.core === 'famicom';
  const isMameCore = config.core === 'mame';
  const isRetroConsole = [
    'nes', 'famicom', 'snes', 'segaMD', 'segaMS', 'segaGG',
    'gb', 'gbc', 'gba',
    'atari2600', 'atari5200', 'atari7800', 'atariLynx', 'atariJaguar'
  ].includes(config.core);

  const getControllerLabel = () => {
    if (isNesCore) return 'Famicom / Dendy Pad (4 Buttons)';
    if (config.core === 'atari2600') return 'Atari 2600 Joystick (Fire / Reset / Select)';
    if (config.core === 'atari5200') return 'Atari 5200 Controller (Fire 1 & 2 / Reset)';
    if (config.core === 'atari7800') return 'Atari 7800 ProLine Pad (Fire 1 & 2 / Pause)';
    if (config.core === 'atariLynx') return 'Atari Lynx Handheld (A / B / Opt 1 & 2)';
    if (config.core === 'atariJaguar') return 'Atari Jaguar 64-Bit Controller';
    return 'Turbo Controller';
  };

  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden border border-neutral-800 shadow-2xl relative flex flex-col">
      {/* MAME Arcade Cabinet Controls Bar */}
      {isMameCore && (
        <div className="bg-neutral-900/95 border-b border-neutral-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none z-10 backdrop-blur-md">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-1 rounded-lg tracking-wider uppercase flex items-center gap-1 shadow-sm">
              🕹️ MAME Arcade Cabinet Controls
            </span>

            {/* Coin Inserts */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => handlePressBtn('COIN1')}
                onMouseUp={() => handleReleaseBtn('COIN1')}
                onTouchStart={() => handlePressBtn('COIN1')}
                onTouchEnd={() => handleReleaseBtn('COIN1')}
                className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Вкинути жетон Coin 1 (Клавіша: 5)"
              >
                🪙 Coin 1 (5)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('COIN2')}
                onMouseUp={() => handleReleaseBtn('COIN2')}
                onTouchStart={() => handlePressBtn('COIN2')}
                onTouchEnd={() => handleReleaseBtn('COIN2')}
                className="px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border border-yellow-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Вкинути жетон Coin 2 (Клавіша: 6)"
              >
                🪙 Coin 2 (6)
              </button>
            </div>

            {/* Players Start */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => handlePressBtn('1P_START')}
                onMouseUp={() => handleReleaseBtn('1P_START')}
                onTouchStart={() => handlePressBtn('1P_START')}
                onTouchEnd={() => handleReleaseBtn('1P_START')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Старт Гравця 1 (Клавіша: 1)"
              >
                👤 1P Start (1)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('2P_START')}
                onMouseUp={() => handleReleaseBtn('2P_START')}
                onTouchStart={() => handlePressBtn('2P_START')}
                onTouchEnd={() => handleReleaseBtn('2P_START')}
                className="px-2.5 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border border-blue-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Старт Гравця 2 (Клавіша: 2)"
              >
                👥 2P Start (2)
              </button>
            </div>

            {/* Arcade Action Buttons 1 - 6 */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              {[
                { id: 'BTN1' as ControllerBtn, label: 'B1', keyName: 'Ctrl / Z', color: 'bg-red-500/20 hover:bg-red-500/40 text-red-300 border-red-500/30' },
                { id: 'BTN2' as ControllerBtn, label: 'B2', keyName: 'Alt / X', color: 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 border-blue-500/30' },
                { id: 'BTN3' as ControllerBtn, label: 'B3', keyName: 'Space / C', color: 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-300 border-yellow-500/30' },
                { id: 'BTN4' as ControllerBtn, label: 'B4', keyName: 'Shift / V', color: 'bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border-emerald-500/30' },
                { id: 'BTN5' as ControllerBtn, label: 'B5', keyName: 'S', color: 'bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border-purple-500/30' },
                { id: 'BTN6' as ControllerBtn, label: 'B6', keyName: 'D', color: 'bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 border-pink-500/30' },
              ].map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  onMouseDown={() => handlePressBtn(btn.id)}
                  onMouseUp={() => handleReleaseBtn(btn.id)}
                  onTouchStart={() => handlePressBtn(btn.id)}
                  onTouchEnd={() => handleReleaseBtn(btn.id)}
                  className={`px-2 py-1 rounded-lg ${btn.color} border text-xs font-black transition-all cursor-pointer active:scale-95`}
                  title={`Аркадна кнопка ${btn.label} (${btn.keyName})`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* MAME Menu & Reset & Service & Computer/Atari Keys */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_SCRLK')}
                onMouseUp={() => handleReleaseBtn('MAME_SCRLK')}
                onTouchStart={() => handlePressBtn('MAME_SCRLK')}
                onTouchEnd={() => handleReleaseBtn('MAME_SCRLK')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-yellow-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Перемикання UI MAME / Клавіатура емульованої системи (Клавіша: Scroll Lock)"
              >
                ⌨️ ScrLk (UI)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_F1')}
                onMouseUp={() => handleReleaseBtn('MAME_F1')}
                onTouchStart={() => handlePressBtn('MAME_F1')}
                onTouchEnd={() => handleReleaseBtn('MAME_F1')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Atari Start / MAME F1"
              >
                F1 (Start)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_SERVICE')}
                onMouseUp={() => handleReleaseBtn('MAME_SERVICE')}
                onTouchStart={() => handlePressBtn('MAME_SERVICE')}
                onTouchEnd={() => handleReleaseBtn('MAME_SERVICE')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-cyan-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Сервісне меню / Тест аркадної плати / Atari Select (Клавіша: F2)"
              >
                🛠️ F2 (Service)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_F3')}
                onMouseUp={() => handleReleaseBtn('MAME_F3')}
                onTouchStart={() => handlePressBtn('MAME_F3')}
                onTouchEnd={() => handleReleaseBtn('MAME_F3')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-orange-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Atari Option / F3"
              >
                F3 (Option)
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_MENU')}
                onMouseUp={() => handleReleaseBtn('MAME_MENU')}
                onTouchStart={() => handlePressBtn('MAME_MENU')}
                onTouchEnd={() => handleReleaseBtn('MAME_MENU')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Меню налаштувань MAME / Dip Switches / Ремап (Клавіша: Tab)"
              >
                ⚙️ Tab Menu
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('MAME_RESET')}
                onMouseUp={() => handleReleaseBtn('MAME_RESET')}
                onTouchStart={() => handlePressBtn('MAME_RESET')}
                onTouchEnd={() => handleReleaseBtn('MAME_RESET')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-red-400 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95 border border-neutral-700"
                title="Скинути автомат / Service Reset (Shift+F3 / F3)"
              >
                🔄 Reset (F3)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono hidden lg:flex">
            <span className="bg-neutral-950/80 px-2 py-0.5 rounded border border-neutral-800 text-neutral-300">
              🎮 Джойстик: Стрілки / WASD
            </span>
            <span className="bg-neutral-950/80 px-2 py-0.5 rounded border border-neutral-800 text-amber-300/80">
              Меню RetroArch: Enter / X (вибір), Z (назад)
            </span>
          </div>
        </div>
      )}

      {/* MAME Info & Quick Switch Bar */}
      {isMameCore && (
        <div className="bg-amber-950/40 border-b border-amber-500/25 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 shrink-0 select-none z-10 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-400 flex items-center gap-1">
              ⚠️ Меню RetroArch (Main Menu):
            </span>
            <span className="text-amber-200/90 text-[11px]">
              Браузерне ядро MAME 2003 підтримує <b>аркадні автомати</b> (напр. Pac-Man, Galaga, Metal Slug). Образи комп'ютера <b>Atari 800 (a800)</b> не мають аркадного драйвера в MAME 2003.
            </span>
          </div>
          {onSwitchToAtari && (
            <button
              type="button"
              onClick={onSwitchToAtari}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-extrabold text-xs shrink-0 transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
            >
              🚀 Запустити в емуляторі Atari 8-bit
            </button>
          )}
        </div>
      )}

      {/* Turbo & Combo Controller Bar for NES & Retro Consoles */}
      {isRetroConsole && (
        <div className="bg-neutral-900/95 border-b border-neutral-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 select-none z-10 backdrop-blur-md">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-lg tracking-wider uppercase flex items-center gap-1 shadow-sm">
              🎮 {getControllerLabel()}
            </span>

            {/* Standard B & A Buttons */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => handlePressBtn('B')}
                onMouseUp={() => handleReleaseBtn('B')}
                onMouseLeave={() => handleReleaseBtn('B')}
                onTouchStart={() => handlePressBtn('B')}
                onTouchEnd={() => handleReleaseBtn('B')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Звичайна кнопка B (Клавіші: Z / S)"
              >
                B
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('A')}
                onMouseUp={() => handleReleaseBtn('A')}
                onMouseLeave={() => handleReleaseBtn('A')}
                onTouchStart={() => handlePressBtn('A')}
                onTouchEnd={() => handleReleaseBtn('A')}
                className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 border border-red-500/30 text-xs font-black transition-all cursor-pointer active:scale-95"
                title="Звичайна кнопка A (Клавіша: X)"
              >
                A
              </button>
            </div>

            {/* Turbo B */}
            <div className="flex items-center gap-0.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => !autoTurboB && handleStartTurbo('B')}
                onMouseUp={() => !autoTurboB && handleStopTurbo('B')}
                onMouseLeave={() => !autoTurboB && handleStopTurbo('B')}
                onTouchStart={() => !autoTurboB && handleStartTurbo('B')}
                onTouchEnd={() => !autoTurboB && handleStopTurbo('B')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                  autoTurboB
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/50 animate-pulse'
                    : 'bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 border border-amber-500/40'
                }`}
                title="Швидкий турбо-вогонь кнопки B (Клавіша: W)"
              >
                ⚡ Turbo B
              </button>
              <button
                type="button"
                onClick={toggleAutoTurboB}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                  autoTurboB ? 'bg-amber-500 text-black font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
                title="Автоматична фіксація Turbo B (Auto-Lock)"
              >
                {autoTurboB ? 'LOCK' : 'AUTO'}
              </button>
            </div>

            {/* Turbo A */}
            <div className="flex items-center gap-0.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => !autoTurboA && handleStartTurbo('A')}
                onMouseUp={() => !autoTurboA && handleStopTurbo('A')}
                onMouseLeave={() => !autoTurboA && handleStopTurbo('A')}
                onTouchStart={() => !autoTurboA && handleStartTurbo('A')}
                onTouchEnd={() => !autoTurboA && handleStopTurbo('A')}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                  autoTurboA
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse'
                    : 'bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/40'
                }`}
                title="Швидкий турбо-вогонь кнопки A (Клавіша: Q)"
              >
                ⚡ Turbo A
              </button>
              <button
                type="button"
                onClick={toggleAutoTurboA}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                  autoTurboA ? 'bg-red-500 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'
                }`}
                title="Автоматична фіксація Turbo A (Auto-Lock)"
              >
                {autoTurboA ? 'LOCK' : 'AUTO'}
              </button>
            </div>

            {/* Combo A + B */}
            <button
              type="button"
              onMouseDown={() => handlePressBtn('AB')}
              onMouseUp={() => handleReleaseBtn('AB')}
              onMouseLeave={() => handleReleaseBtn('AB')}
              onTouchStart={() => handlePressBtn('AB')}
              onTouchEnd={() => handleReleaseBtn('AB')}
              className="px-3 py-1.5 rounded-xl bg-sky-500/25 hover:bg-sky-500/45 text-sky-300 border border-sky-500/40 text-xs font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
              title="Одночасне сумісне натискання кнопок A та B (Клавіша: E)"
            >
              🔥 A + B
            </button>

            {/* Select & Start */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onMouseDown={() => handlePressBtn('SELECT')}
                onMouseUp={() => handleReleaseBtn('SELECT')}
                onMouseLeave={() => handleReleaseBtn('SELECT')}
                onTouchStart={() => handlePressBtn('SELECT')}
                onTouchEnd={() => handleReleaseBtn('SELECT')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95"
                title="Кнопка SELECT (Shift / C)"
              >
                Select
              </button>
              <button
                type="button"
                onMouseDown={() => handlePressBtn('START')}
                onMouseUp={() => handleReleaseBtn('START')}
                onMouseLeave={() => handleReleaseBtn('START')}
                onTouchStart={() => handlePressBtn('START')}
                onTouchEnd={() => handleReleaseBtn('START')}
                className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold uppercase transition-all cursor-pointer active:scale-95"
                title="Кнопка START (Enter)"
              >
                Start
              </button>
            </div>
          </div>

          {/* Speed Selector & Key Hints */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-400 font-medium hidden lg:inline">Частота:</span>
            <div className="flex items-center bg-neutral-950 rounded-lg p-0.5 border border-neutral-800">
              {[
                { label: '15Hz', ms: 66 },
                { label: '25Hz', ms: 40 },
                { label: '35Hz', ms: 28 },
              ].map(s => (
                <button
                  key={s.ms}
                  type="button"
                  onClick={() => setTurboSpeedMs(s.ms)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    turboSpeedMs === s.ms ? 'bg-sky-500 text-black' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-neutral-500 font-mono hidden xl:inline">
              Hotkeys: Q (Turbo A) | W (Turbo B) | E (A+B)
            </span>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={iframeKey}
        srcDoc={htmlContent}
        className="w-full flex-1 border-0"
        allow="autoplay; fullscreen; gamepad"
        title="Retro Emulator Stage"
      />
    </div>
  );
});

export default EmulatorStage;
