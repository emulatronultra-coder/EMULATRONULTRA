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
