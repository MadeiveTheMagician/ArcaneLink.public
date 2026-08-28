const storageKey = 'arcanelink.attachment-security.v1';

export type AttachmentSecuritySettings = {
  warnAboutPotentiallyDangerousFiles: boolean;
};

export const defaultAttachmentSecuritySettings: AttachmentSecuritySettings = {
  warnAboutPotentiallyDangerousFiles: true
};

export function loadAttachmentSecuritySettings(): AttachmentSecuritySettings {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored
      ? { ...defaultAttachmentSecuritySettings, ...JSON.parse(stored) }
      : defaultAttachmentSecuritySettings;
  } catch {
    return defaultAttachmentSecuritySettings;
  }
}

export function saveAttachmentSecuritySettings(
  settings: AttachmentSecuritySettings
) {
  localStorage.setItem(storageKey, JSON.stringify(settings));
}
