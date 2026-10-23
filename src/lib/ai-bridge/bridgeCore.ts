/**
 * EMULATRON AI BRIDGE — Core Protocol Engine & Security Dispatcher
 * 
 * Versioned protocol: 'emulatron-ai-bridge' v1.0
 * 
 * Handles:
 * - Command validation, routing, timeouts, and structured error responses
 * - Security origin checks and optional token-based authentication
 * - Transport multiplexing (direct window.__EMULATRON_AI_BRIDGE__, window.postMessage, BroadcastChannel)
 * - State management, logging, and inspection for the Developer Interface
 */

import {
  BRIDGE_PROTOCOL_NAME,
  BRIDGE_PROTOCOL_VERSION,
  BridgeCommandName,
  BridgeRequest,
  BridgeResponse,
  BridgeCapabilities,
  BridgeLogEntry,
  NesButton,
  MemoryReadParams,
} from './types';
import { NesEmulatorAdapter } from './emulatorAdapter';
import { EmulatronTestRunner } from './testRunner';
import { isPermittedRomSource, PERMITTED_BUILTIN_ROMS } from './testRoms';

declare global {
  interface Window {
    __EMULATRON_AI_BRIDGE__?: EmulatronAiBridge;
  }
}

export class EmulatronAiBridge {
  private static instance: EmulatronAiBridge | null = null;

  private adapter: NesEmulatorAdapter;
  private testRunner: EmulatronTestRunner;

  private enabled = true;
  private authToken: string = 'emulatron-bridge-key-' + Math.random().toString(36).substring(2, 10);
  private requireToken = false;
  private allowedOrigins: Set<string> = new Set(['*']);
  private logs: BridgeLogEntry[] = [];
  private logListeners: Set<(entry: BridgeLogEntry) => void> = new Set();
  private commandTimeoutMs = 12000;

  private broadcastChannel: BroadcastChannel | null = null;
  private postMessageListener: ((e: MessageEvent) => void) | null = null;

  public static getInstance(): EmulatronAiBridge {
    if (!EmulatronAiBridge.instance) {
      EmulatronAiBridge.instance = new EmulatronAiBridge();
    }
    return EmulatronAiBridge.instance;
  }

  private constructor() {
    this.adapter = new NesEmulatorAdapter();
    this.testRunner = new EmulatronTestRunner(this.adapter);

    this.initTransports();
    this.log('bridge', 'info', 'Emulatron AI Bridge v1.0 initialized');

    // Register on global window object for browser agent inspection
    if (typeof window !== 'undefined') {
      window.__EMULATRON_AI_BRIDGE__ = this;
    }
  }

  public getAdapter(): NesEmulatorAdapter {
    return this.adapter;
  }

  public getTestRunner(): EmulatronTestRunner {
    return this.testRunner;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.log('bridge', 'info', `AI Bridge ${enabled ? 'enabled' : 'disabled'}`);
  }

  public getAuthToken(): string {
    return this.authToken;
  }

  public regenerateAuthToken(): string {
    this.authToken = 'emulatron-bridge-key-' + Math.random().toString(36).substring(2, 10);
    this.log('bridge', 'info', 'Auth token regenerated');
    return this.authToken;
  }

  public setRequireToken(require: boolean): void {
    this.requireToken = require;
    this.log('bridge', 'info', `Token requirement set to ${require}`);
  }

  public isTokenRequired(): boolean {
    return this.requireToken;
  }

