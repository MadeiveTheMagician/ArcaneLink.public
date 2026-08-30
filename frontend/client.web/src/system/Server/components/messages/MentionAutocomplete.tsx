import { SystemIcon } from '../../../shared';
import type { MentionOption, MentionSuggestions } from './mentions';

import styles from './MentionAutocomplete.module.css';

export function flattenMentionSuggestions(
  suggestions: MentionSuggestions
): MentionOption[] {
  return [
    ...(suggestions.everyone ? [suggestions.everyone] : []),
    ...suggestions.users,
    ...suggestions.roles
  ];
}

function MentionOptionAvatar({ option }: { option: MentionOption }) {
  const isUser = option.kind === 'user';

  return (
    <span className={styles.optionIcon} aria-hidden="true">
      <SystemIcon
        name={option.kind === 'everyone' ? 'globe' : 'user'}
        size={17}
      />
      {isUser && option.avatarAssetId && (
        <img
          className={`${styles.avatarImage} ui-media-fit`}
          src={`/api/assets/${option.avatarAssetId}/content`}
          alt=""
          style={{
            transform: `translate(${(option.avatarCropOffsetX ?? 0) * 100}%, ${(option.avatarCropOffsetY ?? 0) * 100}%) scale(${option.avatarCropZoom ?? 1})`
          }}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

export function MentionAutocomplete({
  id,
  suggestions,
  activeIndex,
  onActivate,
  onSelect
}: {
  id: string;
  suggestions: MentionSuggestions;
  activeIndex: number;
  onActivate: (index: number) => void;
  onSelect: (option: MentionOption) => void;
}) {
  const options = flattenMentionSuggestions(suggestions);
  const everyoneCount = suggestions.everyone ? 1 : 0;
  const roleStartIndex = everyoneCount + suggestions.users.length;

  if (options.length === 0) return null;

  return (
    <div className={styles.menu} id={id} role="listbox" aria-label="Упоминания">
      <span className={styles.groupLabel}>Участники</span>
      {options.map((option, index) => {
        const isFirstRole =
          index === roleStartIndex && suggestions.roles.length > 0;
        const optionId = `${id}-option-${index}`;

        return (
          <div key={option.key}>
            {isFirstRole && (
              <span className={styles.roleDivider} aria-hidden="true">
                <span>Роли</span>
              </span>
            )}
            <button
              className={`${styles.option} ${
                index === activeIndex ? styles.optionActive : ''
              }`}
              id={optionId}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              data-mention-kind={option.kind}
              onMouseEnter={() => onActivate(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(option)}
            >
              <MentionOptionAvatar option={option} />
              <span className={styles.optionText}>
                <strong>
                  {option.kind === 'everyone' ? 'Все участники' : option.label}
                </strong>
                <small>
                  {option.secondaryLabel ??
                    (option.kind === 'role'
                      ? `@${option.label}`
                      : option.token)}
                </small>
              </span>
              {option.kind === 'role' && (
                <span className={styles.kindBadge}>Роль</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
