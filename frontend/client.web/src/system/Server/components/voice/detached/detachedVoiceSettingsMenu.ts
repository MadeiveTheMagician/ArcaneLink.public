import { voiceCopy } from '../../../../shared/index';
import {
  createDetachedCheckboxLabel,
  createDetachedCompactButton,
  createDetachedDropdownButton,
  createDetachedDropdownMenu,
  createDetachedFieldGrid,
  createDetachedIconButton,
  createDetachedLabeledField,
  createDetachedMenuOption,
  createDetachedNumberInput,
  createDetachedTextInput
} from './detachedVoiceDom';
import { bindDetachedVoiceDropdown } from './detachedVoiceDropdown';
import {
  clampNumber,
  detachedVoiceLayoutDefaultCellSizePx,
  detachedVoiceLayoutDefaultColumns,
  detachedVoiceLayoutDefaultRows,
  detachedVoiceLayoutMaxCellSizePx,
  detachedVoiceLayoutMaxColumns,
  detachedVoiceLayoutMaxRows,
  detachedVoiceLayoutMinCellSizePx,
  normalizeDetachedVoiceSlot,
  resizeDetachedVoicePresetSlots
} from './detachedVoiceLayoutModel';
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceWorkspaceLayoutState
} from './detachedVoiceLayoutTypes';
import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes';

type DetachedVoiceSettingsMenuOptions = {
  document: Document;
  layoutState: DetachedVoiceWorkspaceLayoutState;
  visibleCards: VoiceParticipantCard[];
  cleanupCallbacks: Array<() => void>;
  getActivePreset: () => DetachedVoiceLayoutPreset | null;
  onActivatePreset: (presetId: string | null) => void;
  onSaveActivePreset: (patch: Partial<DetachedVoiceLayoutPreset>) => void;
  onPersistLayoutState: () => void;
  onCreatePreset: (cards: VoiceParticipantCard[]) => void;
  onResetPreset: (cards: VoiceParticipantCard[]) => void;
  onDeletePreset: () => void;
  onSyncPresetToApi: (
    preset: DetachedVoiceLayoutPreset,
    forceCreate?: boolean
  ) => void;
  onRenderRequested: () => void;
};

