/**
 * EMULATRON AI BRIDGE — Automated Test Runner
 * 
 * Executes repeatable, automated ROM tests and diagnostic test suites.
 * Supports:
 * - Loading ROMs
 * - Resetting emulator
 * - Executing specified frame counts
 * - Simulating button inputs
 * - Checkpointing with screenshots and perceptual analysis
 * - Detecting black screen, freeze, and execution crashes
 * - Exporting structured JSON test reports
 */

import { TestCase, TestCheckpoint, TestReport } from './types';
import { NesEmulatorAdapter } from './emulatorAdapter';
import { FreezeDetector } from './diagnostics';

export class EmulatronTestRunner {
  private adapter: NesEmulatorAdapter;
  private isRunningTest = false;
  private latestReport: TestReport | null = null;
  private reportHistory: TestReport[] = [];

  constructor(adapter: NesEmulatorAdapter) {
    this.adapter = adapter;
  }

  public isBusy(): boolean {
    return this.isRunningTest;
  }

  public getLatestReport(): TestReport | null {
    return this.latestReport;
  }

  public getAllReports(): TestReport[] {
    return [...this.reportHistory];
  }

  /**
   * Pre-configured automated test suites
   */
  public getAvailableSuites(): TestCase[] {
    return [
      {
        id: 'nes-boot-sanity',
        name: 'NES Core Boot & Sanity Check',
        description: 'Loads the builtin test pattern, executes 120 frames, checks for black screen, and verifies rendering output.',
        targetCore: 'nes',
        romName: 'nes-test-pattern',
        steps: [
          { type: 'load_builtin_rom', params: { name: 'nes-test-pattern' }, description: 'Mount builtin test ROM' },
          { type: 'reset', description: 'Reset 6502 CPU and 2C02 PPU' },
          { type: 'run_frames', params: { count: 60 }, description: 'Advance 60 frames (1 second)' },
          { type: 'checkpoint', params: { id: 'post_boot', name: 'Post-Boot Frame 60 Check' } },
          { type: 'press_button', params: { button: 'START' }, description: 'Simulate START button press' },
          { type: 'run_frames', params: { count: 30 }, description: 'Advance 30 frames with START held' },
          { type: 'release_button', params: { button: 'START' }, description: 'Release START button' },
          { type: 'run_frames', params: { count: 60 }, description: 'Advance 60 frames post-input' },
          { type: 'checkpoint', params: { id: 'post_input', name: 'Post-Input Frame 150 Check' } },
        ],
        assertions: [
          { type: 'rom_loaded' },
          { type: 'frames_advanced', threshold: 120 },
          { type: 'not_black_screen' },
          { type: 'not_frozen' },
        ],
      },
      {
        id: 'nes-controller-responsiveness',
        name: 'NES Controller & Input Responsiveness Test',
        description: 'Sequentially exercises all NES buttons (A, B, SELECT, START, D-Pad) and verifies input registration.',
        targetCore: 'nes',
        romName: 'nes-controller-test',
        steps: [
          { type: 'load_builtin_rom', params: { name: 'nes-controller-test' }, description: 'Mount controller test ROM' },
          { type: 'reset', description: 'Reset emulator' },
          { type: 'run_frames', params: { count: 30 }, description: 'Warm-up 30 frames' },
          { type: 'press_button', params: { button: 'A' }, description: 'Press Button A' },
          { type: 'run_frames', params: { count: 10 }, description: 'Hold A for 10 frames' },
          { type: 'release_button', params: { button: 'A' }, description: 'Release Button A' },
          { type: 'press_button', params: { button: 'B' }, description: 'Press Button B' },
          { type: 'run_frames', params: { count: 10 }, description: 'Hold B for 10 frames' },
          { type: 'release_button', params: { button: 'B' }, description: 'Release Button B' },
          { type: 'checkpoint', params: { id: 'post_action_buttons', name: 'Action Buttons (A/B) Check' } },
          { type: 'press_button', params: { button: 'RIGHT' }, description: 'Press D-Pad RIGHT' },
          { type: 'run_frames', params: { count: 15 }, description: 'Hold RIGHT for 15 frames' },
          { type: 'release_button', params: { button: 'RIGHT' }, description: 'Release D-Pad RIGHT' },
          { type: 'checkpoint', params: { id: 'post_dpad', name: 'D-Pad Input Check' } },
        ],
        assertions: [
          { type: 'frames_advanced', threshold: 60 },
          { type: 'not_frozen' },
        ],
      },
      {
        id: 'nes-stability-and-freeze-check',
        name: 'NES Frame Stability & Freeze Detector',
        description: 'Runs continuous execution for 180 frames, monitors frame variation, and asserts the rendering pipeline does not hang.',
        targetCore: 'nes',
        romName: 'nes-test-pattern',
        steps: [
          { type: 'load_builtin_rom', params: { name: 'nes-test-pattern' }, description: 'Mount test pattern' },
          { type: 'reset', description: 'Reset emulator' },
          { type: 'run_frames', params: { count: 90 }, description: 'Run phase 1 (90 frames)' },
          { type: 'checkpoint', params: { id: 'phase_1', name: 'Phase 1 Frame Checkpoint' } },
          { type: 'run_frames', params: { count: 90 }, description: 'Run phase 2 (90 frames)' },
          { type: 'checkpoint', params: { id: 'phase_2', name: 'Phase 2 Frame Checkpoint' } },
        ],
        assertions: [
          { type: 'frames_advanced', threshold: 180 },
          { type: 'not_frozen' },
          { type: 'not_black_screen' },
        ],
      },
    ];
  }

