# EMULATRON AI BRIDGE — AI Agent Integration Protocol
**Protocol:** `emulatron-ai-bridge`  
**Version:** `1.0`  
**Architecture:** Emulator Adapter • AI Bridge • Diagnostic API • Automated Test Runner  

---

## 1. Overview
The **EMULATRON AI Bridge** is a versioned, secure protocol that allows external AI agents (autonomous agents, LLM tool runners, test orchestrators, Playwright/Puppeteer automation scripts, and REST clients) to control the NES emulator, inspect hardware and memory state, capture and analyze frames, detect crashes/freezes, and execute repeatable test suites.

The integration reuses the existing NES emulator core (EmulatorJS NES / RetroArch web core) without creating separate emulators or disrupting normal gameplay.

---

## 2. Architecture & Components

```
+-------------------------------------------------------------------------+
|                          External AI Agents                              |
|   (Python Agents / Headless Chrome / Puppeteer / Playwright / REST / MCP) |
+-------------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
   Direct Object API         postMessage RPC            HTTP REST API
 window.__EMULATRON_...     window.postMessage        /api/ai-bridge/*
          |                         |                         |
          +-------------------------+-------------------------+
                                    |
+-------------------------------------------------------------------------+
|                  EMULATRON AI BRIDGE CORE (v1.0)                        |
|  - Request Validation & Timeout Guards (12s limit)                      |
|  - Security & Authentication (Token & Origin Whitelists)                |
|  - Event Logging & Developer Interface                                  |
+-------------------------------------------------------------------------+
           |                                              |
+----------------------+                       +----------------------+
|  DIAGNOSTIC SERVICE  |                       |  AUTOMATED TEST RUN  |
|  - Black-Screen Det. |                       |  - Step Orchestration|
|  - Freeze Detector   |                       |  - Checkpoints & Snap|
|  - 6502 CPU Monitor  |                       |  - Failure Analysis  |
|  - 2C02 PPU Monitor  |                       |  - JSON Reports      |
|  - Memory Inspector  |                       +----------------------+
+----------------------+                                  |
           |                                              |
+-------------------------------------------------------------------------+
|                          NES EMULATOR ADAPTER                            |
|  - Frame Stepping & Timing                                              |
|  - NES Controller Strobe (D-Pad, A, B, Turbo, Select, Start)            |
|  - Screen Canvas Frame Grabber                                          |
|  - Reset & ROM Loader                                                   |
+-------------------------------------------------------------------------+
                                    |
+-------------------------------------------------------------------------+
|                     EMULATRONULTRA EMULATOR CORE                        |
|  (NES 2C02 PPU + MOS 6502 CPU + WebAudio APU + Virtual Canvas)           |
+-------------------------------------------------------------------------+
```

---

## 3. Communication Transports

### A. Direct Browser API (Headless Chrome / Playwright / Puppeteer)
Global singleton on the window object:
```javascript
const bridge = window.__EMULATRON_AI_BRIDGE__;

// Execute any command
const response = await bridge.executeCommand({
  protocol: 'emulatron-ai-bridge',
  version: '1.0',
  id: 'req_001',
  command: 'get_status'
});
console.log(response.result);
```

### B. `window.postMessage` RPC Protocol
Send messages from parent frames, popup windows, or browser extensions:
```javascript
window.postMessage({
  protocol: 'emulatron-ai-bridge',
  version: '1.0',
  id: 'req_002',
  command: 'get_screenshot'
}, '*');

window.addEventListener('message', (event) => {
  if (event.data?.protocol === 'emulatron-ai-bridge' && event.data?.id === 'req_002') {
    console.log('Screenshot captured:', event.data.result.dataUrl);
    console.log('Luminance analysis:', event.data.result.analysis);
  }
});
```

### C. HTTP REST Proxy API (Python / Node.js Agents / curl)
The server exposes endpoints on port 3000:
- `GET /api/ai-bridge/capabilities` — Returns supported commands, buttons, and limits.
- `GET /api/ai-bridge/status` — Returns server bridge status.
- `GET /api/ai-bridge/test-suites` — Lists available automated test suites.
- `POST /api/ai-bridge/command` — Dispatches commands via JSON payload `{ "command": "...", "params": { ... } }`.

---

## 4. Required Protocol Commands