export function createDetachedVoiceSettingsMenu({
  document,
  layoutState,
  visibleCards,
  cleanupCallbacks,
  getActivePreset,
  onActivatePreset,
  onSaveActivePreset,
  onPersistLayoutState,
  onCreatePreset,
  onResetPreset,
  onDeletePreset,
  onSyncPresetToApi,
  onRenderRequested
}: DetachedVoiceSettingsMenuOptions) {
  const settingsActivePreset = getActivePreset();
  const isPresetSettingsMode = Boolean(
    layoutState.editMode && settingsActivePreset
  );
  const settingsMenu = document.createElement('div');
  settingsMenu.className = 'arcane-popover arcane-detached-settings-menu';
  settingsMenu.dataset.detachedSettingsMenu = 'true';
  settingsMenu.dataset.mode = isPresetSettingsMode ? 'preset' : 'default';
  settingsMenu.hidden = !layoutState.settingsMenuOpen;

  const title = document.createElement('strong');
  title.className = 'arcane-detached-panel-title';
  title.textContent =
    isPresetSettingsMode && settingsActivePreset
      ? voiceCopy.detached.presetSettingsTitle(settingsActivePreset.name)
      : voiceCopy.detached.settingsTitle;

  const showEmptyLabel = createDetachedCheckboxLabel(
    document,
    voiceCopy.detached.showParticipantsWithoutVideo,
    {
      checked: layoutState.showParticipantsWithoutVideo,
      onChange: (checked) => {
        layoutState.showParticipantsWithoutVideo = checked;
        const preset = getActivePreset();
        if (preset) {
          onSaveActivePreset({
            showParticipantsWithoutVideo: checked
          });
        } else {
          onPersistLayoutState();
        }
        onRenderRequested();
      }
    }
  );

  const showSelfCameraLabel = createDetachedCheckboxLabel(
    document,
    voiceCopy.detached.showSelfCamera,
    {
      checked: layoutState.showSelfCamera,
      onChange: (checked) => {
        layoutState.showSelfCamera = checked;
        onPersistLayoutState();
        onRenderRequested();
      }
    }
  );

  const tableViewLabel = createDetachedCheckboxLabel(
    document,
    voiceCopy.detached.tableView,
    {
      checked: layoutState.isTableView,
      disabled: Boolean(getActivePreset()),
      title: getActivePreset() ? voiceCopy.detached.tableViewUnavailable : '',
      onChange: (checked) => {
        layoutState.isTableView = checked;
        if (layoutState.isTableView) {
          layoutState.mainCardKey = null;
        }
        onPersistLayoutState();
        onRenderRequested();
      }
    }
  );

  const presetBlock = document.createElement('div');
  presetBlock.className = 'arcane-detached-preset-block';
  const presetCaption = document.createElement('span');
  presetCaption.className = 'arcane-detached-preset-caption';
  presetCaption.textContent = voiceCopy.detached.userCameraLayout;
  const presetRow = document.createElement('div');
  presetRow.className = 'arcane-detached-preset-row';
  presetRow.dataset.hasEdit =
    settingsActivePreset && !isPresetSettingsMode ? 'true' : 'false';
  const presetDropdown = document.createElement('div');
  presetDropdown.className = 'arcane-detached-preset-dropdown';
  presetDropdown.dataset.detachedPresetDropdown = 'true';
  const presetDropdownButton = createDetachedDropdownButton(document, {
    variant: 'settings',
    text: settingsActivePreset?.name ?? voiceCopy.detached.defaultPreset
  });

  const presetDropdownMenu = createDetachedDropdownMenu(document, {
    variant: 'side'
  });
  presetDropdownMenu.dataset.detachedPresetMenu = 'true';
  const presetOptions: Array<{ id: string | null; name: string }> = [
    { id: null, name: voiceCopy.detached.defaultPreset },
    ...layoutState.presets.map((preset) => ({
      id: preset.id,
      name: preset.name
    }))
  ];
  presetOptions.forEach((option) => {
    const optionButton = createDetachedMenuOption(document, {
      text: option.name,
      active: layoutState.activePresetId === option.id,
      onSelect: () => {
        presetDropdownController.close();
        onActivatePreset(option.id);
        onRenderRequested();
      }
    });
    presetDropdownMenu.append(optionButton);
  });
  const presetDropdownController = bindDetachedVoiceDropdown({
    document,
    root: presetDropdown,
    trigger: presetDropdownButton,
    menu: presetDropdownMenu
  });
  cleanupCallbacks.push(presetDropdownController.cleanup);
  presetDropdown.append(presetDropdownButton, presetDropdownMenu);

  const createPresetButton = createDetachedIconButton(document, {
    label: voiceCopy.detached.createPreset,
    icon: 'plus',
    onClick: () => {
      onCreatePreset(visibleCards);
      onRenderRequested();
    }
  });

  presetRow.append(presetDropdown, createPresetButton);
  if (settingsActivePreset && !isPresetSettingsMode) {
    const editPresetButton = createDetachedIconButton(document, {
      label: layoutState.editMode
        ? voiceCopy.detached.collapsePresetSettings
        : voiceCopy.detached.configurePreset,
      icon: 'settings',
      onClick: () => {
        layoutState.editMode = !layoutState.editMode;
        layoutState.selectedSlotIndex = null;
        layoutState.settingsMenuOpen = true;
        onRenderRequested();
      }
    });
    presetRow.append(editPresetButton);
  }
  presetBlock.append(presetCaption, presetRow);
  if (!isPresetSettingsMode) {
    settingsMenu.append(
      title,
      showEmptyLabel,
      showSelfCameraLabel,
      tableViewLabel,
      presetBlock
    );
  }

  const activeSettingsPreset = settingsActivePreset;
  if (activeSettingsPreset && isPresetSettingsMode) {
    const editModeButton = createDetachedCompactButton(document, {
      text: layoutState.editMode
        ? voiceCopy.detached.pinPreset
        : voiceCopy.detached.editPreset,
      onClick: () => {
        if (layoutState.editMode) {
          onSaveActivePreset({ isPinned: true });
          layoutState.editMode = false;
          layoutState.selectedSlotIndex = null;
          layoutState.settingsMenuOpen = false;
        } else {
          onSaveActivePreset({ isPinned: false });
          layoutState.editMode = true;
          layoutState.selectedSlotIndex = null;
        }
        onRenderRequested();
      }
    });

    const hideServiceInfoLabel = createDetachedCheckboxLabel(
      document,
      voiceCopy.detached.hideServiceInfo,
      {
        checked: activeSettingsPreset.hideServiceInfo,
        onChange: (checked) => {
          onSaveActivePreset({ hideServiceInfo: checked });
          onRenderRequested();
        }
      }
    );

    const gridFields = createDetachedFieldGrid(document, {
      columns: 4
    });

    const slotsInput = createDetachedNumberInput(document, {
      value: activeSettingsPreset.slots.length,
      min: 1,
      max: 64,
      title: voiceCopy.detached.slotCount,
      variant: 'settings'
    });

    const cellSizeInput = createDetachedNumberInput(document, {
      value: activeSettingsPreset.cellSizePx,
      min: detachedVoiceLayoutMinCellSizePx,
      max: detachedVoiceLayoutMaxCellSizePx,
      title: voiceCopy.detached.cellSizeTitle,
      variant: 'settings'
    });

    const columnsInput = createDetachedNumberInput(document, {
      value: activeSettingsPreset.gridColumns,
      min: 2,
      max: detachedVoiceLayoutMaxColumns,
      title: voiceCopy.detached.gridColumnsTitle,
      variant: 'settings'
    });

    const rowsInput = createDetachedNumberInput(document, {
      value: activeSettingsPreset.gridRows,
      min: 2,
      max: detachedVoiceLayoutMaxRows,
      title: voiceCopy.detached.gridRowsTitle,
      variant: 'settings'
    });

    slotsInput.addEventListener('change', () => {
      const activePresetForSlots = getActivePreset();
      if (!activePresetForSlots) {
        return;
      }

      const slotCount = clampNumber(
        Math.round(Number(slotsInput.value) || 1),
        1,
        64
      );
      const resizedPreset = resizeDetachedVoicePresetSlots(
        activePresetForSlots,
        slotCount
      );
      onSaveActivePreset({ slots: resizedPreset.slots });
      onRenderRequested();
    });
    cellSizeInput.addEventListener('change', () => {
      const cellSizePx = clampNumber(
        Math.round(
          Number(cellSizeInput.value) || detachedVoiceLayoutDefaultCellSizePx
        ),
        detachedVoiceLayoutMinCellSizePx,
        detachedVoiceLayoutMaxCellSizePx
      );
      onSaveActivePreset({ cellSizePx });
      onRenderRequested();
    });
    columnsInput.addEventListener('change', () => {
      const activePresetForColumns = getActivePreset();
      if (!activePresetForColumns) {
        return;
      }

      const gridColumns = clampNumber(
        Math.round(
          Number(columnsInput.value) || detachedVoiceLayoutDefaultColumns
        ),
        2,
        detachedVoiceLayoutMaxColumns
      );
      layoutState.gridColumns = gridColumns;
      onSaveActivePreset({
        gridColumns,
        slots: activePresetForColumns.slots.map((slot) =>
          normalizeDetachedVoiceSlot(
            slot,
            gridColumns,
            activePresetForColumns.gridRows
          )
        )
      });
      onRenderRequested();
    });
    rowsInput.addEventListener('change', () => {
      const activePresetForRows = getActivePreset();
      if (!activePresetForRows) {
        return;
      }

      const gridRows = clampNumber(
        Math.round(Number(rowsInput.value) || detachedVoiceLayoutDefaultRows),
        2,
        detachedVoiceLayoutMaxRows
      );
      layoutState.gridRows = gridRows;
      onSaveActivePreset({
        gridRows,
        slots: activePresetForRows.slots.map((slot) =>
          normalizeDetachedVoiceSlot(
            slot,
            activePresetForRows.gridColumns,
            gridRows
          )
        )
      });
      onRenderRequested();
    });
    gridFields.append(
      createDetachedLabeledField(
        document,
        voiceCopy.detached.slots,
        slotsInput
      ),
      createDetachedLabeledField(
        document,
        voiceCopy.detached.gridColumns,
        columnsInput
      ),
      createDetachedLabeledField(
        document,
        voiceCopy.detached.gridRows,
        rowsInput
      ),
      createDetachedLabeledField(
        document,
        voiceCopy.detached.cellSize,
        cellSizeInput
      )
    );

    const saveButton = createDetachedCompactButton(document, {
      text: voiceCopy.detached.savePreset,
      onClick: () => {
        onPersistLayoutState();
        const presetToSave = getActivePreset();
        if (presetToSave) {
          onSyncPresetToApi(presetToSave, !presetToSave.isPersisted);
        }
        onRenderRequested();
      }
    });

    const renameInput = createDetachedTextInput(document, {
      value: activeSettingsPreset.name,
      placeholder: voiceCopy.detached.presetName,
      onChange: (value) => {
        const nextName = value.trim();
        if (nextName) {
          onSaveActivePreset({ name: nextName });
          onRenderRequested();
        }
      }
    });

    const resetButton = createDetachedCompactButton(document, {
      text: voiceCopy.detached.resetPreset,
      onClick: () => {
        onResetPreset(visibleCards);
        onRenderRequested();
      }
    });

    const deleteButton = createDetachedCompactButton(document, {
      text: voiceCopy.detached.deletePreset,
      danger: true,
      onClick: () => {
        onDeletePreset();
        onRenderRequested();
      }
    });

    if (layoutState.editMode) {
      settingsMenu.append(
        title,
        showEmptyLabel,
        showSelfCameraLabel,
        hideServiceInfoLabel,
        gridFields,
        createDetachedLabeledField(
          document,
          voiceCopy.detached.name,
          renameInput
        ),
        resetButton,
        deleteButton,
        saveButton,
        editModeButton
      );
    } else {
      settingsMenu.append(
        title,
        showEmptyLabel,
        showSelfCameraLabel,
        hideServiceInfoLabel,
        createDetachedLabeledField(
          document,
          voiceCopy.detached.name,
          renameInput
        ),
        resetButton,
        deleteButton,
        editModeButton
      );
    }
  }

  return settingsMenu;
}
