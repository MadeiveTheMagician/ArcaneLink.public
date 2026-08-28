import { voiceCopy } from '../../../../shared/index';
import { fallbackAvatarAccent } from '../../../../shared/utils/avatarAccent';
import { getVisibleDetachedVoiceCards } from './detachedVoiceCardVisibility';
import { updateDetachedSpeakingState as updateDetachedSpeakingStateInDocument } from './detachedVoiceCards';
import { updateDetachedControlButtons } from './detachedVoiceControls';
import {
  bindDetachedControlsReveal,
  createDetachedVoiceShell,
  prepareDetachedVoiceDocument
} from './detachedVoiceDocument';
import {
  deleteDetachedVoiceLayoutPresetFromApi,
  saveDetachedVoiceLayoutPresetToApi
} from './detachedVoiceLayoutApi';
import {
  activateDetachedVoicePreset,
  createDetachedPresetFromCards,
  createDetachedWorkspaceLayoutState,
  deleteDetachedActivePreset,
  getActiveDetachedVoicePreset,
  persistDetachedWorkspaceLayoutState,
  resetDetachedActivePreset,
  saveDetachedActivePreset,
  updateDetachedActivePresetSlot
} from './detachedVoiceLayoutState';
import { loadDetachedVoiceLayoutStorage } from './detachedVoiceLayoutStorage';
import type {
  DetachedVoiceLayoutPreset,
  DetachedVoiceLayoutSlot
} from './detachedVoiceLayoutTypes';
import {
  applyDetachedVoiceSlotStyle,
  renderDetachedVoicePresetLayout
} from './detachedVoicePresetLayout';
import { createDetachedVoiceSettingsMenu } from './detachedVoiceSettingsMenu';
import { renderDetachedVoiceSlotMenu } from './detachedVoiceSlotMenu';
import { renderDetachedVoiceStandardLayout } from './detachedVoiceStandardLayout';
import {
  bindDetachedVoiceWorkspaceCleanup,
  createDetachedFloatingPanelsDismissHandler,
  openDetachedVoiceWorkspacePopup,
  setDetachedVoiceSettingsButtonActive
} from './detachedVoiceWorkspace';
import { createDetachedVoiceWorkspaceControls } from './detachedVoiceWorkspaceControls';
import type {
  DetachedVoiceWorkspaceActions,
  DetachedVoiceWorkspaceControlState,
  DetachedVoiceWorkspaceWindow,
  VoiceParticipantCard
} from './detachedVoiceWorkspaceTypes';

type DetachedVoiceWorkspaceRuntimeOptions = {
  accessToken: string;
  spaceTitle: string;
  popupKey?: string;
  participantCards: VoiceParticipantCard[];
  controlState: DetachedVoiceWorkspaceControlState;
  getActions: () => DetachedVoiceWorkspaceActions;
  existingWindow: DetachedVoiceWorkspaceWindow | null;
  onVoiceChatHostChange?: (host: HTMLElement | null) => void;
};

