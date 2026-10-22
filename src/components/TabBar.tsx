import React, { useState } from 'react';
import { VmTab, SUPPORTED_SYSTEMS } from '../types';
import {
  Plus,
  X,
  Copy,
  Download,
  Upload,
  Gamepad2,
  Cpu,
  Monitor,
  Edit2,
  Check,
} from 'lucide-react';

interface Props {
  tabs: VmTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
  onCloneActiveTab: () => void;
  onExportActiveTab: () => void;
  onImportCloneFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRenameTab: (id: string, newTitle: string) => void;
}

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onCloneActiveTab,
  onExportActiveTab,
  onImportCloneFile,
  onRenameTab,
}: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const getCoreIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Cpu': return <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'Monitor': return <Monitor className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      default: return <Gamepad2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    }
  };

  const handleStartRename = (e: React.MouseEvent, tab: VmTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameTab(id, editingTitle.trim());
    }
    setEditingTabId(null);
  };

  return (
    <div className="bg-neutral-950 border-b border-neutral-800 flex items-center justify-between px-2 pt-2 gap-2 select-none overflow-x-auto custom-scrollbar">
      {/* Scrollable Tabs Container */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto custom-scrollbar py-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const sysInfo = SUPPORTED_SYSTEMS.find((s) => s.id === tab.core);

          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 px-3 py-2 rounded-t-xl text-xs font-medium transition-all duration-150 cursor-pointer max-w-[220px] min-w-[130px] shrink-0 border-t border-x ${
                isActive
                  ? 'bg-neutral-900 text-white border-neutral-700 shadow-lg shadow-black/40 z-10'
                  : 'bg-neutral-950/60 text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200 border-transparent'
              }`}
            >
              {getCoreIcon(sysInfo?.icon)}

              {editingTabId === tab.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename(tab.id);
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    onBlur={() => handleSaveRename(tab.id)}
                    autoFocus
                    className="w-full bg-neutral-800 text-white text-xs px-1.5 py-0.5 rounded outline-none border border-sky-500 font-sans"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRename(tab.id);
                    }}
                    className="p-0.5 text-emerald-400 hover:text-white"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span
                  onDoubleClick={(e) => handleStartRename(e, tab)}
                  className="truncate flex-1 font-sans font-medium"
                  title={`${tab.title} (Подвійний клік для перейменування)`}
                >
                  {tab.title}
                </span>
              )}

              {/* Status Dot */}
              {tab.isPlaying && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse" title="Машина запущена" />
              )}

              {/* Edit Button on Hover */}
              {editingTabId !== tab.id && (
                <button
                  type="button"
                  onClick={(e) => handleStartRename(e, tab)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-500 hover:text-white rounded transition-opacity"
                  title="Перейменувати вкладку"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              )}

              {/* Close Tab Button (Always visible) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className="p-1 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                title="Закрити вкладку"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Add New Tab Button */}
        <button
          type="button"
          onClick={onAddTab}
          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors shrink-0 flex items-center gap-1 border border-neutral-800/60"
          title="Відкрити нову вкладку (Нова машина)"
        >
          <Plus className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-semibold hidden sm:inline">Нова машина</span>
        </button>
      </div>

      {/* Action Bar (Clone, Export, Import) */}
      <div className="flex items-center gap-1.5 shrink-0 pb-1">
        {/* Clone Active Machine Tab */}
        <button
          type="button"
          onClick={onCloneActiveTab}
          className="px-2.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 hover:text-white border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          title="Клонувати поточну машину з її станом у нову вкладку"
        >
          <Copy className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">Клонувати</span>
        </button>

        {/* Save/Export Clone to File */}
        <button
          type="button"
          onClick={onExportActiveTab}
          className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Зберегти клон поточної машини у файл (.vmclone)"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Зберегти клон</span>
        </button>

        {/* Load/Run Clone from File */}
        <div className="relative group cursor-pointer inline-flex">
          <input
            type="file"
            accept=".vmclone,.v86state,.json"
            onChange={onImportCloneFile}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <button
            type="button"
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm pointer-events-none"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Запустити з файлу</span>
          </button>
        </div>
      </div>
    </div>
  );
}
