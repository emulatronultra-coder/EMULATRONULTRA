import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import {
  EmulatorConfig,
  StageRefHandle,
  VmHardwareConfig,
  DEFAULT_UBUNTU_VM_HARDWARE,
} from '../types';
import IbmPcEmulatorStage from './IbmPcEmulatorStage';

interface Props {
  config: EmulatorConfig;
  onHardwareChange?: (updated: VmHardwareConfig) => void;
  onCloneMachine?: (liveStateBuffer?: ArrayBuffer | null) => void;
  onExportCloneFile?: (liveStateBuffer?: ArrayBuffer | null) => void;
}

const UbuntuLinuxStage = forwardRef<StageRefHandle, Props>(function UbuntuLinuxStage(
  { config, onHardwareChange, onCloneMachine, onExportCloneFile },
  ref
) {
  const ibmStageRef = useRef<StageRefHandle | null>(null);

  useImperativeHandle(ref, () => ({
    restart: () => {
      ibmStageRef.current?.restart();
    },
    powerOff: () => {
      ibmStageRef.current?.powerOff();
    },
    captureLiveState: async () => {
      if (ibmStageRef.current?.captureLiveState) {
        return await ibmStageRef.current.captureLiveState();
      }
      return null;
    },
    getCanvas: () => {
      return ibmStageRef.current?.getCanvas?.() || null;
    },
  }));

  const effectiveHardware: VmHardwareConfig = {
    ...DEFAULT_UBUNTU_VM_HARDWARE,
    ...(config.hardwareConfig || {}),
    memoryMb: Math.max(config.hardwareConfig?.memoryMb || 128, 64),
    vgaMemoryMb: Math.max(config.hardwareConfig?.vgaMemoryMb || 8, 4),
  };

  const isCustomIso = config.ubuntuConfig?.bootSource === 'custom_iso' && !!(config.ubuntuConfig?.isoFile || config.osFile);
  const targetOsFile = config.ubuntuConfig?.isoFile || config.osFile || null;

  return (
    <div className="w-full h-full flex flex-col relative bg-neutral-950">
      <IbmPcEmulatorStage
        ref={ibmStageRef}
        osFile={targetOsFile}
        zipFile={config.zipFile || null}
        customBoot={false}
        bootOs="ubuntu"
        hardwareConfig={effectiveHardware}
        initialState={config.initialState || null}
        onHardwareChange={onHardwareChange}
        onCloneMachine={onCloneMachine}
        onExportCloneFile={onExportCloneFile}
      />
    </div>
  );
});

export default UbuntuLinuxStage;