  public getLogs(): BridgeLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public subscribeLogs(listener: (entry: BridgeLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  private log(
    source: BridgeLogEntry['source'],
    type: BridgeLogEntry['type'],
    message: string,
    details?: unknown,
    durationMs?: number
  ): void {
    const entry: BridgeLogEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      source,
      type,
      message,
      details,
      durationMs,
    };

    this.logs.unshift(entry);
    if (this.logs.length > 250) {
      this.logs.pop();
    }

    this.logListeners.forEach(listener => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Log listener error:', err);
      }
    });
  }

  /**
   * Initializes browser-level communication transports (postMessage & BroadcastChannel)
   */
  private initTransports(): void {
    if (typeof window === 'undefined') return;

    // 1. window.postMessage Transport
    this.postMessageListener = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.protocol !== BRIDGE_PROTOCOL_NAME) return;

      // Validate allowed origin if specified
      if (!this.allowedOrigins.has('*') && !this.allowedOrigins.has(event.origin)) {
        this.log('bridge', 'error', `Rejected command from unauthorized origin: ${event.origin}`);
        return;
      }

      this.executeCommand(data as BridgeRequest).then(response => {
        // Reply via MessagePort if provided, otherwise window.postMessage
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(response);
        } else if (event.source && typeof (event.source as Window).postMessage === 'function') {
          (event.source as Window).postMessage(response, event.origin === 'null' ? '*' : event.origin);
        }
      });
    };

    window.addEventListener('message', this.postMessageListener);

    // 2. BroadcastChannel Transport (if supported)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel('emulatron-ai-bridge');
        this.broadcastChannel.onmessage = (event) => {
          const data = event.data;
          if (data && data.protocol === BRIDGE_PROTOCOL_NAME && data.command) {
            this.executeCommand(data as BridgeRequest).then(response => {
              this.broadcastChannel?.postMessage(response);
            });
          }
        };
      }
    } catch {
      // BroadcastChannel optional fallback
    }
  }

  /**
   * Core Command Dispatcher & Validator
   */
  public async executeCommand<T = unknown>(request: BridgeRequest<any>): Promise<BridgeResponse<T>> {
    const startTime = Date.now();
    const reqId = request?.id || `req_${Date.now()}`;
    const commandName = request?.command;

    this.log('agent', 'command', `Received command: ${commandName}`, request.params);

    // 1. Check if Bridge is Enabled
    if (!this.enabled) {
      const resp = this.createErrorResponse<T>(
        reqId,
        commandName,
        'BRIDGE_DISABLED',
        'Emulatron AI Bridge is currently disabled by developer configuration'
      );
      this.log('bridge', 'error', `Command blocked: Bridge is disabled`);
      return resp;
    }

    // 2. Validate Protocol and Command
    if (!request || request.protocol !== BRIDGE_PROTOCOL_NAME) {
      return this.createErrorResponse<T>(
        reqId,
        commandName || ('unknown' as any),
        'INVALID_COMMAND',
        `Invalid protocol. Expected '${BRIDGE_PROTOCOL_NAME}'`
      );
    }

    // 3. Security: Check Auth Token if required
    if (this.requireToken) {
      if (!request.token || request.token !== this.authToken) {
        this.log('bridge', 'error', `Unauthorized command execution attempt: ${commandName}`);
        return this.createErrorResponse<T>(
          reqId,
          commandName,
          'UNAUTHORIZED',
          'Invalid or missing authentication token'
        );
      }
    }

    // 4. Command Execution with Timeout Guarantee
    try {
      const result = await Promise.race([
        this.dispatchCommandInternal(commandName, request.params),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Command '${commandName}' timed out after ${this.commandTimeoutMs}ms`)),
            this.commandTimeoutMs
          )
        ),
      ]);

      const durationMs = Date.now() - startTime;
      const response: BridgeResponse<T> = {
        protocol: BRIDGE_PROTOCOL_NAME,
        version: BRIDGE_PROTOCOL_VERSION,
        id: reqId,
        command: commandName,
        success: true,
        result: result as T,
        durationMs,
        timestamp: Date.now(),
      };

      this.log('bridge', 'response', `Executed ${commandName} (${durationMs}ms)`, result, durationMs);
      return response;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout = err?.message?.includes('timed out');
      const errorCode = isTimeout ? 'TIMEOUT' : 'EXECUTION_ERROR';

      const response = this.createErrorResponse<T>(
        reqId,
        commandName,
        errorCode,
        err?.message || 'Command execution failed',
        err?.stack
      );
      response.durationMs = durationMs;

      this.log('bridge', 'error', `Failed ${commandName}: ${err?.message}`, err, durationMs);
      return response;
    }
  }

  /**
   * Internal router for all required commands
   */
  private async dispatchCommandInternal(command: BridgeCommandName, params?: any): Promise<unknown> {
    switch (command) {
      case 'get_capabilities':
        return this.getCapabilities();

      case 'get_status':
        return this.adapter.getStatus();

      case 'load_rom': {
        const source = params?.source || 'builtin';
        const name = params?.name;
        const validation = isPermittedRomSource(source, name || params?.url);
        if (!validation.permitted) {
          throw new Error(`Security policy blocked ROM loading: ${validation.reason}`);
        }
        await this.adapter.loadRom({ source, name, data: params?.data, url: params?.url });
        return { loaded: true, source, name };
      }

      case 'reset':
        await this.adapter.reset();
        return { reset: true, timestamp: Date.now() };

      case 'run_frames': {
        const count = typeof params?.count === 'number' ? params.count : 60;
        return this.adapter.runFrames(count);
      }

      case 'press_button': {
        const button = params?.button as NesButton;
        if (!button) throw new Error("Missing 'button' parameter");
        await this.adapter.pressButton(button);
        return { button, pressed: true };
      }

      case 'release_button': {
        const button = params?.button as NesButton;
        if (!button) throw new Error("Missing 'button' parameter");
        await this.adapter.releaseButton(button);
        return { button, released: true };
      }

      case 'release_all_buttons':
        await this.adapter.releaseAllButtons();
        return { allReleased: true };

      case 'get_screenshot':
        return this.adapter.getScreenshot();

      case 'get_cpu_state':
        return this.adapter.getCpuState();

      case 'get_ppu_state':
        return this.adapter.getPpuState();

      case 'read_memory': {
        const p = (params || {}) as MemoryReadParams;
        return this.adapter.readMemory(p.address || 0, p.length || 16);
      }

      case 'get_test_results':
        return {
          latestReport: this.testRunner.getLatestReport(),
          history: this.testRunner.getAllReports(),
          availableSuites: this.testRunner.getAvailableSuites().map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
          })),
        };

      case 'run_test_suite': {
        const suiteId = params?.suiteId || 'nes-boot-sanity';
        return this.testRunner.runSuite(suiteId);
      }

      default:
        throw new Error(`Unsupported command: '${command}'`);
    }
  }

  /**
   * Describes full protocol capabilities
   */
  public getCapabilities(): BridgeCapabilities {
    const status = this.adapter.getStatus();
    return {
      protocol: BRIDGE_PROTOCOL_NAME,
      version: BRIDGE_PROTOCOL_VERSION,
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
      supportedButtons: [
        'A',
        'B',
        'SELECT',
        'START',
        'UP',
        'DOWN',
        'LEFT',
        'RIGHT',
        'TURBO_A',
        'TURBO_B',
      ],
      supportedCores: ['nes', 'famicom', 'snes', 'gb', 'gbc', 'gba', 'segaMD', 'atari8bit'],
      activeCore: status.activeCore,
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
        commandTimeoutMs: this.commandTimeoutMs,
      },
    };
  }

  private createErrorResponse<T>(
    id: string,
    command: BridgeCommandName,
    code: BridgeResponse['error'] extends { code: infer C } ? C : never,
    message: string,
    details?: unknown
  ): BridgeResponse<T> {
    return {
      protocol: BRIDGE_PROTOCOL_NAME,
      version: BRIDGE_PROTOCOL_VERSION,
      id,
      command,
      success: false,
      error: {
        code,
        message,
        details,
      },
      timestamp: Date.now(),
    };
  }

  public destroy(): void {
    if (this.postMessageListener && typeof window !== 'undefined') {
      window.removeEventListener('message', this.postMessageListener);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
    }
  }
}
