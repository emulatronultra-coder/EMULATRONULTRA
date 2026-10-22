import React from 'react';
import { SystemCore, SUPPORTED_SYSTEMS } from '../types';
import { Gamepad2, Cpu, Monitor, Terminal, Plus } from 'lucide-react';

interface Props {
  selected: SystemCore;
  onSelect: (core: SystemCore) => void;
  playingCores: SystemCore[];
  onNewTabForCore?: (core: SystemCore) => void;
}

export default function SystemSelector({ selected, onSelect, playingCores, onNewTabForCore }: Props) {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Terminal': return <Terminal className="w-5 h-5 text-amber-400" />;
      case 'Cpu': return <Cpu className="w-5 h-5" />;
      case 'Monitor': return <Monitor className="w-5 h-5" />;
      case 'Gamepad2': default: return <Gamepad2 className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {SUPPORTED_SYSTEMS.map((sys) => {
        const isSelected = selected === sys.id;
        const isPlaying = playingCores.includes(sys.id);
        return (
          <div key={sys.id} className="group relative flex items-center gap-1">
            <button
              onClick={() => onSelect(sys.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left flex-1 ${
                isSelected 
                  ? 'bg-sky-600/10 text-sky-400 border border-sky-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
                  : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${
                isSelected ? 'bg-sky-500/20 text-sky-400' : 'bg-neutral-800 text-neutral-500 group-hover:bg-neutral-700 group-hover:text-neutral-300'
              }`}>
                {getIcon(sys.icon)}
              </div>
              <span className="font-medium text-sm leading-tight flex-1">{sys.name}</span>
              {isPlaying && (
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Активна машина у вкладці"></div>
              )}
            </button>
            {onNewTabForCore && (
              <button
                type="button"
                onClick={() => onNewTabForCore(sys.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-neutral-400 hover:text-white hover:bg-sky-500/20 rounded-xl transition-all"
                title={`Відкрити нову вкладку з ${sys.name}`}
              >
                <Plus className="w-4 h-4 text-sky-400" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
