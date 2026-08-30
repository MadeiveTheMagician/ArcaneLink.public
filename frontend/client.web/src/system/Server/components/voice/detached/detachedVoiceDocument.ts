import { SYSTEM_THEME_VARIABLE_NAMES } from '../../../../../styles/systemThemeTokens';
import { getSystemIconCss } from '../../../../shared/index';
import detachedVoiceCardsCss from './detachedVoiceCards.css?raw';
import detachedVoiceControlsCss from './detachedVoiceControls.css?raw';
import detachedVoiceFormsCss from './detachedVoiceForms.css?raw';
import detachedVoiceOverlaysCss from './detachedVoiceOverlays.css?raw';
import detachedVoicePopupCss from './detachedVoicePopup.css?raw';

const detachedVoiceStyleElementId = 'arcanelink-detached-voice-styles';
const detachedApplicationStyleMarkerId =
  'arcanelink-detached-application-styles';
export const detachedFloatingPanelIgnoreSelector = [
  '[data-detached-settings-menu="true"]',
  '[data-detached-slot-menu="true"]',
  '[data-detached-preset-dropdown="true"]',
  '[data-detached-preset-menu="true"]',
  '[data-detached-slot-assignment-dropdown="true"]',
  '[data-detached-controls="true"]',
  '[data-detached-window-controls="true"]',
  '[data-slot-index]',
  '[data-detached-voice-chat-host="true"]'
].join(',');

export function prepareDetachedVoiceDocument(document: Document) {
  document.documentElement.classList.add('arcane-detached-root');
  document.body.classList.add('arcane-detached-body');

  mirrorApplicationStyles(document);
  mirrorApplicationTheme(document);

  if (document.getElementById(detachedVoiceStyleElementId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = detachedVoiceStyleElementId;
  style.textContent = [
    detachedVoicePopupCss,
    detachedVoiceFormsCss,
    detachedVoiceOverlaysCss,
    detachedVoiceCardsCss,
    detachedVoiceControlsCss
  ].join('\n');
  document.head.append(style);
}

function mirrorApplicationTheme(targetDocument: Document) {
  const sourceDocument = globalThis.document;
  if (!sourceDocument || sourceDocument === targetDocument) {
    return;
  }

  const sourceRoot = sourceDocument.documentElement;
  const targetRoot = targetDocument.documentElement;
  const copyTheme = () => {
    const computed = sourceDocument.defaultView?.getComputedStyle(sourceRoot);
    if (!computed) return;

    SYSTEM_THEME_VARIABLE_NAMES.forEach((name) => {
      const value = computed.getPropertyValue(name).trim();
      if (value) targetRoot.style.setProperty(name, value);
    });
    targetRoot.dataset.systemTheme = sourceRoot.dataset.systemTheme ?? '';
    targetRoot.dataset.systemThemeAssets =
      sourceRoot.dataset.systemThemeAssets ?? '';
  };

  copyTheme();
  const observer = new MutationObserver(copyTheme);
  observer.observe(sourceRoot, {
    attributes: true,
    attributeFilter: ['style', 'data-system-theme', 'data-system-theme-assets']
  });
  targetDocument.defaultView?.addEventListener(
    'unload',
    () => observer.disconnect(),
    { once: true }
  );
}

export function createDetachedVoiceShell(document: Document, title: string) {
  const shell = document.createElement('main');
  shell.className = 'arcane-detached-shell';

  const header = document.createElement('header');
  header.className = 'arcane-detached-header';
  const icon = document.createElement('span');
  icon.className = 'arcane-detached-header-icon';
  icon.style.background = getSystemIconCss('headphones-on');
  icon.setAttribute('aria-hidden', 'true');
  const heading = document.createElement('strong');
  heading.textContent = title;
  header.append(icon, heading);

  const grid = document.createElement('section');
  grid.className = 'arcane-detached-grid';

  const voiceChatHost = document.createElement('aside');
  voiceChatHost.className = 'arcane-detached-voice-chat-host';
  voiceChatHost.dataset.detachedVoiceChatHost = 'true';

  const content = document.createElement('div');
  content.className = 'arcane-detached-content';
  content.append(grid, voiceChatHost);

  shell.append(header, content);

  return { shell, grid, voiceChatHost };
}

function mirrorApplicationStyles(targetDocument: Document) {
  if (targetDocument.getElementById(detachedApplicationStyleMarkerId)) {
    return;
  }

  const sourceDocument = globalThis.document;
  if (!sourceDocument || sourceDocument === targetDocument) {
    return;
  }

  const marker = targetDocument.createElement('meta');
  marker.id = detachedApplicationStyleMarkerId;
  targetDocument.head.append(marker);

  sourceDocument
    .querySelectorAll('link[rel="stylesheet"], style')
    .forEach((styleNode) => {
      const clone = styleNode.cloneNode(true);
      targetDocument.head.append(clone);
    });
}

export function createDetachedControlsDock(document: Document) {
  const controls = document.createElement('div');
  controls.className = 'arcane-detached-controls-dock';
  controls.dataset.detachedControls = 'true';
  return controls;
}

export function createDetachedWindowControlsDock(document: Document) {
  const windowControls = document.createElement('div');
  windowControls.className = 'arcane-detached-window-controls';
  windowControls.dataset.detachedWindowControls = 'true';
  return windowControls;
}

export function bindDetachedControlsReveal(shell: HTMLElement) {
  const revealControls = () => {
    shell.classList.add('arcane-controls-visible');
  };
  const hideControls = () => {
    shell.classList.remove('arcane-controls-visible');
  };

  shell.addEventListener('pointerenter', revealControls);
  shell.addEventListener('pointerleave', hideControls);
  shell.addEventListener('focusin', revealControls);
  shell.addEventListener('focusout', hideControls);

  return () => {
    shell.removeEventListener('pointerenter', revealControls);
    shell.removeEventListener('pointerleave', hideControls);
    shell.removeEventListener('focusin', revealControls);
    shell.removeEventListener('focusout', hideControls);
  };
}