export function openDetachedVoiceWorkspaceRuntime({
  accessToken,
  spaceTitle,
  popupKey,
  participantCards,
  controlState,
  getActions,
  existingWindow,
  onVoiceChatHostChange
}: DetachedVoiceWorkspaceRuntimeOptions) {
  const popup = openDetachedVoiceWorkspacePopup(
    spaceTitle,
    `arcanelink-voice-workspace-${normalizeDetachedWorkspaceKey(
      popupKey ?? spaceTitle
    )}`,
    existingWindow
  );
  if (!popup) {
    return null;
  }

  popup.disposeVoiceWorkspaceRuntime?.();
  const detachedWindow = popup;
  const { document: popupDocument } = popup;

  let cleanupCallbacks: Array<() => void> = [];
  let isVoiceChatOpen = false;
  const savedLayoutStorage = loadDetachedVoiceLayoutStorage();
  const layoutState = createDetachedWorkspaceLayoutState(savedLayoutStorage);

  function cleanupRenderedCards() {
    cleanupCallbacks.forEach((cleanup) => cleanup());
    cleanupCallbacks = [];
  }

  function persistLayoutState() {
    persistDetachedWorkspaceLayoutState(layoutState);
  }

  function syncPresetToApi(
    preset: DetachedVoiceLayoutPreset,
    forceCreate = false
  ) {
    void saveDetachedVoiceLayoutPresetToApi(accessToken, preset, forceCreate)
      .then((savedPreset) => {
        layoutState.presets = layoutState.presets.map((currentPreset) =>
          currentPreset.id === preset.id
            ? { ...savedPreset, isPersisted: true }
            : currentPreset
        );

        if (layoutState.activePresetId === preset.id) {
          layoutState.activePresetId = savedPreset.id;
        }

        persistLayoutState();
      })
      .catch(() => undefined);
  }

  function getActivePreset() {
    return getActiveDetachedVoicePreset(layoutState);
  }

  function saveActivePreset(patch: Partial<DetachedVoiceLayoutPreset>) {
    saveDetachedActivePreset(layoutState, patch);
  }

  function updateActivePresetSlot(
    slotIndex: number,
    patch: Partial<DetachedVoiceLayoutSlot>
  ) {
    updateDetachedActivePresetSlot(layoutState, slotIndex, patch);
    return (
      getActivePreset()?.slots.find((slot) => slot.index === slotIndex) ?? null
    );
  }

  function activatePreset(presetId: string | null) {
    activateDetachedVoicePreset(layoutState, presetId);
  }

  function createPresetFromCurrentCards(cards: VoiceParticipantCard[]) {
    return createDetachedPresetFromCards(layoutState, {
      cardCount: cards.length,
      namePrefix: voiceCopy.detached.presetNamePrefix
    });
  }

  function deleteActivePreset() {
    const activePreset = deleteDetachedActivePreset(layoutState);
    if (!activePreset) {
      return;
    }

    void deleteDetachedVoiceLayoutPresetFromApi(
      accessToken,
      activePreset.id
    ).catch(() => undefined);
  }

  function resetActivePreset(cards: VoiceParticipantCard[]) {
    resetDetachedActivePreset(layoutState, cards.length);
  }

  function getVisibleDetachedCards(cards: VoiceParticipantCard[]) {
    return getVisibleDetachedVoiceCards(
      cards,
      layoutState.showParticipantsWithoutVideo,
      layoutState.showSelfCamera
    );
  }

  function updateDetachedSpeakingState(cards: VoiceParticipantCard[]) {
    updateDetachedSpeakingStateInDocument(popupDocument, cards);
  }

  function updateDetachedControlState(
    controlState: DetachedVoiceWorkspaceControlState
  ) {
    const labels: Record<keyof DetachedVoiceWorkspaceControlState, string> = {
      isMuted: controlState.isMuted
        ? voiceCopy.controls.micOn
        : voiceCopy.controls.micOff,
      isDeafened: controlState.isDeafened
        ? voiceCopy.controls.deafenedOff
        : voiceCopy.controls.deafenedOn,
      isCameraEnabled: controlState.isCameraEnabled
        ? voiceCopy.controls.cameraOff
        : voiceCopy.controls.cameraOn,
      isScreenSharing: controlState.isScreenSharing
        ? voiceCopy.controls.screenOff
        : voiceCopy.controls.screenOn
    };
    updateDetachedControlButtons(popupDocument, controlState, labels);
  }

  function updateDetachedVoiceChatState(isOpen: boolean) {
    isVoiceChatOpen = isOpen;
    const shell = popupDocument.querySelector<HTMLElement>(
      '.arcane-detached-shell'
    );
    if (shell) {
      shell.dataset.voiceChatOpen = isOpen ? 'true' : 'false';
    }

    const toggle = popupDocument.querySelector<HTMLButtonElement>(
      '[data-detached-voice-chat-toggle="true"]'
    );
    if (toggle) {
      toggle.dataset.active = isOpen ? 'true' : 'false';
      toggle.setAttribute(
        'aria-label',
        isOpen ? voiceCopy.channel.closeChat : voiceCopy.channel.openChat
      );
    }
  }

  function renderCards(
    nextSpaceTitle: string,
    nextCards: VoiceParticipantCard[],
    nextControlState: DetachedVoiceWorkspaceControlState
  ) {
    cleanupRenderedCards();
    popupDocument.title = voiceCopy.detached.popupTitle(nextSpaceTitle);
    prepareDetachedVoiceDocument(popupDocument);

    const { shell, grid, voiceChatHost } = createDetachedVoiceShell(
      popupDocument,
      nextSpaceTitle
    );
    shell.dataset.voiceChatOpen = isVoiceChatOpen ? 'true' : 'false';

    const visibleCards = getVisibleDetachedCards(nextCards);
    const activePreset = getActivePreset();
    const slotMenuHost = popupDocument.createElement('div');
    let cleanupSlotMenu: (() => void) | null = null;
    cleanupCallbacks.push(() => cleanupSlotMenu?.());

    function updateSelectedSlotHighlight() {
      popupDocument
        .querySelectorAll<HTMLElement>('[data-slot-index]')
        .forEach((article) => {
          const isSelected =
            Number(article.dataset.slotIndex) === layoutState.selectedSlotIndex;

          article.dataset.selectedSlot = isSelected ? 'true' : 'false';
        });
    }

    function selectSlotWithoutWorkspaceRender(slotIndex: number) {
      const nextSlotIndex =
        layoutState.selectedSlotIndex === slotIndex ? null : slotIndex;
      layoutState.selectedSlotIndex = nextSlotIndex;
      layoutState.slotMenuPlacementSlot =
        nextSlotIndex === null
          ? null
          : (getActivePreset()?.slots.find(
              (slot) => slot.index === nextSlotIndex
            ) ?? null);
      if (!layoutState.slotMenuPositionUnlocked) {
        layoutState.slotMenuPosition = null;
      }
      updateSelectedSlotHighlight();
      renderSlotSettingsMenu();
    }

    function applySlotUpdateWithoutWorkspaceRender(
      slotIndex: number,
      patch: Partial<DetachedVoiceLayoutSlot>
    ) {
      const updatedSlot = updateActivePresetSlot(slotIndex, patch);
      const updatedPreset = getActivePreset();
      const article = popupDocument.querySelector<HTMLElement>(
        `[data-slot-index="${slotIndex}"]`
      );
      if (article && updatedPreset && updatedSlot) {
        applyDetachedVoiceSlotStyle(
          article,
          layoutState,
          updatedPreset,
          updatedSlot
        );
      }
      return updatedSlot;
    }

    function moveSlotWithoutWorkspaceRender(
      slotIndex: number,
      patch: Partial<DetachedVoiceLayoutSlot>
    ) {
      const updatedSlot = applySlotUpdateWithoutWorkspaceRender(
        slotIndex,
        patch
      );
      if (updatedSlot) {
        layoutState.slotMenuPlacementSlot = { ...updatedSlot };
      }
      updateSelectedSlotHighlight();
      renderSlotSettingsMenu();
    }

    function renderSlotSettingsMenu() {
      cleanupSlotMenu?.();
      cleanupSlotMenu = null;
      const selectedPreset = getActivePreset();
      const selectedSlot = selectedPreset?.slots.find(
        (slot) => slot.index === layoutState.selectedSlotIndex
      );
      cleanupSlotMenu =
        renderDetachedVoiceSlotMenu({
          document: popupDocument,
          host: slotMenuHost,
          layoutState,
          selectedPreset,
          selectedSlot,
          cardOptions: getVisibleDetachedCards(nextCards),
          onUpdateSlot: applySlotUpdateWithoutWorkspaceRender,
          onMenuRenderRequested: renderSlotSettingsMenu,
          onWorkspaceRenderRequested: () => {
            renderCards(nextSpaceTitle, nextCards, nextControlState);
          },
          onMenuLockChange: (unlocked) => {
            layoutState.slotMenuPositionUnlocked = unlocked;
          },
          onMenuPositionChange: (position) => {
            layoutState.slotMenuPosition = position;
          }
        }) ?? null;
    }

    if (activePreset) {
      renderDetachedVoicePresetLayout({
        document: popupDocument,
        grid,
        layoutState,
        activePreset,
        visibleCards,
        cleanupCallbacks,
        fallbackAccent: fallbackAvatarAccent,
        onSelectSlotWithoutWorkspaceRender: selectSlotWithoutWorkspaceRender,
        getSlot: (slotIndex) =>
          getActivePreset()?.slots.find((slot) => slot.index === slotIndex) ??
          null,
        onSlotMoved: (slotIndex, patch) => {
          moveSlotWithoutWorkspaceRender(slotIndex, patch);
        }
      });
    } else {
      renderDetachedVoiceStandardLayout({
        document: popupDocument,
        grid,
        layoutState,
        visibleCards,
        cleanupCallbacks,
        onPersistLayoutState: persistLayoutState,
        onRenderRequested: () => {
          renderCards(nextSpaceTitle, nextCards, nextControlState);
        }
      });
    }

    if (visibleCards.length === 0 && !layoutState.editMode) {
      const empty = popupDocument.createElement('p');
      empty.className = 'arcane-detached-empty-state';
      empty.textContent = voiceCopy.state.noParticipantsWithDot;
      grid.append(empty);
    }

    shell.append(
      createDetachedVoiceSettingsMenu({
        document: popupDocument,
        layoutState,
        visibleCards,
        cleanupCallbacks,
        getActivePreset,
        onActivatePreset: activatePreset,
        onSaveActivePreset: saveActivePreset,
        onPersistLayoutState: persistLayoutState,
        onCreatePreset: createPresetFromCurrentCards,
        onResetPreset: resetActivePreset,
        onDeletePreset: deleteActivePreset,
        onSyncPresetToApi: syncPresetToApi,
        onRenderRequested: () => {
          renderCards(nextSpaceTitle, nextCards, nextControlState);
        }
      })
    );

    renderSlotSettingsMenu();
    shell.append(slotMenuHost);

    const { controls, windowControls } = createDetachedVoiceWorkspaceControls({
      document: popupDocument,
      detachedWindow,
      controlState: nextControlState,
      actions: getActions(),
      isSettingsOpen: layoutState.settingsMenuOpen,
      isVoiceChatOpen,
      onSettingsClick: (event) => {
        layoutState.selectedSlotIndex = null;
        layoutState.settingsMenuOpen = !layoutState.settingsMenuOpen;
        updateSelectedSlotHighlight();
        renderSlotSettingsMenu();
        const settingsMenu = popupDocument.querySelector<HTMLElement>(
          '[data-detached-settings-menu="true"]'
        );
        if (settingsMenu) {
          settingsMenu.hidden = !layoutState.settingsMenuOpen;
        }
        setDetachedVoiceSettingsButtonActive(
          popupDocument,
          event,
          layoutState.settingsMenuOpen
        );
      }
    });

    const unbindControlsReveal = bindDetachedControlsReveal(shell);
    const closeDetachedFloatingPanels =
      createDetachedFloatingPanelsDismissHandler({
        document: popupDocument,
        layoutState,
        onSelectedSlotHighlightUpdate: updateSelectedSlotHighlight,
        onSlotMenuRender: renderSlotSettingsMenu
      });
    shell.addEventListener('pointerdown', closeDetachedFloatingPanels);
    cleanupCallbacks.push(() => {
      unbindControlsReveal();
      shell.removeEventListener('pointerdown', closeDetachedFloatingPanels);
    });

    shell.append(controls, windowControls);
    popupDocument.body.replaceChildren(shell);
    detachedWindow.voiceChatHost = voiceChatHost;
    onVoiceChatHostChange?.(voiceChatHost);
  }

  popup.renderVoiceWorkspaceCards = renderCards;
  popup.updateVoiceWorkspaceSpeakingState = updateDetachedSpeakingState;
  popup.updateVoiceWorkspaceControlState = updateDetachedControlState;
  popup.updateVoiceWorkspaceChatState = updateDetachedVoiceChatState;
  let isDisposed = false;
  let unbindCleanup: () => void = () => undefined;
  const disposeRuntime = () => {
    if (isDisposed) {
      return;
    }

    isDisposed = true;
    cleanupRenderedCards();
    popup.voiceChatHost = null;
    onVoiceChatHostChange?.(null);
    popup.renderVoiceWorkspaceCards = undefined;
    popup.updateVoiceWorkspaceSpeakingState = undefined;
    popup.updateVoiceWorkspaceControlState = undefined;
    popup.updateVoiceWorkspaceChatState = undefined;
    unbindCleanup();
    if (popup.disposeVoiceWorkspaceRuntime === disposeRuntime) {
      popup.disposeVoiceWorkspaceRuntime = undefined;
    }
  };
  unbindCleanup = bindDetachedVoiceWorkspaceCleanup(popup, disposeRuntime);
  popup.disposeVoiceWorkspaceRuntime = disposeRuntime;
  renderCards(spaceTitle, participantCards, controlState);
  popup.focus();
  return popup;
}

function normalizeDetachedWorkspaceKey(value: string) {
  return value.trim().toLowerCase();
}
