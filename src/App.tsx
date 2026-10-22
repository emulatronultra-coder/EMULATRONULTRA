import React, { useState, useRef } from 'react';
import {
  SystemCore,
  EmulatorConfig,
  SUPPORTED_SYSTEMS,
  VmHardwareConfig,
  DEFAULT_VM_HARDWARE,
  DEFAULT_UBUNTU_VM_HARDWARE,
  VmTab,
  StageRefHandle,
  IbmPcBootOs,
  UbuntuVmConfig,
  DEFAULT_UBUNTU_26_CONFIG,
} from './types';
import { MonitorPlay, RotateCcw, Layers, Copy, Download, X } from 'lucide-react';
import { createMultiDiskBundle } from './lib/multiDisk';
import { exportVmCloneFile, importVmCloneFromFile } from './utils/cloneManager';

import SystemSelector from './components/SystemSelector';
import EmulatorStage from './components/EmulatorStage';
import WelcomeScreen from './components/WelcomeScreen';
import IbmPcEmulatorStage from './components/IbmPcEmulatorStage';
import Atari8BitEmulatorStage from './components/Atari8BitEmulatorStage';
import AtariStEmulatorStage from './components/AtariStEmulatorStage';
import UbuntuLinuxStage from './components/UbuntuLinuxStage';
import TabBar from './components/TabBar';

const defaultSession = (core: SystemCore): { config: EmulatorConfig; isPlaying: boolean; isProcessing: boolean; error: string | null } => ({
  config: {
    core,
    romFile: null,
    romFiles: [],
    romUrl: null,
    gameName: '',
    isMultiDisk: false,
    osFile: null,
    zipFile: null,
    bootOs: core === 'ubuntulinux' ? 'ubuntu' : 'msdos',
    hardwareConfig: core === 'ubuntulinux' ? DEFAULT_UBUNTU_VM_HARDWARE : DEFAULT_VM_HARDWARE,
    ubuntuConfig: core === 'ubuntulinux' ? { ...DEFAULT_UBUNTU_26_CONFIG } : undefined,
  },
  isPlaying: false,
  isProcessing: false,
  error: null,
});

function isKickstartFile(file: File): boolean {
  const name = file.name.toLowerCase();
  if (name.includes('kick') || name.includes('kickstart') || name.endsWith('.a500') || name.endsWith('.a1200') || name.endsWith('.a600') || name.endsWith('.a4000')) {
    return true;
  }
  if (name.endsWith('.rom') || name.endsWith('.bin') || name.endsWith('.kick')) {
    if (file.size === 262144 || file.size === 524288 || file.size === 1048576 || name.includes('amiga') || name.includes('os')) {
      return true;
    }
  }
  return false;
}

function isSystemBiosFile(file: File, core: SystemCore): boolean {
  const name = file.name.toLowerCase();
  if (core === 'amiga') {
    return isKickstartFile(file);
  }
  if (core === 'atari5200') {
    return name.includes('5200') && (name.endsWith('.rom') || name.endsWith('.bin') || name.endsWith('.bios'));
  }
  if (core === 'atari7800') {
    return name.includes('7800') && (name.endsWith('.rom') || name.endsWith('.bin') || name.endsWith('.bios'));
  }
  if (core === 'atariJaguar') {
    return (name.includes('jagboot') || name.includes('jagcd')) && (name.endsWith('.rom') || name.endsWith('.bin'));
  }
  if (core === 'atariLynx') {
    return (name.includes('lynxboot') || name.includes('lynx')) && (name.endsWith('.img') || name.endsWith('.rom') || name.endsWith('.bin') || name.endsWith('.bios'));
  }
  if (core === 'atarist') {
    return (name.includes('tos') || name.includes('emutos')) && (name.endsWith('.img') || name.endsWith('.rom') || name.endsWith('.bin'));
  }
  if (core === 'atari8bit') {
    return (name.includes('atarixl') || name.includes('ataribas') || name.includes('atarios') || name.includes('ataria') || name.includes('a800')) && (name.endsWith('.rom') || name.endsWith('.bin') || name.endsWith('.zip'));
  }
  if (core === 'mame') {
    return (name.includes('neogeo') || name.includes('qsound') || name.includes('pgm') || name.includes('decocass') || name.includes('bios')) && name.endsWith('.zip');
  }
  return false;
}

