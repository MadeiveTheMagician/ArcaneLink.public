import styles from './SegmentedControl.module.css';

type SegmentedControlOption<TValue extends string> = {
  disabled?: boolean;
  label: string;
  value: TValue;
};

type SegmentedControlProps<TValue extends string> = {
  className?: string;
  label: string;
  onChange: (value: TValue) => void;
  options: Array<SegmentedControlOption<TValue>>;
  value: TValue;
};

export function SegmentedControl<TValue extends string>({
  className = '',
  label,
  onChange,
  options,
  value
}: SegmentedControlProps<TValue>) {
  return (
    <div
      className={`${styles.control} ${className}`}
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={`${styles.item} ${option.value === value ? styles.active : ''}`}
          disabled={option.disabled}
          role="tab"
          type="button"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