| Command | Parameters | Description |
|---|---|---|
| `get_capabilities` | *none* | Lists all supported commands, diagnostic features, limits, and active core info. |
| `get_status` | *none* | Returns execution state, active core, ROM info, frame count, estimated FPS, and controller state. |
| `load_rom` | `{ source: 'builtin'\|'buffer'\|'url', name?: string, data?: Uint8Array, url?: string }` | Loads a ROM from permitted sources. |
| `reset` | *none* | Performs a clean hardware reset of the 6502 CPU and 2C02 PPU. |
| `run_frames` | `{ count: number }` | Executes a specified number of frames (1 to 3600 frames). |
| `press_button` | `{ button: 'A'\|'B'\|'SELECT'\|'START'\|'UP'\|'DOWN'\|'LEFT'\|'RIGHT'\|'TURBO_A'\|'TURBO_B' }` | Simulates pressing a controller button. |
| `release_button` | `{ button: NesButton }` | Releases a previously pressed button. |
| `release_all_buttons`| *none* | Releases all pressed buttons. |
| `get_screenshot` | *none* | Captures the current frame as base64 PNG data URL along with black-screen luminance metrics. |
| `get_cpu_state` | *none* | Returns 6502 registers (`A`, `X`, `Y`, `PC`, `SP`, `Status`) and execution flags. |
| `get_ppu_state` | *none* | Returns 2C02 PPU rendering scanline, cycle, and control registers. |
| `read_memory` | `{ address: number, length: number }` | Safely reads bytes from NES memory (address `$0000` to `$FFFF`, max length 4096). |
| `get_test_results` | *none* | Returns the latest automated test report and report history. |
| `run_test_suite` | `{ suiteId: string }` | Runs an automated test suite (`nes-boot-sanity`, `nes-controller-responsiveness`, etc.). |

---

## 5. Diagnostics & Failure Detectors

### Black Screen & Blank Screen Detector
Rather than assuming every dark frame is a failure (e.g. title screen fade-ins), the detector analyzes quantitative pixel properties:
- **Average Luminance:** $Y = 0.299R + 0.587G + 0.114B$ (normalized to 0% – 100%).
- **Color Variance:** Population variance of pixel intensities to distinguish flat black from patterned dark scenes.
- **Non-Black Pixel Ratio:** Fraction of pixels with luminance $> 6 / 255$.
- **Detection Rule:** `isBlackScreen = (luminancePercent < threshold) && (nonBlackPixelRatio < 0.015) && (colorVariance < 15.0)`.

### Freeze Detector
Tracks consecutive identical frames during active emulation using a rolling hash. If consecutive identical frames exceed the configurable threshold (default 180 frames = 3 seconds at 60 FPS), `isFrozen` flags `true`.

---

## 6. Automated Testing (Test Runner)
The built-in `EmulatronTestRunner` automates repeatable diagnostic tests:

1. **`nes-boot-sanity`**:
   - Mounts the built-in NES Color Pattern test ROM
   - Resets the emulator core
   - Runs 60 frames and captures Checkpoint 1
   - Presses START and runs 30 frames
   - Releases START and runs 60 frames
   - Captures Checkpoint 2 and asserts: `not_black_screen`, `not_frozen`, `frames_advanced >= 120`.

2. **`nes-controller-responsiveness`**:
   - Exercises Action buttons (A, B) and D-Pad directions
   - Records checkpoints and verifies input strobing.

3. **`nes-stability-and-freeze-check`**:
   - Runs continuous execution for 180 frames and monitors pixel variance across checkpoints.

### Exporting Reports
Test reports can be downloaded as structured `.json` files via the Developer Interface or retrieved programmatically via `get_test_results`.

---

## 7. Security Policy
- **Whitelisted ROM Sources:** Agents may only load built-in homebrew test ROMs, user-provided local buffers, or whitelisted domains (`localhost`, `emulatronultra.ai.studio`, `cdn.emulatorjs.org`).
- **Memory Boundaries:** Memory reads are clamped to `$0000` – `$FFFF` with a maximum chunk size of 4096 bytes per call. Arbitrary memory writes are rejected.
- **Command Timeouts:** All commands are wrapped in a 12-second timeout guarantee to prevent agent deadlocks.
- **Auth Token Guard:** An optional authorization token (`authToken`) can be enforced for all external bridge calls.

---

## 8. Developer Interface
Access the **EMULATRON AI Bridge Developer Panel** via the UI:
- Click **"AI Bridge"** in the left sidebar status footer, or
- Click the glowing **"AI Bridge"** button in the active emulator header.

The panel features:
- **Status & Security:** Core status, FPS, frame count, auth token manager.
- **Command Sandbox:** Quick-action buttons and JSON command editor with instant response inspection.
- **Live Diagnostics:** Live frame capture with luminance/variance meters and 6502/2C02 register monitor.
- **Automated Tests:** One-click test suite execution with progress bar, checkpoint timeline, and JSON export.
- **Live Logs:** Real-time filterable event stream of all agent commands and execution latencies.
