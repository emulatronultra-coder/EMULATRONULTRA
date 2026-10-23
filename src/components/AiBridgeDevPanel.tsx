import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Tv,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Camera,
  Terminal,
  Shield,
  Copy,
  Download,
  AlertTriangle,
  Activity,
  Layers,
  Settings,
  X,
  RefreshCw,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { EmulatronAiBridge } from '../lib/ai-bridge/bridgeCore';
import {
  BridgeLogEntry,
  BridgeRequest,
  BridgeResponse,
  TestReport,
  ScreenshotResult,
  CpuState,
  PpuState,
  EmulatorExecutionStatus,
} from '../lib/ai-bridge/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiBridgeDevPanel({ isOpen, onClose }: Props) {
  const bridge = EmulatronAiBridge.getInstance();

  const [activeTab, setActiveTab] = useState<'status' | 'sandbox' | 'diagnostics' | 'tests' | 'logs'>('status');
  const [isEnabled, setIsEnabled] = useState<boolean>(bridge.isEnabled());
  const [requireToken, setRequireToken] = useState<boolean>(bridge.isTokenRequired());
  const [authToken, setAuthToken] = useState<string>(bridge.getAuthToken());
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Status & Diagnostics
  const [status, setStatus] = useState<EmulatorExecutionStatus>(bridge.getAdapter().getStatus());
  const [cpuState, setCpuState] = useState<CpuState | null>(null);
  const [ppuState, setPpuState] = useState<PpuState | null>(null);
  const [latestScreenshot, setLatestScreenshot] = useState<ScreenshotResult | null>(null);
  const [isRefreshingDiag, setIsRefreshingDiag] = useState<boolean>(false);

  // Sandbox Command Execution
  const [sandboxCommand, setSandboxCommand] = useState<string>('get_status');
  const [sandboxParams, setSandboxParams] = useState<string>('{}');
  const [sandboxResponse, setSandboxResponse] = useState<BridgeResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Automated Tests
  const [selectedSuite, setSelectedSuite] = useState<string>('nes-boot-sanity');
  const [isRunningSuite, setIsRunningSuite] = useState<boolean>(false);
  const [testProgressStep, setTestProgressStep] = useState<string>('');
  const [testProgressPercent, setTestProgressPercent] = useState<number>(0);
  const [testReport, setTestReport] = useState<TestReport | null>(bridge.getTestRunner().getLatestReport());

  // Logs
  const [logs, setLogs] = useState<BridgeLogEntry[]>(bridge.getLogs());

  // Subscribe to real-time logs and state updates
  useEffect(() => {
    const unsubscribe = bridge.subscribeLogs(() => {
      setLogs(bridge.getLogs());
    });

    const statusInterval = setInterval(() => {
      setStatus(bridge.getAdapter().getStatus());
    }, 1500);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [bridge]);

  if (!isOpen) return null;

  const handleToggleEnabled = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    bridge.setEnabled(next);
  };

  const handleToggleRequireToken = () => {
    const next = !requireToken;
    setRequireToken(next);
    bridge.setRequireToken(next);
  };

  const handleRegenerateToken = () => {
    const next = bridge.regenerateAuthToken();
    setAuthToken(next);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(authToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleRefreshDiagnostics = async () => {
    setIsRefreshingDiag(true);
    try {
      const [newStatus, newCpu, newPpu, newScreen] = await Promise.all([
        bridge.getAdapter().getStatus(),
        bridge.getAdapter().getCpuState(),
        bridge.getAdapter().getPpuState(),
        bridge.getAdapter().getScreenshot(),
      ]);
      setStatus(newStatus);
      setCpuState(newCpu);
      setPpuState(newPpu);
      setLatestScreenshot(newScreen);
    } catch (err) {
      console.warn('Diagnostics refresh warning:', err);
    } finally {
      setIsRefreshingDiag(false);
    }
  };

  const executeSandbox = async (overrideCmd?: string, overrideParams?: Record<string, unknown>) => {
    setIsExecuting(true);
    const cmd = overrideCmd || sandboxCommand;
    let paramsObj: Record<string, unknown> = {};
    if (overrideParams) {
      paramsObj = overrideParams;
    } else {
      try {
        paramsObj = JSON.parse(sandboxParams || '{}');
      } catch {
        paramsObj = {};
      }
    }

    try {
      const request: BridgeRequest = {
        protocol: 'emulatron-ai-bridge',
        version: '1.0',
        id: `sandbox_${Date.now()}`,
        command: cmd as any,
        params: paramsObj,
        token: requireToken ? authToken : undefined,
      };

      const response = await bridge.executeCommand(request);
      setSandboxResponse(response);

      if (cmd === 'get_screenshot' && response.result) {
        setLatestScreenshot(response.result as ScreenshotResult);
      }
    } catch (err: any) {
      setSandboxResponse({
        protocol: 'emulatron-ai-bridge',
        version: '1.0',
        id: `err_${Date.now()}`,
        command: cmd as any,
        success: false,
        error: { code: 'EXECUTION_ERROR', message: err?.message || String(err) },
        timestamp: Date.now(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunSuite = async () => {
    setIsRunningSuite(true);
    setTestProgressPercent(0);
    setTestProgressStep('Initializing automated test runner...');
    try {
      const report = await bridge.getTestRunner().runSuite(selectedSuite, (step, percent) => {
        setTestProgressStep(step);
        setTestProgressPercent(percent);
      });
      setTestReport(report);
    } catch (err) {
      console.error('Test run failed:', err);
    } finally {
      setIsRunningSuite(false);
    }
  };

  const handleDownloadTestReport = () => {
    if (!testReport) return;
    const jsonStr = bridge.getTestRunner().exportReportToJson(testReport);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emulatron-test-report-${testReport.suiteId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
      <div className="w-full max-w-5xl h-[92vh] bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
              <Cpu className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">EMULATRON AI BRIDGE</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                  v1.0 • NES Core
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                    isEnabled
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                  {isEnabled ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                External Agent Automation, Diagnostics, Black-Screen & Crash Detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-300 select-none">
              <span>Bridge Master Switch:</span>
              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isEnabled ? 'bg-sky-500' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Закрити панель"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/40 px-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'status'
                ? 'border-sky-500 text-sky-400 font-bold bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Статус & Безпека
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'sandbox'
                ? 'border-sky-500 text-sky-400 font-bold bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Консоль команд (Sandbox)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('diagnostics');
              handleRefreshDiagnostics();
            }}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-sky-500 text-sky-400 font-bold bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Діагностика & Black-Screen
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tests')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'tests'
                ? 'border-sky-500 text-sky-400 font-bold bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Автотести (Test Runner)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'logs'
                ? 'border-sky-500 text-sky-400 font-bold bg-neutral-900/60'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Журнал викликів ({logs.length})
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-neutral-950">
          {/* 1. Status & Auth Tab */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Core & Runtime Card */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      Ядро & Стан Виконання
                    </span>
                    <span className="text-xs font-mono text-sky-400">
                      {status.activeCore.toUpperCase()} (NES 2C02 / 6502)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800/80">
                      <div className="text-neutral-500 text-[10px]">КАДРІВ ВИКОНАНО</div>
                      <div className="text-base font-bold text-white mt-0.5">{status.currentFrameCount}</div>
                    </div>
                    <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800/80">
                      <div className="text-neutral-500 text-[10px]">ШВИДКІСТЬ (FPS)</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">~{status.estimatedFps} FPS</div>
                    </div>
                    <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800/80">
                      <div className="text-neutral-500 text-[10px]">АКТИВНИЙ ROM</div>
                      <div className="text-xs font-bold text-amber-300 mt-1 truncate">
                        {status.romName || 'No ROM (Idle)'}
                      </div>
                    </div>
                    <div className="bg-neutral-950/80 p-2.5 rounded-lg border border-neutral-800/80">
                      <div className="text-neutral-500 text-[10px]">РОЗДІЛЬНА ЗДАТНІСТЬ</div>
                      <div className="text-xs font-bold text-sky-300 mt-1">256 × 240 (NTSC 60Hz)</div>
                    </div>
                  </div>
                </div>

                {/* Security & Access Key Card */}
                <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      Ключ Автентифікації (Auth Token)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">Security Guard Active</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={authToken}
                        className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-300 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyToken}
                        className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-700"
                        title="Скопіювати токен"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedToken ? 'Скопійовано!' : 'Копіювати'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRegenerateToken}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-neutral-700"
                        title="Згенерувати новий ключ"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={requireToken}
                        onChange={handleToggleRequireToken}
                        className="rounded border-neutral-700 text-sky-500 focus:ring-0"
                      />
                      <span>Вимагати токен для всіх команд від зовнішніх AI агентів</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Protocol Spec & Integration Methods */}
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Способи підключення зовнішніх AI агентів (Transports)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg space-y-1">
                    <div className="font-bold text-sky-300 font-mono">1. Direct Browser API</div>
                    <p className="text-neutral-400 text-[11px]">
                      Агент у headless Chrome / Playwright / Puppeteer може викликати:
                    </p>
                    <code className="block p-1.5 bg-neutral-900 rounded font-mono text-[10px] text-amber-200 overflow-x-auto">
                      window.__EMULATRON_AI_BRIDGE__.executeCommand(&#123; command: 'get_status' &#125;)
                    </code>
                  </div>

                  <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg space-y-1">
                    <div className="font-bold text-emerald-300 font-mono">2. window.postMessage RPC</div>
                    <p className="text-neutral-400 text-[11px]">
                      Безпечний iframe/popup RPC протокол:
                    </p>
                    <code className="block p-1.5 bg-neutral-900 rounded font-mono text-[10px] text-amber-200 overflow-x-auto">
                      window.postMessage(&#123; protocol: 'emulatron-ai-bridge', version: '1.0', command: 'get_screenshot' &#125;, '*')
                    </code>
                  </div>

                  <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg space-y-1">
                    <div className="font-bold text-purple-300 font-mono">3. Local REST Proxy API</div>
                    <p className="text-neutral-400 text-[11px]">
                      HTTP Express ендпоінти для агентів на Python/Node:
                    </p>
                    <code className="block p-1.5 bg-neutral-900 rounded font-mono text-[10px] text-amber-200 overflow-x-auto">
                      POST /api/ai-bridge/command
                      GET /api/ai-bridge/status
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Sandbox Command Console Tab */}
          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              {/* Quick Actions Ribbon */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3">
                <div className="text-[11px] font-mono font-bold text-neutral-400 mb-2">
                  ШВИДКІ КОМАНДИ ДЛЯ АГЕНТА:
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => executeSandbox('get_capabilities')}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    get_capabilities
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('get_status')}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-emerald-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    get_status
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('get_screenshot')}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-purple-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    get_screenshot
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('run_frames', { count: 60 })}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    run_frames (60)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('press_button', { button: 'START' })}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-rose-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    press_button (START)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('release_all_buttons')}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    release_all_buttons
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('read_memory', { address: 0, length: 16 })}
                    className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-indigo-300 rounded border border-neutral-700 cursor-pointer"
                  >
                    read_memory ($0000)
                  </button>
                  <button
                    type="button"
                    onClick={() => executeSandbox('reset')}
                    className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded border border-rose-800 cursor-pointer"
                  >
                    reset
                  </button>
                </div>
              </div>

              {/* Command Builder & Output Panel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Input Payload */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400">КОМАНДА ТА ПАРАМЕТРИ</span>
                    <select
                      value={sandboxCommand}
                      onChange={(e) => setSandboxCommand(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-sky-400 outline-none"
                    >
                      <option value="get_status">get_status</option>
                      <option value="get_capabilities">get_capabilities</option>
                      <option value="get_screenshot">get_screenshot</option>
                      <option value="get_cpu_state">get_cpu_state</option>
                      <option value="get_ppu_state">get_ppu_state</option>
                      <option value="load_rom">load_rom</option>
                      <option value="reset">reset</option>
                      <option value="run_frames">run_frames</option>
                      <option value="press_button">press_button</option>
                      <option value="release_button">release_button</option>
                      <option value="release_all_buttons">release_all_buttons</option>
                      <option value="read_memory">read_memory</option>
                      <option value="get_test_results">get_test_results</option>
                    </select>
                  </div>

                  <div className="flex-1">
                    <label className="text-[11px] font-mono text-neutral-500 block mb-1">JSON Params:</label>
                    <textarea
                      value={sandboxParams}
                      onChange={(e) => setSandboxParams(e.target.value)}
                      rows={6}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-200 outline-none focus:border-sky-500/50 resize-none"
                      placeholder='{ "count": 60 }'
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => executeSandbox()}
                    disabled={isExecuting}
                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isExecuting ? 'Виконання команди...' : 'Виконати команду через Bridge'}
                  </button>
                </div>

                {/* Output Inspector */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400">ВІДПОВІДЬ (RESPONSE)</span>
                    {sandboxResponse && (
                      <span className="text-[11px] font-mono text-neutral-400">
                        {sandboxResponse.durationMs}ms •{' '}
                        <span className={sandboxResponse.success ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                          {sandboxResponse.success ? 'SUCCESS' : 'ERROR'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-3 overflow-y-auto max-h-[300px] font-mono text-xs text-neutral-300 custom-scrollbar">
                    {sandboxResponse ? (
                      <pre className="whitespace-pre-wrap">{JSON.stringify(sandboxResponse, null, 2)}</pre>
                    ) : (
                      <span className="text-neutral-600 italic">Натисніть "Виконати команду", щоб побачити відповідь.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Diagnostics & Black-Screen Detector Tab */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  Метрики рендерингу GTIA/PPU, детектор чорного екрану, зависання та стан регістрів.
                </div>
                <button
                  type="button"
                  onClick={handleRefreshDiagnostics}
                  disabled={isRefreshingDiag}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDiag ? 'animate-spin' : ''}`} />
                  Оновити кадр
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Live Frame Preview & Black Screen Detector */}
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neutral-400">ПОТОЧНИЙ КАДР РЕНДЕРИНГУ</span>
                    {latestScreenshot && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          latestScreenshot.analysis.isBlackScreen
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {latestScreenshot.analysis.isBlackScreen ? 'BLACK SCREEN DETECTED' : 'RENDERING ACTIVE'}
                      </span>
                    )}
                  </div>

                  {/* Screenshot Viewport */}
                  <div className="bg-black border border-neutral-800 rounded-lg overflow-hidden flex items-center justify-center min-h-[200px]">
                    {latestScreenshot?.dataUrl ? (
                      <img
                        src={latestScreenshot.dataUrl}
                        alt="NES Frame Capture"
                        className="max-h-[220px] object-contain pixelated"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    ) : (
                      <div className="text-neutral-600 text-xs font-mono text-center p-6">
                        Кадр ще не захоплено. Натисніть "Оновити кадр".
                      </div>
                    )}
                  </div>

                  {/* Quantitative Image Metrics */}
                  {latestScreenshot && (
                    <div className="space-y-2 pt-1 text-xs font-mono">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-neutral-400">Середня яскравість (Luminance):</span>
                        <span className="font-bold text-white">
                          {latestScreenshot.analysis.luminancePercent}% ({latestScreenshot.analysis.averageLuminance} / 255)
                        </span>
                      </div>
                      <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                        <div
                          className={`h-full ${
                            latestScreenshot.analysis.isBlackScreen ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(3, latestScreenshot.analysis.luminancePercent))}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                          <span className="text-neutral-500">Дисперсія кольору:</span>
                          <span className="font-bold text-neutral-300 ml-1">
                            {latestScreenshot.analysis.colorVariance}
                          </span>
                        </div>
                        <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                          <span className="text-neutral-500">Не-чорні пікселі:</span>
                          <span className="font-bold text-neutral-300 ml-1">
                            {(latestScreenshot.analysis.nonBlackPixelRatio * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CPU & PPU Diagnostics */}
                <div className="space-y-4">
                  {/* CPU State */}
                  <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-neutral-400">6502 CPU REGISTERS</span>
                      <span className="text-xs font-mono text-sky-400">PC: $C000</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs font-mono text-center">
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">A (Accum)</div>
                        <div className="text-white font-bold mt-0.5">
                          ${(cpuState?.registers.a ?? 0).toString(16).padStart(2, '0').toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">X Index</div>
                        <div className="text-white font-bold mt-0.5">
                          ${(cpuState?.registers.x ?? 0).toString(16).padStart(2, '0').toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">Y Index</div>
                        <div className="text-white font-bold mt-0.5">
                          ${(cpuState?.registers.y ?? 0).toString(16).padStart(2, '0').toUpperCase()}
                        </div>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">SP (Stack)</div>
                        <div className="text-white font-bold mt-0.5">
                          ${(cpuState?.registers.sp ?? 0xFD).toString(16).padStart(2, '0').toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PPU State */}
                  <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-neutral-400">2C02 PPU STATUS</span>
                      <span className="text-xs font-mono text-emerald-400">NTSC 60Hz</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">Scanline</div>
                        <div className="text-white font-bold mt-0.5">{ppuState?.scanline ?? 0} / 262</div>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">Dot Cycle</div>
                        <div className="text-white font-bold mt-0.5">{ppuState?.cycle ?? 0} / 341</div>
                      </div>
                      <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                        <div className="text-neutral-500 text-[10px]">PPUMASK</div>
                        <div className="text-emerald-400 font-bold mt-0.5">$1E (Show BG)</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Automated Tests Tab */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Автоматичні повторювані тести ROM (Test Runner)</h3>
                    <p className="text-xs text-neutral-400">
                      Запуск сценарію: завантаження ROM &rarr; скидання &rarr; виконання N кадрів &rarr; симуляція кнопок &rarr; чекпоінти зі знімками.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedSuite}
                      onChange={(e) => setSelectedSuite(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-sky-400 outline-none"
                    >
                      <option value="nes-boot-sanity">NES Core Boot & Sanity Check</option>
                      <option value="nes-controller-responsiveness">NES Controller & Input Test</option>
                      <option value="nes-stability-and-freeze-check">NES Frame Stability & Freeze Check</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleRunSuite}
                      disabled={isRunningSuite}
                      className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-black font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isRunningSuite ? 'Тестування...' : 'Запустити тест'}
                    </button>
                  </div>
                </div>

                {/* Progress bar during test run */}
                {isRunningSuite && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px] font-mono text-sky-400">
                      <span>{testProgressStep}</span>
                      <span>{testProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                      <div className="bg-sky-500 h-full transition-all duration-200" style={{ width: `${testProgressPercent}%` }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Latest Test Report */}
              {testReport && (
                <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                    <div className="flex items-center gap-3">
                      {testReport.overallPassed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-400" />
                      )}
                      <div>
                        <div className="text-sm font-bold text-white flex items-center gap-2">
                          <span>{testReport.suiteName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              testReport.overallPassed
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}
                          >
                            {testReport.overallPassed ? 'ALL PASSED' : 'FAILED CHECKS'}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5 font-mono">
                          {testReport.summary} • Тривалість: {testReport.durationMs}ms
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadTestReport}
                      className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      Експорт JSON звіту
                    </button>
                  </div>

                  {/* Checkpoints Timeline */}
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-bold text-neutral-400">ЧЕКПОІНТИ ТА ЗНІМКИ:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {testReport.checkpoints.map((cp, idx) => (
                        <div key={idx} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 space-y-2 text-xs">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-bold text-white">{cp.name}</span>
                            <span className={cp.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                              {cp.passed ? 'PASSED' : 'FAIL'}
                            </span>
                          </div>

                          {cp.screenshotDataUrl && (
                            <div className="bg-black rounded border border-neutral-800 overflow-hidden flex items-center justify-center h-28">
                              <img
                                src={cp.screenshotDataUrl}
                                alt={cp.name}
                                className="max-h-full object-contain"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            </div>
                          )}

                          <div className="text-[10px] font-mono text-neutral-400 space-y-0.5">
                            <div>Кадр: #{cp.frame}</div>
                            <div>
                              Яскравість: <b className="text-white">{cp.analysis.luminancePercent}%</b> (Чорний екран: {cp.analysis.isBlackScreen ? 'ТАК' : 'НІ'})
                            </div>
                            <div>Не-чорні пікселі: {(cp.analysis.nonBlackPixelRatio * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400">
                  Поточні події протоколу `emulatron-ai-bridge` ({logs.length} записів)
                </span>
                <button
                  type="button"
                  onClick={() => bridge.clearLogs()}
                  className="px-2.5 py-1 text-xs bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded border border-neutral-800 cursor-pointer"
                >
                  Очистити журнал
                </button>
              </div>

              <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 font-mono text-xs space-y-1.5 max-h-[500px] overflow-y-auto custom-scrollbar">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-neutral-900/40 border border-neutral-800/60 flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500 text-[10px]">
                            {new Date(log.timestamp).toISOString().substring(11, 23)}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              log.source === 'agent'
                                ? 'bg-sky-950 text-sky-300 border border-sky-800'
                                : log.source === 'bridge'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-purple-950 text-purple-300 border border-purple-800'
                            }`}
                          >
                            {log.source}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              log.type === 'error'
                                ? 'text-rose-400'
                                : log.type === 'command'
                                ? 'text-amber-300'
                                : 'text-neutral-200'
                            }`}
                          >
                            {log.message}
                          </span>
                        </div>
                        {log.details && (
                          <pre className="text-[10px] text-neutral-400 overflow-x-auto pt-1">
                            {JSON.stringify(log.details)}
                          </pre>
                        )}
                      </div>

                      {log.durationMs !== undefined && (
                        <span className="text-[10px] text-neutral-500 shrink-0 font-mono">
                          {log.durationMs}ms
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-neutral-600 italic text-center p-6">
                    Журнал викликів порожній.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
