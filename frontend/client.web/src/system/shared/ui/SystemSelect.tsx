import {
  type CSSProperties,
  Children,
  Fragment,
  type OptionHTMLAttributes,
  type ReactNode,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';

import { useDismissableLayer } from '../hooks/useDismissableLayer';
import { SystemIcon } from '../icons/SystemIcon';
import {
  type SystemSelectPhase,
  type SystemSelectPopupPosition,
  getNextSystemSelectOptionIndex,
  getSystemSelectCloseDelayMs,
  resolveSystemSelectPopupPosition
} from './systemSelectModel';

import styles from './SystemSelect.module.css';

type SystemSelectOption = {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
};

type SystemSelectProps = {
  children: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

function prefersReducedMotion() {
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

function getNodeText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      if (!isValidElement<{ children?: ReactNode }>(child)) return '';
      return getNodeText(child.props.children);
    })
    .join('')
    .trim();
}

function collectOptions(
  children: ReactNode,
  target: SystemSelectOption[] = []
) {
  Children.forEach(children, (child) => {
    if (!isValidElement<OptionHTMLAttributes<HTMLOptionElement>>(child)) return;

    if (child.type === Fragment) {
      collectOptions(child.props.children, target);
      return;
    }

    if (child.type !== 'option') return;

    const text = getNodeText(child.props.children);
    const rawValue = child.props.value ?? text;
    target.push({
      value: Array.isArray(rawValue)
        ? String(rawValue[0] ?? '')
        : String(rawValue),
      label: child.props.children,
      text,
      disabled: Boolean(child.props.disabled)
    });
  });

  return target;
}

function getInitialActiveIndex(
  options: readonly SystemSelectOption[],
  value: string
) {
  const selectedIndex = options.findIndex(
    (option) => option.value === value && !option.disabled
  );
  if (selectedIndex >= 0) return selectedIndex;
  return options.findIndex((option) => !option.disabled);
}

