/**
 * EMULATRON AI BRIDGE — Protocol Types & Schema Definitions
 * Protocol: emulatron-ai-bridge
 * Version: 1.0
 */

export const BRIDGE_PROTOCOL_NAME = 'emulatron-ai-bridge' as const;
export const BRIDGE_PROTOCOL_VERSION = '1.0' as const;

export type BridgeCommandName =
  | 'get_capabilities'
  | 'get_status'
  | 'load_rom'
  | 'reset'
  | 'run_frames'
  | 'press_button'
  | 'release_button'
  | 'release_all_buttons'
  | 'get_screenshot'
  | 'get_cpu_state'
  | 'get_ppu_state'
  | 'read_memory'
  | 'get_test_results'
  | 'run_test_suite';

export type BridgeErrorCode =
  | 'INVALID_COMMAND'
  | 'INVALID_PARAMS'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'CORE_NOT_SUPPORTED'
  | 'EXECUTION_ERROR'
  | 'ROM_LOAD_FAILED'
  | 'OUT_OF_BOUNDS'
  | 'BRIDGE_DISABLED';

export type NesButton =
  | 'A'
  | 'B'
  | 'SELECT'
  | 'START'
  | 'UP'
  | 'DOWN'
  | 'LEFT'
  | 'RIGHT'
  | 'TURBO_A'
  | 'TURBO_B';

export interface BridgeRequest<T = Record<string, unknown>> {
  protocol: typeof BRIDGE_PROTOCOL_NAME;
  version: typeof BRIDGE_PROTOCOL_VERSION;
  id: string;
  command: BridgeCommandName;
  params?: T;
  timestamp?: number;
  token?: string;
}

export interface BridgeResponse<T = unknown> {
  protocol: typeof BRIDGE_PROTOCOL_NAME;
  version: typeof BRIDGE_PROTOCOL_VERSION;
  id: string;
  command: BridgeCommandName;
  success: boolean;
  result?: T;
  error?: {
    code: BridgeErrorCode;
    message: string;
    details?: unknown;
  };
  durationMs?: number;
  timestamp: number;
}

// Capabilities
export interface BridgeCapabilities {
  protocol: typeof BRIDGE_PROTOCOL_NAME;
  version: typeof BRIDGE_PROTOCOL_VERSION;
  supportedCommands: BridgeCommandName[];
  supportedButtons: NesButton[];
  supportedCores: string[];
  activeCore: string;
  features: {
    screenshotCapture: boolean;
    frameStepping: boolean;
    stateSnapshots: boolean;
    memoryInspection: boolean;
    cpuStateInspection: boolean;
    ppuStateInspection: boolean;
    blackScreenDetection: boolean;
    freezeDetection: boolean;
    automatedTestRunner: boolean;
  };
  limits: {
    maxFramesPerCall: number;
    maxMemoryReadBytes: number;
    commandTimeoutMs: number;
  };
}

// Status
export interface EmulatorExecutionStatus {
  activeCore: string;
  isReady: boolean;
  isRunning: boolean;
  isPaused: boolean;
  hasRomLoaded: boolean;
  romName: string | null;
  romSizeBytes: number | null;
  romHash: string | null;
  currentFrameCount: number;
  estimatedFps: number;
  uptimeSeconds: number;
  controllerState: Record<NesButton, boolean>;
  screenResolution: { width: number; height: number };
}

// CPU State (6502 / NES)
export interface CpuState {
  isSupported: boolean;
  architecture: 'MOS 6502' | string;
  registers: {
    pc: number | null;
    sp: number | null;
    a: number | null;
    x: number | null;
    y: number | null;
    status: number | null;
  };
  flags?: {
    carry?: boolean;
    zero?: boolean;
    interruptDisable?: boolean;
    decimal?: boolean;
    break?: boolean;
    overflow?: boolean;
    negative?: boolean;
  };
  cycles?: number;
  notice?: string;
}

// PPU State (NES 2C02)
export interface PpuState {
  isSupported: boolean;
  scanline: number | null;
  cycle: number | null;
  frame: number | null;
  controlRegisters: {
    ppuctrl: number | null;
    ppumask: number | null;
    ppustatus: number | null;
    oamaddr: number | null;
  };
  resolution: { width: number; height: number };
  notice?: string;
}

// Screenshot & Analysis
export interface ScreenshotResult {
  dataUrl: string; // Base64 PNG
  width: number;
  height: number;
  timestamp: number;
  analysis: BlackScreenAnalysis;
}

export interface BlackScreenAnalysis {
  isBlackScreen: boolean;
  averageLuminance: number; // 0 - 255
  luminancePercent: number; // 0% - 100%
  colorVariance: number;
  nonBlackPixelRatio: number; // 0 - 1
  isSolidColor: boolean;
  dominantColor: { r: number; g: number; b: number } | null;
  thresholdApplied: number;
}

export interface FreezeAnalysis {
  isFrozen: boolean;
  consecutiveUnchangedFrames: number;
  thresholdFrames: number;
  lastFrameHash: string | null;
}

// Diagnostics
export interface DiagnosticsState {
  status: EmulatorExecutionStatus;
  cpu: CpuState;
  ppu: PpuState;
  blackScreen: BlackScreenAnalysis;
  freeze: FreezeAnalysis;
  lastError: string | null;
}

// Memory read
export interface MemoryReadParams {
  address: number;
  length: number;
}

export interface MemoryReadResult {
  address: number;
  length: number;
  bytesHex: string;
  bytesArray: number[];
  asciiPreview: string;
}

// Test Runner Types
export type AssertionType =
  | 'not_black_screen'
  | 'not_frozen'
  | 'frames_advanced'
  | 'rom_loaded'
  | 'luminance_above'
  | 'custom';

export interface TestCheckpoint {
  checkpointId: string;
  name: string;
  frame: number;
  timestamp: number;
  screenshotDataUrl?: string;
  analysis: BlackScreenAnalysis;
  freeze: FreezeAnalysis;
  passed: boolean;
  failures: string[];
}

export interface TestStep {
  type: 'load_builtin_rom' | 'reset' | 'run_frames' | 'press_button' | 'release_button' | 'wait_ms' | 'checkpoint';
  params?: Record<string, unknown>;
  description?: string;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  targetCore: 'nes' | string;
  romName?: string;
  steps: TestStep[];
  assertions: {
    type: AssertionType;
    threshold?: number;
    expected?: unknown;
  }[];
}

export interface TestReport {
  suiteId: string;
  suiteName: string;
  timestamp: number;
  durationMs: number;
  overallPassed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  summary: string;
  targetCore: string;
  romTested: string | null;
  checkpoints: TestCheckpoint[];
  logs: string[];
}

// Event log entry for the Developer Panel
export interface BridgeLogEntry {
  id: string;
  timestamp: number;
  source: 'agent' | 'bridge' | 'runner' | 'emulator';
  type: 'info' | 'command' | 'response' | 'error' | 'test';
  message: string;
  details?: unknown;
  durationMs?: number;
}
