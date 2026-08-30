import { voiceCopy } from '../../../../shared/index';
import {
  createDetachedCardArticle,
  createDetachedVoiceCardKey
} from './detachedVoiceCards';
import type { DetachedVoiceWorkspaceLayoutState } from './detachedVoiceLayoutTypes';
import type { VoiceParticipantCard } from './detachedVoiceWorkspaceTypes';

type DetachedVoiceStandardLayoutOptions = {
  document: Document;
  grid: HTMLElement;
  layoutState: DetachedVoiceWorkspaceLayoutState;
  visibleCards: VoiceParticipantCard[];
  cleanupCallbacks: Array<() => void>;
  onPersistLayoutState: () => void;
  onRenderRequested: () => void;
};

export function renderDetachedVoiceStandardLayout({
  document,
  grid,
  layoutState,
  visibleCards,
  cleanupCallbacks,
  onPersistLayoutState,
  onRenderRequested
}: DetachedVoiceStandardLayoutOptions) {
  const renderStandardCard = (
    card: VoiceParticipantCard,
    variant: 'table' | 'main' | 'side'
  ) => {
    const accent =
      card.isSpeaking && card.mediaKind === 'camera'
        ? '80, 214, 143'
        : card.accent;
    const article = createDetachedCardArticle(document, card, {
      accent,
      cleanupCallbacks,
      screenSuffix: voiceCopy.channel.screenSuffix
    });
    article.classList.add('arcane-detached-standard-card');
    article.dataset.variant = variant;
    article.addEventListener('click', () => {
      const cardKey = createDetachedVoiceCardKey(card);
      if (!layoutState.isTableView && layoutState.mainCardKey === cardKey) {
        layoutState.isTableView = true;
        layoutState.mainCardKey = null;
      } else {
        layoutState.mainCardKey = cardKey;
        layoutState.isTableView = false;
      }
      onPersistLayoutState();
      onRenderRequested();
    });

    return article;
  };

  if (layoutState.isTableView) {
    visibleCards.forEach((card) => {
      grid.append(renderStandardCard(card, 'table'));
    });
    return;
  }

  if (visibleCards.length === 0) {
    layoutState.mainCardKey = null;
    return;
  }

  const visibleCardKeys = new Set(visibleCards.map(createDetachedVoiceCardKey));
  if (
    !layoutState.mainCardKey ||
    !visibleCardKeys.has(layoutState.mainCardKey)
  ) {
    layoutState.mainCardKey = createDetachedVoiceCardKey(visibleCards[0]);
  }

  const mainCard =
    visibleCards.find(
      (card) => createDetachedVoiceCardKey(card) === layoutState.mainCardKey
    ) ?? visibleCards[0];
  const sideCards = visibleCards.filter(
    (card) =>
      createDetachedVoiceCardKey(card) !== createDetachedVoiceCardKey(mainCard)
  );

  grid.classList.add('arcane-detached-standard-focused');

  const mainColumn = document.createElement('div');
  mainColumn.className = 'arcane-detached-standard-main-column';
  mainColumn.append(renderStandardCard(mainCard, 'main'));

  const sideColumn = document.createElement('div');
  sideColumn.className = 'arcane-detached-standard-side-column';
  sideColumn.hidden = sideCards.length === 0;
  sideCards.forEach((card) => {
    sideColumn.append(renderStandardCard(card, 'side'));
  });

  grid.append(mainColumn, sideColumn);
}
