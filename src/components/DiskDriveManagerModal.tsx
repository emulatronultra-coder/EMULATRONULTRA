import React, { useState, useRef } from 'react';
import {
  Disc,
  HardDrive,
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  X,
  Check,
  Sparkles,
  Layers,
  Database,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { createBlankFloppyDisk, createBlankWinchesterDrive, createFat16ImageFromZip, createFat16ImageFromSingleFile } from '../utils/fat16Builder';

export interface MountedDrivesState {
  fda?: { name: string; buffer?: ArrayBuffer | Uint8Array; sizeText?: string };
  fdb?: { name: string; buffer?: ArrayBuffer | Uint8Array; sizeText?: string };
  hda?: { name: string; buffer?: ArrayBuffer | Uint8Array; sizeText?: string; isSystem?: boolean };
  hdb?: { name: string; buffer?: ArrayBuffer | Uint8Array; sizeText?: string };
  cdrom?: { name: string; buffer?: ArrayBuffer | Uint8Array; sizeText?: string };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drives: MountedDrivesState;
  onMountFda: (file: File | Uint8Array, name: string) => Promise<void>;
  onEjectFda: () => void;
  onMountFdb: (file: File | Uint8Array, name: string) => Promise<void>;
  onEjectFdb: () => void;
  onMountHda: (file: File | Uint8Array, name: string, isZip?: boolean) => Promise<void>;
  onEjectHda: () => void;
  onMountHdb: (file: File | Uint8Array, name: string, isZip?: boolean) => Promise<void>;
  onEjectHdb: () => void;
  onMountCdrom: (file: File | Uint8Array, name: string) => Promise<void>;
  onEjectCdrom: () => void;
}

export default function DiskDriveManagerModal({
  isOpen,
  onClose,
  drives,
  onMountFda,
  onEjectFda,
  onMountFdb,
  onEjectFdb,
  onMountHda,
  onEjectHda,
  onMountHdb,
  onEjectHdb,
  onMountCdrom,
  onEjectCdrom,
}: Props) {
  const [activeTab, setActiveTab] = useState<'floppy' | 'winchester' | 'cdrom'>('floppy');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // File input refs
  const fdaInputRef = useRef<HTMLInputElement>(null);
  const fdbInputRef = useRef<HTMLInputElement>(null);
  const hdaInputRef = useRef<HTMLInputElement>(null);
  const hdbInputRef = useRef<HTMLInputElement>(null);
  const cdromInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleCreateBlankFloppy = async (drive: 'fda' | 'fdb', sizeKB: 1440 | 720 = 1440) => {
    try {
      setIsProcessing(true);
      const label = drive === 'fda' ? 'FLOPPY_A' : 'FLOPPY_B';
      const diskData = createBlankFloppyDisk(sizeKB, label);
      const diskName = `Blank_${sizeKB}KB_${label}.img`;
      if (drive === 'fda') {
        await onMountFda(diskData, diskName);
      } else {
        await onMountFdb(diskData, diskName);
      }
      showFeedback(`Створено та вставлено чисту дискету ${sizeKB} KB у дисковод ${drive.toUpperCase()}`);
    } catch (err: any) {
      showFeedback(`Помилка створення дискети: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBlankWinchester = async (drive: 'hda' | 'hdb', sizeMB: number = 64) => {
    try {
      setIsProcessing(true);
      const label = drive === 'hda' ? 'WINCHESTER_C' : 'WINCHESTER_D';
      const diskData = createBlankWinchesterDrive(sizeMB, label);
      const diskName = `Virtual_Winchester_${sizeMB}MB.img`;
      if (drive === 'hda') {
        await onMountHda(diskData, diskName, false);
      } else {
        await onMountHdb(diskData, diskName, false);
      }
      showFeedback(`Створено та змонтовано новий вінчестер (${sizeMB} MB FAT16) як Drive ${drive === 'hda' ? 'C:' : 'D:'}`);
    } catch (err: any) {
      showFeedback(`Помилка створення вінчестера: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBuffer = (buffer: ArrayBuffer | Uint8Array, filename: string) => {
    const blob = new Blob([buffer as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Керування накопичувачами та дисками (Storage)
              </h3>
              <p className="text-xs text-neutral-400">
                Гаряча заміна дискет A:/B:, вінчестерів IDE (HDD C:/D:) та приводів CD-ROM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 px-5 pt-3 gap-2 bg-neutral-900">
          <button
            onClick={() => setActiveTab('floppy')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'floppy'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Disc className="w-4 h-4" />
            <span>Дисководи Floppy (A: / B:)</span>
            {drives.fda && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('winchester')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'winchester'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Вінчестери IDE (HDD C: / D:)</span>
            {drives.hda && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('cdrom')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'cdrom'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Привід CD-ROM / ISO</span>
            {drives.cdrom && (
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: FLOPPY DISKS */}
          {activeTab === 'floppy' && (
            <div className="space-y-5">
              {/* Drive A: */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono font-bold text-xs">
                      A:
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Головний дисковод 3.5" (Floppy Drive A)</span>
                        {drives.fda ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Дискета вставлена
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-400">
                            Порожній
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {drives.fda?.name || 'Дискету не підключено'}
                      </div>
                    </div>
                  </div>

                  {drives.fda && (
                    <button
                      onClick={onEjectFda}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Витягти дискету з дисковода A:"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Витягти (Eject)</span>
                    </button>
                  )}
                </div>

                {/* Floppy A Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                  <input
                    type="file"
                    ref={fdaInputRef}
                    accept=".img,.ima,.vfd,.flp,.dsk,.bin"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await onMountFda(file, file.name);
                        showFeedback(`Вставлено образ ${file.name} у дисковод A:`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fdaInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Вставити дискету з комп'ютера (.img)</span>
                  </button>

                  <button
                    onClick={() => handleCreateBlankFloppy('fda', 1440)}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Створити чисту дискету (1.44 MB)</span>
                  </button>
                </div>
              </div>

              {/* Drive B: */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-neutral-800 text-neutral-300 flex items-center justify-center font-mono font-bold text-xs">
                      B:
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Додатковий дисковод 3.5" (Floppy Drive B)</span>
                        {drives.fdb ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Дискета вставлена
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-400">
                            Порожній
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {drives.fdb?.name || 'Дискету не підключено'}
                      </div>
                    </div>
                  </div>

                  {drives.fdb && (
                    <button
                      onClick={onEjectFdb}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Витягти дискету з дисковода B:"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Витягти (Eject)</span>
                    </button>
                  )}
                </div>

                {/* Floppy B Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                  <input
                    type="file"
                    ref={fdbInputRef}
                    accept=".img,.ima,.vfd,.flp,.dsk,.bin"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await onMountFdb(file, file.name);
                        showFeedback(`Вставлено образ ${file.name} у дисковод B:`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => fdbInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Вставити дискету у дисковод B:</span>
                  </button>

                  <button
                    onClick={() => handleCreateBlankFloppy('fdb', 1440)}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Створити чисту дискету для B:</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WINCHESTER HARD DRIVES */}
          {activeTab === 'winchester' && (
            <div className="space-y-5">
              {/* Winchester C: (Primary IDE Master) */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                      C:
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Головний вінчестер (Primary Master IDE / HDD C:)</span>
                        {drives.hda?.isSystem && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Системний завантажувальний
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {drives.hda?.name || 'Вінчестер C: активний'}
                      </div>
                    </div>
                  </div>

                  {drives.hda && !drives.hda.isSystem && (
                    <button
                      onClick={onEjectHda}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Відмонтувати вінчестер C:"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Відмонтувати</span>
                    </button>
                  )}
                </div>

                {/* Winchester C Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                  <input
                    type="file"
                    ref={hdaInputRef}
                    accept=".img,.vhd,.raw,.bin,.zip"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isZip = file.name.toLowerCase().endsWith('.zip');
                        await onMountHda(file, file.name, isZip);
                        showFeedback(`Змонтовано вінчестер C: з ${file.name}`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => hdaInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-amber-400" />
                    <span>Підключити вінчестер (.img / .zip)</span>
                  </button>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleCreateBlankWinchester('hda', 64)}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Новий 64MB</span>
                    </button>
                    <button
                      onClick={() => handleCreateBlankWinchester('hda', 256)}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>256MB</span>
                    </button>
                    <button
                      onClick={() => handleCreateBlankWinchester('hda', 512)}
                      disabled={isProcessing}
                      className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>512MB</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Winchester D: (Primary IDE Slave) */}
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono font-bold text-xs">
                      D:
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Додатковий вінчестер (Primary Slave IDE / HDD D:)</span>
                        {drives.hdb ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Диск підключено
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-400">
                            Вільний слот
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {drives.hdb?.name || 'Диск D: не підключено'}
                      </div>
                    </div>
                  </div>

                  {drives.hdb && (
                    <button
                      onClick={onEjectHdb}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Відмонтувати диск D:"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Відмонтувати</span>
                    </button>
                  )}
                </div>

                {/* Winchester D Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                  <input
                    type="file"
                    ref={hdbInputRef}
                    accept=".img,.vhd,.raw,.bin,.zip,.exe,.com"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const isZip = file.name.toLowerCase().endsWith('.zip');
                        await onMountHdb(file, file.name, isZip);
                        showFeedback(`Підключено ${file.name} як диск D:`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => hdbInputRef.current?.click()}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                    <span>Підключити папку/ігри (ZIP або .EXE)</span>
                  </button>

                  <button
                    onClick={() => handleCreateBlankWinchester('hdb', 128)}
                    disabled={isProcessing}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Створити новий диск D: (128 MB FAT16)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CD-ROM / ISO */}
          {activeTab === 'cdrom' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono font-bold text-xs">
                      CD
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <span>Оптичний привід ATAPI CD-ROM</span>
                        {drives.cdrom ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            Компакт-диск вставлено
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-800 text-neutral-400">
                            Лоток порожній
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {drives.cdrom?.name || 'Диск не вставлено'}
                      </div>
                    </div>
                  </div>

                  {drives.cdrom && (
                    <button
                      onClick={onEjectCdrom}
                      className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold border border-red-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Відкрити лоток та витягти компакт-диск"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Витягти CD (Eject)</span>
                    </button>
                  )}
                </div>

                <div className="pt-2 border-t border-neutral-800/80">
                  <input
                    type="file"
                    ref={cdromInputRef}
                    accept=".iso,.bin,.cue"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await onMountCdrom(file, file.name);
                        showFeedback(`Вставлено компакт-диск ${file.name} у привід CD-ROM`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => cdromInputRef.current?.click()}
                    disabled={isProcessing}
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-neutral-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Вставити ISO образ компакт-диска (.iso)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>Зміни накопичувачів застосовуються динамічно без перезавантаження ОС</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
