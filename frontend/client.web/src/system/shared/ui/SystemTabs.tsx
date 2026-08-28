import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode
} from 'react';

import styles from './SystemTabs.module.css';

type SystemTabOption<TValue extends string> = {
  badge?: ReactNode;
  disabled?: boolean;
  label: string;
  value: TValue;
};

type SystemTabsProps<TValue extends string> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'onChange'
> & {
  idBase: string;
  label: string;
  onChange: (value: TValue) => void;
  options: readonly SystemTabOption<TValue>[];
  value: TValue;
};

type SystemTabPanelProps<TValue extends string> = Omit<
  HTMLAttributes<HTMLDivElement>,
  'id' | 'role'
> & {
  idBase: string;
  value: TValue;
};

type TabsStyle = CSSProperties & {
  '--system-tabs-columns': number;
  '--system-tabs-mobile-columns': number;
};

export function SystemTabs<TValue extends string>({
  className = '',
  idBase,
  label,
  onChange,
  options,
  style,
  value,
  ...props
}: SystemTabsProps<TValue>) {
  const tabsStyle: TabsStyle = {
    ...style,
    '--system-tabs-columns': Math.max(1, options.length),
    '--system-tabs-mobile-columns': Math.max(1, Math.min(2, options.length))
  };

  function moveFocus(
    event: KeyboardEvent<HTMLButtonElement>,
    optionIndex: number
  ) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }

    const enabledIndexes = options.flatMap((option, index) =>
      option.disabled ? [] : [index]
    );
    if (enabledIndexes.length === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = Math.max(0, enabledIndexes.indexOf(optionIndex));
    const targetIndex =
      event.key === 'Home'
        ? enabledIndexes[0]
        : event.key === 'End'
          ? enabledIndexes[enabledIndexes.length - 1]
          : event.key === 'ArrowRight'
            ? enabledIndexes[(currentIndex + 1) % enabledIndexes.length]
            : enabledIndexes[
                (currentIndex - 1 + enabledIndexes.length) %
                  enabledIndexes.length
              ];
    if (targetIndex === undefined) {
      return;
    }

    const nextOption = options[targetIndex];
    if (!nextOption) {
      return;
    }

    const tabList = event.currentTarget.parentElement;
    const nextTab = tabList?.querySelector<HTMLButtonElement>(
      `[data-system-tab-index="${targetIndex}"]`
    );

    nextTab?.focus();
    onChange(nextOption.value);
  }

  return (
    <div
      {...props}
      className={[styles.tabs, className].filter(Boolean).join(' ')}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      style={tabsStyle}
    >
      {options.map((option, index) => {
        const isActive = option.value === value;
        const ids = getSystemTabIds(idBase, option.value);

        return (
          <button
            className={styles.tab}
            data-system-tab-index={index}
            disabled={option.disabled}
            id={ids.tabId}
            key={option.value}
            role="tab"
            type="button"
            aria-controls={ids.panelId}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => moveFocus(event, index)}
          >
            <span className={styles.label}>{option.label}</span>
            {option.badge !== undefined ? (
              <span className={styles.badge}>{option.badge}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function SystemTabPanel<TValue extends string>({
  idBase,
  tabIndex = 0,
  value,
  ...props
}: SystemTabPanelProps<TValue>) {
  const ids = getSystemTabIds(idBase, value);

  return (
    <div
      {...props}
      id={ids.panelId}
      role="tabpanel"
      aria-labelledby={ids.tabId}
      tabIndex={tabIndex}
    />
  );
}

function getSystemTabIds(idBase: string, value: string) {
  const encodedValue = encodeURIComponent(value);

  return {
    panelId: `${idBase}-panel-${encodedValue}`,
    tabId: `${idBase}-tab-${encodedValue}`
  };
}
