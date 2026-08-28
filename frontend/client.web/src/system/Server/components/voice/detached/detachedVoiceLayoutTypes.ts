export type DetachedVoiceLayoutSlotMode = 'grid' | 'free';
export type DetachedVoiceLayoutSlotAspectRatio =
  '16:9' | '21:9' | '4:3' | 'free';

export type DetachedVoiceLayoutSlot = {
  index: number;
  preserveAspectRatio: boolean;
  aspectRatio?: DetachedVoiceLayoutSlotAspectRatio;
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
  zIndex: number;
  mode: DetachedVoiceLayoutSlotMode;
};

export type DetachedVoiceLayoutPreset = {
  id: string;
  name: string;
  cellSizePx: number;
  gridColumns: number;
  gridRows: number;
  isPinned: boolean;
  isPersisted?: boolean;
  showParticipantsWithoutVideo: boolean;
  hideServiceInfo: boolean;
  slots: DetachedVoiceLayoutSlot[];
};

export type DetachedVoiceLayoutStorage = {
  version: 1;
  presets: DetachedVoiceLayoutPreset[];
  lastPresetId: string | null;
  showParticipantsWithoutVideo: boolean;
  showSelfCamera: boolean;
  isTableView: boolean;
};

export type DetachedVoiceWorkspaceLayoutState = {
  activePresetId: string | null;
  editMode: boolean;
  gridColumns: number;
  gridRows: number;
  settingsMenuOpen: boolean;
  presets: DetachedVoiceLayoutPreset[];
  selectedSlotIndex: number | null;
  showParticipantsWithoutVideo: boolean;
  showSelfCamera: boolean;
  isTableView: boolean;
  mainCardKey: string | null;
  slotAssignments: Record<number, string>;
  slotInteractionCounter: number;
  slotInteractionOrder: Record<number, number>;
  slotMenuPositionUnlocked: boolean;
  slotMenuPosition: { x: number; y: number } | null;
  slotMenuPlacementSlot: DetachedVoiceLayoutSlot | null;
};
