export type AuthFontOption = {
  id: string;
  label: string;
  stack: string;
};

const systemDisplayFont =
  'ui-rounded, "Segoe UI", "Trebuchet MS", system-ui, -apple-system, sans-serif';

export const authFontOptions: AuthFontOption[] = [
  {
    id: 'arcanelink-system',
    label: 'ArcaneLink System',
    stack: systemDisplayFont
  }
];

export const defaultAuthFontId = 'arcanelink-system';
