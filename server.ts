import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '64mb' }));
app.use(express.urlencoded({ extended: true, limit: '64mb' }));

// Serve static assets from public directory (bevy-atari wasm/pokey, bios, images)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Bevy Atari 8-Bit Engine Information
app.get('/api/bevy-atari/info', (req, res) => {
  res.json({
    status: 'ready',
    engine: 'bevy-atari (Rust + Bevy + WebGL2 ANTIC/GTIA + Cycle-Exact 6502 + POKEY AudioWorklet)',
    version: '1.0.0-wasm',
    author: 'mrk-its',
    features: [
      'ANTIC / GTIA GPU fragment shader hardware acceleration (WebGL2)',
      'Cycle-accurate 6502 CPU with invalid opcodes and DMA cycle stealing',
      'Web-POKEY stereo sound engine with AudioWorklet processor',
      '256 KB extended banked RAM emulation',
      'ATR Floppy Disk Image support with SIO patch',
      'CAR Cartridge Image support (Standard 8K, AtariMax 128K, AtariMax 1M)',
      'XEX Direct Atari DOS binary executable loader',
      'HTML5 Gamepad API & real Atari console keys (Start, Select, Option)',
    ],
  });
});

// EMULATRON AI BRIDGE — REST API Endpoints for external AI agents
app.get('/api/ai-bridge/capabilities', (req, res) => {
  res.json({
    protocol: 'emulatron-ai-bridge',
    version: '1.0',
    supportedCommands: [
      'get_capabilities',
      'get_status',
      'load_rom',
      'reset',
      'run_frames',
      'press_button',
      'release_button',
      'release_all_buttons',
      'get_screenshot',
      'get_cpu_state',
      'get_ppu_state',
      'read_memory',
      'get_test_results',
      'run_test_suite',
    ],
    supportedButtons: ['A', 'B', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'TURBO_A', 'TURBO_B'],
    supportedCores: ['nes', 'famicom', 'snes', 'gb', 'gbc', 'gba', 'segaMD', 'atari8bit'],
    transports: {
      directBrowserApi: 'window.__EMULATRON_AI_BRIDGE__',
      postMessage: "window.postMessage({ protocol: 'emulatron-ai-bridge', version: '1.0', ... }, '*')",
      broadcastChannel: 'emulatron-ai-bridge',
      httpRestEndpoint: '/api/ai-bridge/command',
    },
    features: {
      screenshotCapture: true,
      frameStepping: true,
      stateSnapshots: true,
      memoryInspection: true,
      cpuStateInspection: true,
      ppuStateInspection: true,
      blackScreenDetection: true,
      freezeDetection: true,
      automatedTestRunner: true,
    },
    limits: {
      maxFramesPerCall: 3600,
      maxMemoryReadBytes: 4096,
      commandTimeoutMs: 12000,
    },
  });
});

app.get('/api/ai-bridge/status', (req, res) => {
  res.json({
    protocol: 'emulatron-ai-bridge',
    version: '1.0',
    serverStatus: 'online',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
    defaultCore: 'nes',
    bridgeActive: true,
  });
});

app.get('/api/ai-bridge/test-suites', (req, res) => {
  res.json({
    protocol: 'emulatron-ai-bridge',
    version: '1.0',
    suites: [
      {
        id: 'nes-boot-sanity',
        name: 'NES Core Boot & Sanity Check',
        description: 'Loads the builtin test pattern, executes 120 frames, checks for black screen, and verifies rendering output.',
        targetCore: 'nes',
      },
      {
        id: 'nes-controller-responsiveness',
        name: 'NES Controller & Input Responsiveness Test',
        description: 'Sequentially exercises all NES buttons (A, B, SELECT, START, D-Pad) and verifies input registration.',
        targetCore: 'nes',
      },
      {
        id: 'nes-stability-and-freeze-check',
        name: 'NES Frame Stability & Freeze Detector',
        description: 'Runs continuous execution for 180 frames, monitors frame variation, and asserts the rendering pipeline does not hang.',
        targetCore: 'nes',
      },
    ],
  });
});

app.post('/api/ai-bridge/command', (req, res) => {
  const { command, params } = req.body || {};
  if (!command) {
    return res.status(400).json({
      protocol: 'emulatron-ai-bridge',
      version: '1.0',
      success: false,
      error: { code: 'INVALID_COMMAND', message: "Missing required 'command' field" },
      timestamp: Date.now(),
    });
  }

  // Handle standard REST commands
  if (command === 'get_capabilities') {
    return res.json({
      protocol: 'emulatron-ai-bridge',
      version: '1.0',
      id: req.body?.id || `req_${Date.now()}`,
      command,
      success: true,
      result: {
        protocol: 'emulatron-ai-bridge',
        version: '1.0',
        supportedCommands: [
          'get_capabilities', 'get_status', 'load_rom', 'reset', 'run_frames',
          'press_button', 'release_button', 'release_all_buttons', 'get_screenshot',
          'get_cpu_state', 'get_ppu_state', 'read_memory', 'get_test_results', 'run_test_suite'
        ],
      },
      timestamp: Date.now(),
    });
  }

  // Acknowledge command receipt and instruct client agent on active window state
  res.json({
    protocol: 'emulatron-ai-bridge',
    version: '1.0',
    id: req.body?.id || `req_${Date.now()}`,
    command,
    success: true,
    result: {
      status: 'acknowledged',
      executedBy: 'server_bridge_proxy',
      details: params || {},
      note: 'Command processed. When connecting to a browser session, use window.__EMULATRON_AI_BRIDGE__ or postMessage for synchronous canvas frame inspection.',
    },
    timestamp: Date.now(),
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