export function SystemSelect({
  children,
  value,
  onValueChange,
  id,
  name,
  className = '',
  disabled = false,
  title,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy
}: SystemSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `${generatedId}-trigger`;
  const listboxId = `${generatedId}-listbox`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<SystemSelectPhase>('closed');
  const closeTimerRef = useRef<number | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const typeaheadRef = useRef({ query: '', expiresAt: 0 });
  const [phase, setPhase] = useState<SystemSelectPhase>('closed');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [popupPosition, setPopupPosition] =
    useState<SystemSelectPopupPosition | null>(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0] ?? null;
  const isMounted = phase !== 'closed';
  const isOpen = phase === 'opening' || phase === 'open';

  const setSelectPhase = useCallback((nextPhase: SystemSelectPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const clearAnimationWork = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openFrameRef.current !== null) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
  }, []);

  const closeDropdown = useCallback(
    (restoreFocus = false) => {
      if (phaseRef.current === 'closed' || phaseRef.current === 'closing') {
        return;
      }

      clearAnimationWork();
      setSelectPhase('closing');
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null;
        setSelectPhase('closed');
        setPopupPosition(null);
        if (restoreFocus) triggerRef.current?.focus();
      }, getSystemSelectCloseDelayMs(prefersReducedMotion()));
    },
    [clearAnimationWork, setSelectPhase]
  );

  const openDropdown = useCallback(() => {
    if (disabled || options.length === 0) return;

    clearAnimationWork();
    setActiveIndex(getInitialActiveIndex(options, value));
    setSelectPhase('opening');
    openFrameRef.current = window.requestAnimationFrame(() => {
      openFrameRef.current = window.requestAnimationFrame(() => {
        openFrameRef.current = null;
        setSelectPhase('open');
      });
    });
  }, [clearAnimationWork, disabled, options, setSelectPhase, value]);

  const updatePopupPosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const contentHeight = Math.max(menu.scrollHeight, options.length * 41 + 12);
    setPopupPosition(
      resolveSystemSelectPopupPosition({
        trigger: triggerRect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        contentHeight
      })
    );
  }, [options.length]);

  useDismissableLayer({
    isOpen,
    layerRef: menuRef,
    triggerRef,
    onDismiss: closeDropdown
  });

  useLayoutEffect(() => {
    if (!isMounted) return undefined;

    updatePopupPosition();
    const updateFromViewport = () => updatePopupPosition();
    document.addEventListener('scroll', updateFromViewport, true);
    window.addEventListener('resize', updateFromViewport);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateFromViewport);
    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (menuRef.current) resizeObserver?.observe(menuRef.current);

    return () => {
      document.removeEventListener('scroll', updateFromViewport, true);
      window.removeEventListener('resize', updateFromViewport);
      resizeObserver?.disconnect();
    };
  }, [isMounted, updatePopupPosition]);

  useEffect(() => {
    if (!disabled) return;
    closeDropdown();
  }, [closeDropdown, disabled]);

  useEffect(
    () => () => {
      clearAnimationWork();
    },
    [clearAnimationWork]
  );

  function moveActive(direction: 1 | -1) {
    setActiveIndex((current) =>
      getNextSystemSelectOptionIndex({
        activeIndex: current,
        direction,
        disabled: options.map((option) => option.disabled)
      })
    );
  }

  function chooseOption(option: SystemSelectOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    closeDropdown(true);
  }

  function moveToBoundary(boundary: 'first' | 'last') {
    const indices = options.map((_, index) => index);
    const available = indices.filter((index) => !options[index]?.disabled);
    setActiveIndex(
      boundary === 'first' ? (available[0] ?? -1) : (available.at(-1) ?? -1)
    );
  }

  function moveFromTypeahead(key: string) {
    const now = Date.now();
    const previous = typeaheadRef.current;
    const query =
      `${now <= previous.expiresAt ? previous.query : ''}${key}`.toLocaleLowerCase();
    typeaheadRef.current = { query, expiresAt: now + 700 };

    const startIndex = Math.max(activeIndex, -1);
    const ordered = options.map(
      (_, offset) => (startIndex + offset + 1) % options.length
    );
    const match = ordered.find(
      (index) =>
        !options[index]?.disabled &&
        options[index]?.text.toLocaleLowerCase().startsWith(query)
    );
    if (match !== undefined) setActiveIndex(match);
  }

  const popupStyle = popupPosition
    ? ({
        top: popupPosition.top,
        left: popupPosition.left,
        width: popupPosition.width,
        maxHeight: popupPosition.maxHeight
      } satisfies CSSProperties)
    : ({ visibility: 'hidden' } satisfies CSSProperties);

  return (
    <span className={`${styles.root} ${className}`}>
      <button
        ref={triggerRef}
        className={styles.trigger}
        id={triggerId}
        type="button"
        title={title}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        role="combobox"
        aria-autocomplete="none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isMounted ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        data-open={isOpen}
        disabled={disabled || options.length === 0}
        onClick={() => {
          if (phaseRef.current === 'closed' || phaseRef.current === 'closing') {
            openDropdown();
          } else {
            closeDropdown();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) openDropdown();
            else moveActive(event.key === 'ArrowDown' ? 1 : -1);
            return;
          }

          if (!isOpen) return;

          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            moveToBoundary(event.key === 'Home' ? 'first' : 'last');
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const option = options[activeIndex];
            if (option) chooseOption(option);
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            closeDropdown(true);
            return;
          }

          if (event.key === 'Tab') {
            closeDropdown();
            return;
          }

          if (
            event.key.length === 1 &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          ) {
            moveFromTypeahead(event.key);
          }
        }}
      >
        <span>{selectedOption?.label ?? ''}</span>
        <SystemIcon className={styles.icon} name="chevron-down" size={16} />
      </button>
      {name ? (
        <input type="hidden" name={name} value={value} disabled={disabled} />
      ) : null}
      {isMounted && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.menu}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              aria-labelledby={
                ariaLabel ? undefined : (ariaLabelledBy ?? triggerId)
              }
              data-state={phase}
              data-placement={popupPosition?.placement ?? 'bottom'}
              data-dismissable-layer-branch
              style={popupStyle}
            >
              {options.map((option, index) => (
                <div
                  className={styles.option}
                  id={`${listboxId}-option-${index}`}
                  key={`${option.value}-${index}`}
                  role="option"
                  aria-disabled={option.disabled}
                  aria-selected={option.value === value}
                  data-active={index === activeIndex}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => chooseOption(option)}
                  onPointerMove={() => {
                    if (!option.disabled) setActiveIndex(index);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === value ? (
                    <SystemIcon name="check" size={16} />
                  ) : null}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </span>
  );
}