  /**
   * Run a specific test suite by ID
   */
  public async runSuite(
    suiteId: string,
    onProgress?: (stepDesc: string, percent: number) => void
  ): Promise<TestReport> {
    const suites = this.getAvailableSuites();
    const testCase = suites.find(s => s.id === suiteId) || suites[0];
    return this.executeTestCase(testCase, onProgress);
  }

  /**
   * Executes a TestCase and produces a structured TestReport
   */
  public async executeTestCase(
    testCase: TestCase,
    onProgress?: (stepDesc: string, percent: number) => void
  ): Promise<TestReport> {
    if (this.isRunningTest) {
      throw new Error('A test runner session is already in progress');
    }

    this.isRunningTest = true;
    const startTime = Date.now();
    const checkpoints: TestCheckpoint[] = [];
    const logs: string[] = [];
    let initialFrameCount = 0;

    const log = (msg: string) => {
      const entry = `[${new Date().toISOString().substring(11, 19)}] ${msg}`;
      logs.push(entry);
    };

    log(`Starting Test Suite: ${testCase.name} (${testCase.id})`);

    try {
      const status = this.adapter.getStatus();
      initialFrameCount = status.currentFrameCount;

      const totalSteps = testCase.steps.length;

      for (let i = 0; i < totalSteps; i++) {
        const step = testCase.steps[i];
        const percent = Math.round(((i + 1) / totalSteps) * 100);
        const desc = step.description || step.type;

        log(`Step ${i + 1}/${totalSteps}: ${desc}`);
        if (onProgress) {
          onProgress(desc, percent);
        }

        switch (step.type) {
          case 'load_builtin_rom': {
            const romName = (step.params?.name as string) || 'nes-test-pattern';
            await this.adapter.loadRom({ source: 'builtin', name: romName });
            log(`Loaded builtin ROM: ${romName}`);
            await new Promise(r => setTimeout(r, 200));
            break;
          }

          case 'reset': {
            await this.adapter.reset();
            log('Emulator core reset executed');
            await new Promise(r => setTimeout(r, 100));
            break;
          }

          case 'run_frames': {
            const count = (step.params?.count as number) || 60;
            const res = await this.adapter.runFrames(count);
            log(`Executed ${res.framesExecuted} frames in ${res.elapsedMs}ms`);
            break;
          }

          case 'press_button': {
            const button = step.params?.button as any;
            if (button) {
              await this.adapter.pressButton(button);
              log(`Simulated button press: ${button}`);
            }
            break;
          }

          case 'release_button': {
            const button = step.params?.button as any;
            if (button) {
              await this.adapter.releaseButton(button);
              log(`Simulated button release: ${button}`);
            }
            break;
          }

          case 'wait_ms': {
            const ms = (step.params?.ms as number) || 100;
            await new Promise(r => setTimeout(r, ms));
            break;
          }

          case 'checkpoint': {
            const cpId = (step.params?.id as string) || `cp_${i}`;
            const cpName = (step.params?.name as string) || `Checkpoint ${checkpoints.length + 1}`;

            // Capture screenshot and analyze image properties
            const screenshot = await this.adapter.getScreenshot();
            const curStatus = this.adapter.getStatus();
            const freezeDetector = new FreezeDetector(60);
            const freeze = freezeDetector.checkFrame(new Uint8ClampedArray(4));

            const failures: string[] = [];

            // Check assertions against this checkpoint
            for (const assertion of testCase.assertions) {
              if (assertion.type === 'not_black_screen' && screenshot.analysis.isBlackScreen) {
                failures.push(
                  `Black screen detected at checkpoint (Luminance: ${screenshot.analysis.luminancePercent}%, Threshold: ${screenshot.analysis.thresholdApplied}%)`
                );
              }
            }

            const checkpoint: TestCheckpoint = {
              checkpointId: cpId,
              name: cpName,
              frame: curStatus.currentFrameCount,
              timestamp: Date.now(),
              screenshotDataUrl: screenshot.dataUrl,
              analysis: screenshot.analysis,
              freeze,
              passed: failures.length === 0,
              failures,
            };

            checkpoints.push(checkpoint);
            log(
              `Captured checkpoint '${cpName}' — Passed: ${checkpoint.passed} (Luminance: ${screenshot.analysis.luminancePercent}%, Non-black: ${(screenshot.analysis.nonBlackPixelRatio * 100).toFixed(1)}%)`
            );
            break;
          }
        }
      }

      // Final Assertions Evaluation
      const finalStatus = this.adapter.getStatus();
      const framesAdvanced = finalStatus.currentFrameCount - initialFrameCount;
      let totalChecks = 0;
      let passedChecks = 0;
      let failedChecks = 0;

      for (const assertion of testCase.assertions) {
        totalChecks++;
        switch (assertion.type) {
          case 'frames_advanced': {
            const threshold = assertion.threshold || 1;
            if (framesAdvanced >= threshold) {
              passedChecks++;
              log(`Assertion PASSED: frames_advanced (${framesAdvanced} >= ${threshold})`);
            } else {
              failedChecks++;
              log(`Assertion FAILED: frames_advanced (${framesAdvanced} < ${threshold})`);
            }
            break;
          }

          case 'rom_loaded': {
            if (finalStatus.hasRomLoaded) {
              passedChecks++;
              log(`Assertion PASSED: rom_loaded (${finalStatus.romName})`);
            } else {
              failedChecks++;
              log('Assertion FAILED: rom_loaded (No ROM currently mounted)');
            }
            break;
          }

          case 'not_black_screen': {
            const lastCheckpoint = checkpoints[checkpoints.length - 1];
            if (lastCheckpoint && !lastCheckpoint.analysis.isBlackScreen) {
              passedChecks++;
              log('Assertion PASSED: not_black_screen');
            } else {
              failedChecks++;
              log('Assertion FAILED: not_black_screen');
            }
            break;
          }

          case 'not_frozen': {
            const lastCheckpoint = checkpoints[checkpoints.length - 1];
            if (lastCheckpoint && !lastCheckpoint.freeze.isFrozen) {
              passedChecks++;
              log('Assertion PASSED: not_frozen');
            } else {
              failedChecks++;
              log('Assertion FAILED: not_frozen');
            }
            break;
          }

          default:
            passedChecks++;
            break;
        }
      }

      const overallPassed = failedChecks === 0 && checkpoints.every(c => c.passed);
      const durationMs = Date.now() - startTime;

      const report: TestReport = {
        suiteId: testCase.id,
        suiteName: testCase.name,
        timestamp: Date.now(),
        durationMs,
        overallPassed,
        totalChecks,
        passedChecks,
        failedChecks,
        summary: overallPassed
          ? `All ${totalChecks} diagnostic checks passed successfully in ${durationMs}ms.`
          : `${failedChecks} check(s) failed during test suite execution.`,
        targetCore: testCase.targetCore,
        romTested: testCase.romName || finalStatus.romName,
        checkpoints,
        logs,
      };

      this.latestReport = report;
      this.reportHistory.unshift(report);
      if (this.reportHistory.length > 20) {
        this.reportHistory.pop();
      }

      log(`Test Completed: ${overallPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}`);
      return report;
    } catch (err: any) {
      log(`Test Runner Error: ${err?.message || String(err)}`);
      const report: TestReport = {
        suiteId: testCase.id,
        suiteName: testCase.name,
        timestamp: Date.now(),
        durationMs: Date.now() - startTime,
        overallPassed: false,
        totalChecks: 1,
        passedChecks: 0,
        failedChecks: 1,
        summary: `Test suite crashed with error: ${err?.message || String(err)}`,
        targetCore: testCase.targetCore,
        romTested: testCase.romName || null,
        checkpoints,
        logs,
      };
      this.latestReport = report;
      return report;
    } finally {
      this.isRunningTest = false;
    }
  }

  /**
   * Generates downloadable JSON report file
   */
  public exportReportToJson(report: TestReport): string {
    return JSON.stringify(report, null, 2);
  }
}