export default function App() {
  const [tabs, setTabs] = useState<VmTab[]>([
    {
      id: 'tab-1',
      title: 'IBM PC #1',
      core: 'ibmpc',
      config: defaultSession('ibmpc').config,
      isPlaying: false,
      isProcessing: false,
      error: null,
      createdAt: Date.now(),
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  const stageRefs = useRef<Record<string, StageRefHandle | null>>({});

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const updateActiveTab = (updater: (prev: VmTab) => VmTab) => {
    setTabs(prevTabs =>
      prevTabs.map(t => (t.id === activeTabId ? updater(t) : t))
    );
  };

  const handleSelectTab = (id: string) => {
    setActiveTabId(id);
  };

  const handleAddTab = (core?: SystemCore) => {
    const targetCore = core || activeTab?.core || 'ibmpc';
    const newTabId = `tab-${Date.now()}`;
    const sysInfo = SUPPORTED_SYSTEMS.find(s => s.id === targetCore);
    const count = tabs.filter(t => t.core === targetCore).length + 1;
    const title = `${sysInfo?.name || 'Machine'} #${count}`;

    const newTab: VmTab = {
      id: newTabId,
      title,
      core: targetCore,
      config: defaultSession(targetCore).config,
      isPlaying: false,
      isProcessing: false,
      error: null,
      createdAt: Date.now(),
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const handleCloseTab = (id: string) => {
    const tabToClose = tabs.find(t => t.id === id);
    if (!tabToClose) return;

    if (tabToClose.config.romUrl) URL.revokeObjectURL(tabToClose.config.romUrl);
    if (tabToClose.config.biosUrl) URL.revokeObjectURL(tabToClose.config.biosUrl);

    delete stageRefs.current[id];

    if (tabs.length === 1) {
      // If closing the last tab, reset to a fresh default machine
      const freshTabId = `tab-${Date.now()}`;
      const freshTab: VmTab = {
        id: freshTabId,
        title: 'IBM PC #1',
        core: 'ibmpc',
        config: defaultSession('ibmpc').config,
        isPlaying: false,
        isProcessing: false,
        error: null,
        createdAt: Date.now(),
      };
      setTabs([freshTab]);
      setActiveTabId(freshTabId);
      return;
    }

    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);

    if (activeTabId === id) {
      const closedIndex = tabs.findIndex(t => t.id === id);
      const nextIndex = Math.max(0, closedIndex - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }
  };

  const handleRenameTab = (id: string, newTitle: string) => {
    setTabs(prev => prev.map(t => (t.id === id ? { ...t, title: newTitle } : t)));
  };

  const handleSystemSelect = (core: SystemCore) => {
    if (activeTab.isPlaying) {
      // If active tab is running, open new tab for the selected system
      handleAddTab(core);
    } else {
      // Update active tab core
      updateActiveTab(prev => ({
        ...prev,
        core,
        title: `${SUPPORTED_SYSTEMS.find(s => s.id === core)?.name || 'Machine'}`,
        config: defaultSession(core).config,
        error: null,
      }));
    }
  };

  const handleCloneTab = async (sourceTabId?: string, explicitStateBuffer?: ArrayBuffer | null) => {
    const targetId = sourceTabId || activeTabId;
    const sourceTab = tabs.find(t => t.id === targetId);
    if (!sourceTab) return;

    let liveBuffer = explicitStateBuffer;
    if (liveBuffer === undefined && sourceTab.isPlaying) {
      const ref = stageRefs.current[targetId];
      if (ref?.getStateSnapshot) {
        try {
          liveBuffer = await ref.getStateSnapshot();
        } catch (e) {
          console.warn('Could not query live state snapshot:', e);
        }
      }
    }

    const newTabId = `tab-${Date.now()}`;
    const clonedConfig: EmulatorConfig = {
      ...sourceTab.config,
      initialState: liveBuffer !== undefined ? liveBuffer : sourceTab.config.initialState,
    };

    const newTab: VmTab = {
      id: newTabId,
      title: `${sourceTab.config.gameName || sourceTab.title} (Клон)`,
      core: sourceTab.core,
      config: clonedConfig,
      isPlaying: true, // Boot cloned VM immediately!
      isProcessing: false,
      error: null,
      createdAt: Date.now(),
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
  };

  const handleExportActiveTab = async (explicitStateBuffer?: ArrayBuffer | null) => {
    const currentTab = activeTab;
    if (!currentTab) return;

    let liveBuffer = explicitStateBuffer;
    if (liveBuffer === undefined && currentTab.isPlaying) {
      const ref = stageRefs.current[currentTab.id];
      if (ref?.getStateSnapshot) {
        try {
          liveBuffer = await ref.getStateSnapshot();
        } catch (e) {
          console.warn('Could not query state for export:', e);
        }
      }
    }

    try {
      await exportVmCloneFile(currentTab.config, currentTab.title, liveBuffer);
    } catch (err: any) {
      alert(`Помилка експорту клону: ${err?.message || err}`);
    }
  };

  const handleImportCloneFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importVmCloneFromFile(file);
      const newTabId = `tab-${Date.now()}`;

      const newTab: VmTab = {
        id: newTabId,
        title: imported.title,
        core: imported.core,
        config: imported.config,
        isPlaying: true, // Auto-boot imported clone!
        isProcessing: false,
        error: null,
        createdAt: Date.now(),
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTabId);
    } catch (err: any) {
      alert(`Помилка завантаження клону з файлу: ${err?.message || err}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (rawFiles.length === 0) return;

    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }

    if (activeTab.core === 'ibmpc') {
      const file = rawFiles[0];
      const gameName = file.name.replace(/\.[^/.]+$/, "");
      updateActiveTab(prev => ({
        ...prev,
        title: gameName || prev.title,
        config: { ...prev.config, osFile: file, gameName },
        error: null
      }));
      return;
    }

    if (activeTab.core === 'ubuntulinux') {
      const file = rawFiles[0];
      const gameName = file.name.replace(/\.[^/.]+$/, "");
      updateActiveTab(prev => ({
        ...prev,
        title: `Ubuntu VM: ${file.name}`,
        config: {
          ...prev.config,
          osFile: file,
          romFile: file,
          ubuntuConfig: {
            ...(prev.config.ubuntuConfig || DEFAULT_UBUNTU_26_CONFIG),
            bootSource: 'custom_iso',
            isoFile: file,
            isoName: file.name,
            isoSize: file.size,
          },
          gameName,
        },
        error: null,
      }));
      return;
    }

    let files = rawFiles;
    let detectedBiosFile: File | null = null;
    const bios = rawFiles.find(f => isSystemBiosFile(f, activeTab.core));
    if (bios) {
      detectedBiosFile = bios;
      files = rawFiles.filter(f => f !== bios);
      if (activeTab.config.biosUrl) {
        URL.revokeObjectURL(activeTab.config.biosUrl);
      }
    }

    if (files.length === 0 && detectedBiosFile) {
      const biosUrl = URL.createObjectURL(detectedBiosFile);
      updateActiveTab(prev => ({
        ...prev,
        config: {
          ...prev.config,
          biosFile: detectedBiosFile,
          biosBlob: detectedBiosFile,
          biosUrl,
        },
        error: null
      }));
      return;
    }

    updateActiveTab(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const bundle = await createMultiDiskBundle(files, undefined, activeTab.core === 'mame');
      updateActiveTab(prev => {
        const newBiosFile = detectedBiosFile || prev.config.biosFile;
        const newBiosUrl = detectedBiosFile ? URL.createObjectURL(detectedBiosFile) : prev.config.biosUrl;
        return {
          ...prev,
          title: bundle.gameName || prev.title,
          isProcessing: false,
          config: {
            ...prev.config,
            romFile: files[0],
            romFiles: files,
            romBlob: bundle.blob,
            romUrl: bundle.blobUrl,
            gameName: bundle.gameName,
            isMultiDisk: bundle.isMultiDisk,
            disks: bundle.disks,
            m3uContent: bundle.m3uContent,
            m3uFileName: bundle.m3uFileName,
            singleRomName: bundle.singleRomName,
            biosFile: newBiosFile,
            biosBlob: newBiosFile,
            biosUrl: newBiosUrl,
          },
          error: null
        };
      });
    } catch (err: any) {
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        error: `Помилка обробки файлів: ${err?.message || err}`
      }));
    }
  };

  const handleAddDiskFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (newFiles.length === 0) return;

    let detectedBiosFile: File | null = null;
    let diskFiles = newFiles;

    const bios = newFiles.find(f => isSystemBiosFile(f, activeTab.core));
    if (bios) {
      detectedBiosFile = bios;
      diskFiles = newFiles.filter(f => f !== bios);
    }

    const existing = activeTab.config.romFiles?.length
      ? activeTab.config.romFiles
      : activeTab.config.romFile
      ? [activeTab.config.romFile]
      : [];
    const merged = [...existing, ...diskFiles];

    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }

    if (merged.length === 0 && detectedBiosFile) {
      const biosUrl = URL.createObjectURL(detectedBiosFile);
      updateActiveTab(prev => ({
        ...prev,
        title: activeTab.core === 'mame' ? detectedBiosFile.name : prev.title,
        config: {
          ...prev.config,
          biosFile: detectedBiosFile,
          biosBlob: detectedBiosFile,
          biosUrl,
          romFile: activeTab.core === 'mame' ? detectedBiosFile : prev.config.romFile,
          romBlob: activeTab.core === 'mame' ? detectedBiosFile : prev.config.romBlob,
          romUrl: activeTab.core === 'mame' ? biosUrl : prev.config.romUrl,
          gameName: activeTab.core === 'mame' ? detectedBiosFile.name : prev.config.gameName,
        },
        error: null
      }));
      return;
    }

    updateActiveTab(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const bundle = await createMultiDiskBundle(merged);
      updateActiveTab(prev => {
        const newBiosFile = detectedBiosFile || prev.config.biosFile;
        const newBiosUrl = detectedBiosFile ? URL.createObjectURL(detectedBiosFile) : prev.config.biosUrl;
        return {
          ...prev,
          title: bundle.gameName || prev.title,
          isProcessing: false,
          config: {
            ...prev.config,
            romFile: merged[0],
            romFiles: merged,
            romBlob: bundle.blob,
            romUrl: bundle.blobUrl,
            gameName: bundle.gameName,
            isMultiDisk: bundle.isMultiDisk,
            disks: bundle.disks,
            m3uContent: bundle.m3uContent,
            m3uFileName: bundle.m3uFileName,
            singleRomName: bundle.singleRomName,
            biosFile: newBiosFile,
            biosBlob: newBiosFile,
            biosUrl: newBiosUrl,
          },
          error: null
        };
      });
    } catch (err: any) {
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        error: `Помилка додавання диска: ${err?.message || err}`
      }));
    }
  };

  const handleRemoveDisk = async (index: number) => {
    const existing = activeTab.config.romFiles?.length
      ? activeTab.config.romFiles
      : activeTab.config.romFile
      ? [activeTab.config.romFile]
      : [];
    const updated = existing.filter((_, i) => i !== index);

    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }

    if (updated.length === 0) {
      updateActiveTab(prev => ({
        ...prev,
        config: {
          ...prev.config,
          romFile: null,
          romFiles: [],
          romBlob: null,
          romUrl: null,
          gameName: '',
          isMultiDisk: false,
        },
        error: null
      }));
      return;
    }

    updateActiveTab(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const bundle = await createMultiDiskBundle(updated);
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        config: {
          ...prev.config,
          romFile: updated[0],
          romFiles: updated,
          romBlob: bundle.blob,
          romUrl: bundle.blobUrl,
          gameName: bundle.gameName,
          isMultiDisk: bundle.isMultiDisk,
        },
        error: null
      }));
    } catch (err: any) {
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        error: `Помилка оновлення дисків: ${err?.message || err}`
      }));
    }
  };

  const handleReorderDisks = async (fromIndex: number, toIndex: number) => {
    const existing = activeTab.config.romFiles?.length
      ? activeTab.config.romFiles
      : activeTab.config.romFile
      ? [activeTab.config.romFile]
      : [];
    if (toIndex < 0 || toIndex >= existing.length) return;

    const updated = [...existing];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }

    updateActiveTab(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const bundle = await createMultiDiskBundle(updated);
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        config: {
          ...prev.config,
          romFile: updated[0],
          romFiles: updated,
          romBlob: bundle.blob,
          romUrl: bundle.blobUrl,
          gameName: bundle.gameName,
          isMultiDisk: bundle.isMultiDisk,
        },
        error: null
      }));
    } catch (err: any) {
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        error: `Помилка перестановки дисків: ${err?.message || err}`
      }));
    }
  };

  const handleClearDisks = () => {
    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }
    updateActiveTab(prev => ({
      ...prev,
      config: {
        ...prev.config,
        romFile: null,
        romFiles: [],
        romBlob: null,
        romUrl: null,
        gameName: '',
        isMultiDisk: false,
      },
      error: null
    }));
  };

  const handleZipUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    updateActiveTab(prev => ({
      ...prev,
      config: { ...prev.config, zipFile: file },
      error: null
    }));
  };

  const handleBiosUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (activeTab.config.biosUrl) {
      URL.revokeObjectURL(activeTab.config.biosUrl);
    }

    const url = URL.createObjectURL(file);
    updateActiveTab(prev => {
      const isMame = prev.core === 'mame';
      const noRomYet = !prev.config.romFile && !prev.config.romUrl;
      return {
        ...prev,
        title: (isMame && noRomYet) ? file.name : prev.title,
        config: {
          ...prev.config,
          biosFile: file,
          biosBlob: file,
          biosUrl: url,
          romFile: (isMame && noRomYet) ? file : prev.config.romFile,
          romBlob: (isMame && noRomYet) ? file : prev.config.romBlob,
          romUrl: (isMame && noRomYet) ? url : prev.config.romUrl,
          gameName: (isMame && noRomYet) ? file.name : prev.config.gameName,
        },
        error: null
      };
    });
  };

  const handleRemoveBios = () => {
    if (activeTab.config.biosUrl) {
      URL.revokeObjectURL(activeTab.config.biosUrl);
    }
    updateActiveTab(prev => {
      const isMame = prev.core === 'mame';
      const isBiosAsRom = isMame && prev.config.romFile === prev.config.biosFile;
      return {
        ...prev,
        config: {
          ...prev.config,
          biosFile: null,
          biosBlob: null,
          biosUrl: null,
          romFile: isBiosAsRom ? null : prev.config.romFile,
          romBlob: isBiosAsRom ? null : prev.config.romBlob,
          romUrl: isBiosAsRom ? null : prev.config.romUrl,
          gameName: isBiosAsRom ? '' : prev.config.gameName,
        },
      };
    });
  };

  const handleLoadPresetFile = async (file: File) => {
    if (activeTab.config.romUrl) {
      URL.revokeObjectURL(activeTab.config.romUrl);
    }
    updateActiveTab(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const bundle = await createMultiDiskBundle([file]);
      updateActiveTab(prev => ({
        ...prev,
        title: bundle.gameName || prev.title,
        isProcessing: false,
        config: {
          ...prev.config,
          romFile: file,
          romFiles: [file],
          romBlob: bundle.blob,
          romUrl: bundle.blobUrl,
          gameName: bundle.gameName,
          isMultiDisk: false,
          disks: bundle.disks,
          singleRomName: bundle.singleRomName,
        },
        error: null,
      }));
    } catch (err: any) {
      updateActiveTab(prev => ({
        ...prev,
        isProcessing: false,
        error: `Помилка завантаження демо: ${err?.message || err}`,
      }));
    }
  };

  const handleSwitchToAtari8Bit = () => {
    updateActiveTab(prev => ({
      ...prev,
      core: 'atari8bit',
      title: prev.config.gameName || 'Atari 8-Bit Machine',
      error: null,
    }));
  };

  const handleToggleCustomBoot = (custom: boolean) => {
    updateActiveTab(prev => ({
      ...prev,
      config: { ...prev.config, customBoot: custom, bootOs: custom ? 'custom' : (prev.config.bootOs === 'custom' ? 'msdos' : prev.config.bootOs || 'msdos') },
      error: null
    }));
  };

  const handleSelectBootOs = (bootOs: IbmPcBootOs) => {
    updateActiveTab(prev => ({
      ...prev,
      config: {
        ...prev.config,
        bootOs,
        customBoot: bootOs === 'custom',
      },
      error: null
    }));
  };

  const handleHardwareChange = (updated: VmHardwareConfig) => {
    updateActiveTab(prev => ({
      ...prev,
      config: { ...prev.config, hardwareConfig: updated },
    }));
  };

  const handleUbuntuConfigChange = (updated: UbuntuVmConfig) => {
    updateActiveTab(prev => ({
      ...prev,
      config: { ...prev.config, ubuntuConfig: updated },
    }));
  };

  const handlePlay = () => {
    const isMameBiosOnly = activeTab.core === 'mame' && (activeTab.config.biosFile || activeTab.config.biosUrl);
    if (
      !activeTab.config.romUrl &&
      activeTab.core !== 'ibmpc' &&
      activeTab.core !== 'ubuntulinux' &&
      !isMameBiosOnly
    ) {
      updateActiveTab(prev => ({ ...prev, error: 'Будь ласка, завантажте файл ROM або диск.' }));
      return;
    }
    if (activeTab.core === 'ibmpc' && activeTab.config.customBoot && !activeTab.config.osFile) {
      updateActiveTab(prev => ({ ...prev, error: 'Будь ласка, завантажте завантажувальний образ ОС.' }));
      return;
    }
    updateActiveTab(prev => ({ ...prev, isPlaying: true, error: null }));
  };

  const handleStop = () => {
    if (window.confirm('Ви впевнені, що хочете зупинити емулятор? Незбережений прогрес буде втрачено.')) {
      if (activeTab.config.romUrl) {
        URL.revokeObjectURL(activeTab.config.romUrl);
      }
      updateActiveTab(prev => ({
        ...prev,
        isPlaying: false,
        config: { ...prev.config, romFile: null, romUrl: null, osFile: null, zipFile: null, initialState: null },
      }));
    }
  };

  const playingCores = tabs.filter(t => t.isPlaying).map(t => t.core);

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans selection:bg-sky-500/30 overflow-hidden flex flex-col">
      {/* Top Browser-like Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onAddTab={() => handleAddTab()}
        onCloneActiveTab={() => handleCloneTab()}
        onExportActiveTab={() => handleExportActiveTab()}
        onImportCloneFile={handleImportCloneFile}
        onRenameTab={handleRenameTab}
      />

      {/* Main Workspace split into Sidebar + Emulator Stage */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Left Column */}
        <div className="w-80 bg-neutral-950 border-r border-neutral-900 flex flex-col z-20 shrink-0">
          <div className="p-5 border-b border-neutral-900 bg-neutral-950/50 sticky top-0 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
                <MonitorPlay className="w-5 h-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">WebEmu</h1>
                <div className="text-xs font-medium text-sky-500">Multi-VM Workstation</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <SystemSelector
              selected={activeTab.core}
              onSelect={handleSystemSelect}
              playingCores={playingCores}
              onNewTabForCore={(core) => handleAddTab(core)}
            />
          </div>

          {/* Status Footer */}
          <div className="p-4 border-t border-neutral-900 bg-neutral-950/80 text-[11px] text-neutral-500 flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Вкладок відкрито: <b className="text-neutral-300 font-mono">{tabs.length}</b></span>
            </div>
            <div>v2.5.0</div>
          </div>
        </div>

        {/* Main Content Area: Render all open tabs, toggling visibility so active VMs remain live in DOM */}
        <div className="flex-1 flex flex-col relative min-w-0 bg-neutral-950 overflow-hidden">
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                className={`w-full h-full flex-col flex-1 min-w-0 ${isActive ? 'flex' : 'hidden'}`}
              >
                {tab.isPlaying ? (
                  <div className="flex-1 w-full h-full p-6 flex flex-col relative z-10">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between mb-4 px-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-white truncate max-w-lg">
                            {tab.config.gameName || tab.title}
                          </h2>
                          {tab.config.isMultiDisk && (
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5" />
                              {tab.config.romFiles?.length || 2} диски (M3U)
                            </span>
                          )}
                          {tab.config.initialState && (
                            <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                              ⚡ Клонована машина
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-emerald-400 font-medium flex items-center gap-2 mt-0.5">
                          <span>Running • {SUPPORTED_SYSTEMS.find(s => s.id === tab.core)?.name}</span>
                          {tab.config.isMultiDisk && (
                            <span className="text-xs text-neutral-400 font-normal hidden sm:inline">
                              • Зміна дисків через меню емулятора (Disc Control)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Clone Button */}
                        <button
                          type="button"
                          onClick={() => handleCloneTab(tab.id)}
                          className="px-3 py-2 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-sky-500/30 cursor-pointer"
                          title="Клонувати цю машина у нову вкладку"
                        >
                          <Copy className="w-3.5 h-3.5 text-sky-400" />
                          <span>Клонувати</span>
                        </button>

                        {/* Export Button */}
                        <button
                          type="button"
                          onClick={() => handleExportActiveTab()}
                          className="px-3 py-2 bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-neutral-800 cursor-pointer"
                          title="Зберегти клон у файл (.vmclone)"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span>В файл</span>
                        </button>

                        {/* Stop Button */}
                        <button 
                          type="button"
                          onClick={handleStop}
                          className="px-3.5 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-amber-500/20 hover:border-amber-500 cursor-pointer"
                          title="Скинути стан машини"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </button>

                        {/* Close Emulator Tab Button */}
                        <button
                          type="button"
                          onClick={() => handleCloseTab(tab.id)}
                          className="px-3 py-2 bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-red-500/30 cursor-pointer"
                          title="Закрити цю вкладку з емулятором"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Закрити</span>
                        </button>
                      </div>
                    </div>
                    
                    {/* Emulator Stage Container */}
                    <div className="flex-1 w-full relative bg-black rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl ring-1 ring-white/5">
                      {tab.core === 'ubuntulinux' ? (
                        <UbuntuLinuxStage
                          ref={(el) => { stageRefs.current[tab.id] = el; }}
                          config={tab.config}
                          onCloneMachine={(stateBuf) => handleCloneTab(tab.id, stateBuf)}
                          onExportCloneFile={(stateBuf) => handleExportActiveTab(stateBuf)}
                        />
                      ) : tab.core === 'ibmpc' ? (
                        <IbmPcEmulatorStage
                          ref={(el) => { stageRefs.current[tab.id] = el; }}
                          osFile={tab.config.osFile || null}
                          zipFile={tab.config.zipFile || null}
                          customBoot={tab.config.customBoot || false}
                          bootOs={tab.config.bootOs || 'msdos'}
                          hardwareConfig={tab.config.hardwareConfig}
                          initialState={tab.config.initialState || null}
                          onHardwareChange={handleHardwareChange}
                          onCloneMachine={(stateBuf) => handleCloneTab(tab.id, stateBuf)}
                          onExportCloneFile={(stateBuf) => handleExportActiveTab(stateBuf)}
                        />
                      ) : tab.core === 'atari8bit' ? (
                        <Atari8BitEmulatorStage
                          ref={(el) => { stageRefs.current[tab.id] = el; }}
                          config={tab.config}
                        />
                      ) : tab.core === 'atarist' ? (
                        <AtariStEmulatorStage
                          ref={(el) => { stageRefs.current[tab.id] = el; }}
                          config={tab.config}
                        />
                      ) : (
                        <EmulatorStage
                          ref={(el) => { stageRefs.current[tab.id] = el; }}
                          config={tab.config}
                          onSwitchToAtari={handleSwitchToAtari8Bit}
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 w-full h-full p-8 flex items-center justify-center relative z-10 overflow-y-auto custom-scrollbar">
                    <WelcomeScreen 
                      config={tab.config}
                      onFileUpload={handleFileUpload}
                      onAddDiskFiles={handleAddDiskFiles}
                      onRemoveDisk={handleRemoveDisk}
                      onReorderDisks={handleReorderDisks}
                      onClearDisks={handleClearDisks}
                      onZipUpload={handleZipUpload}
                      onBiosUpload={handleBiosUpload}
                      onRemoveBios={handleRemoveBios}
                      onToggleCustomBoot={handleToggleCustomBoot}
                      onChangeBootOs={handleSelectBootOs}
                      onHardwareChange={handleHardwareChange}
                      onUbuntuConfigChange={handleUbuntuConfigChange}
                      onPlay={handlePlay}
                      onImportCloneFile={handleImportCloneFile}
                      onLoadPresetFile={handleLoadPresetFile}
                      onSelectCore={handleSystemSelect}
                      error={tab.error}
                      isProcessing={tab.isProcessing}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
