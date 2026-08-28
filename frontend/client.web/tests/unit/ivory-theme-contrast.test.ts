import { expect, test } from '@playwright/test';

import { ivoryTheme } from '../../src/styles/themes/ivory';

function relativeLuminance(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

test('ivory text tokens remain readable on the light workspace surface', () => {
  const variables = ivoryTheme.variables;
  const background = variables['--color-bg'];
  const readableTokens = [
    '--color-text',
    '--color-muted',
    '--color-sapphire-light',
    '--color-rune',
    '--color-danger',
    '--color-success',
    '--theme-text-soft',
    '--theme-text-faint'
  ];

  for (const token of readableTokens) {
    expect(
      contrastRatio(variables[token], background),
      `${token} should meet WCAG AA contrast`
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('ivory accent controls use readable foreground content', () => {
  const variables = ivoryTheme.variables;
  const accentStops = ['#c49c5b', '#b68d4c'];

  expect(variables['--theme-surface-accent']).toBe(
    `linear-gradient(135deg, ${accentStops.join(', ')})`
  );
  expect(variables['--theme-surface-accent-strong']).toBe(
    `linear-gradient(180deg, ${accentStops.join(', ')})`
  );
  for (const accentStop of accentStops) {
    expect(
      contrastRatio(variables['--theme-accent-contrast'], accentStop)
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('ivory light accent remains readable on control surfaces', () => {
  const variables = ivoryTheme.variables;
  const lightAccent = variables['--color-sapphire-light'];
  const controlSurfaces = [variables['--color-bg'], '#d3cfc5'];

  for (const surface of controlSurfaces) {
    expect(contrastRatio(lightAccent, surface)).toBeGreaterThanOrEqual(4.5);
  }
});
