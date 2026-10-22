import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  fieldClassName?: string;
  inputClassName?: string;
}

const toDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const dateValue = (date: Date) => date.toISOString().slice(0, 10);
const monthStart = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

function DatePickerField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required = false,
  fieldClassName = '',
  inputClassName = '',
}: DatePickerFieldProps) {
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(toDate(value) ?? new Date()));
  const parsedValue = toDate(value);
  const year = visibleMonth.getUTCFullYear();
  const month = visibleMonth.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingDays = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2023, 0, 2 + index)),
    ),
  );
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(visibleMonth);
  const selectedLabel = parsedValue
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' }).format(parsedValue)
    : label;

  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      return undefined;
    }
    const alignWithinViewport = () => {
      const popover = popoverRef.current;
      if (!popover) return;
      setAlignRight(popover.getBoundingClientRect().right > document.documentElement.clientWidth - 12);
    };
    alignWithinViewport();
    window.addEventListener('resize', alignWithinViewport);
    return () => window.removeEventListener('resize', alignWithinViewport);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  function selectDate(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  return <div className={`date-picker-control ${fieldClassName}`}>
    <label htmlFor={id}>{label}</label>
    <div className="date-picker-field" ref={rootRef}>
      <input
        id={id}
        className={inputClassName}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        ref={triggerRef}
        className="date-picker-trigger"
        type="button"
        aria-label={`Open calendar for ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          setVisibleMonth(monthStart(toDate(value) ?? new Date()));
          setOpen((current) => !current);
        }}
      ><CalendarDays size={18} aria-hidden="true" /></button>
      {open ? <div ref={popoverRef} className={`date-picker-popover${alignRight ? ' is-align-right' : ''}`} id={popoverId} role="dialog" aria-label={`Calendar for ${label}`}>
        <div className="date-picker-header">
          <button type="button" aria-label="Previous month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))}><ChevronLeft size={18} aria-hidden="true" /></button>
          <h3 aria-live="polite">{monthLabel}</h3>
          <button type="button" aria-label="Next month" onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))}><ChevronRight size={18} aria-hidden="true" /></button>
        </div>
        <div className="date-picker-weekdays" aria-hidden="true">
          {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
        </div>
        <div className="date-picker-days" role="group" aria-label={`${monthLabel} dates`}>
          {Array.from({ length: cellCount }, (_, index) => {
            const day = index - leadingDays + 1;
            if (day < 1 || day > daysInMonth) return <span className="date-picker-blank" key={`blank-${index}`} aria-hidden="true" />;
            const date = new Date(Date.UTC(year, month, day));
            const currentValue = dateValue(date);
            const disabled = (min !== undefined && currentValue < min) || (max !== undefined && currentValue > max);
            const isSelected = currentValue === value;
            const isToday = currentValue === dateValue(new Date());
            const dayLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' }).format(date);
            return <button
              key={currentValue}
              className={`date-picker-day${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              type="button"
              aria-label={dayLabel}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              disabled={disabled}
              onClick={() => selectDate(currentValue)}
            >{day}</button>;
          })}
        </div>
        <div className="date-picker-footer">
          <span>{selectedLabel}</span>
          <button
            type="button"
            disabled={(min !== undefined && dateValue(new Date()) < min) || (max !== undefined && dateValue(new Date()) > max)}
            onClick={() => selectDate(dateValue(new Date()))}
          >Today</button>
        </div>
      </div> : null}
    </div>
  </div>;
}

export { DatePickerField };
