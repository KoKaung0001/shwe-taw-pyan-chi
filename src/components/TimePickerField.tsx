import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

interface TimePickerFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  fieldClassName?: string;
  inputClassName?: string;
}

interface TimeOptionColumnProps {
  id: string;
  label: string;
  options: number[];
  value: number;
  formatOption: (value: number) => string;
  onChange: (value: number) => void;
  focusOnMount?: boolean;
}

function TimeOptionColumn({ id, label, options, value, formatOption, onChange, focusOnMount = false }: TimeOptionColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedOptionId = `${id}-option-${value}`;

  useEffect(() => {
    if (!listRef.current) return;
    document.getElementById(selectedOptionId)?.scrollIntoView({ block: 'center' });
  }, [selectedOptionId]);

  useEffect(() => {
    if (focusOnMount) listRef.current?.focus();
  }, [focusOnMount]);

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const currentIndex = options.indexOf(value);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, currentIndex + 1);
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = options.length - 1;
    else if (event.key === 'PageDown') nextIndex = Math.min(options.length - 1, currentIndex + 5);
    else if (event.key === 'PageUp') nextIndex = Math.max(0, currentIndex - 5);
    else return;
    event.preventDefault();
    if (nextIndex !== currentIndex) onChange(options[nextIndex]);
  }

  return <div className="time-picker-column">
    <span className="time-picker-column-label">{label}</span>
    <div
      ref={listRef}
      className="time-picker-options"
      role="listbox"
      aria-label={label}
      aria-activedescendant={selectedOptionId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {options.map((option) => {
        const selected = option === value;
        return <div
          key={option}
          id={`${id}-option-${option}`}
          className={`time-picker-option${selected ? ' is-selected' : ''}`}
          role="option"
          aria-selected={selected}
          onClick={() => {
            onChange(option);
            listRef.current?.focus();
          }}
        >{formatOption(option)}</div>;
      })}
    </div>
  </div>;
}

function TimePickerField({ id, label, value, onChange, fieldClassName = '', inputClassName = '' }: TimePickerFieldProps) {
  const { t } = useTranslation();
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [alignAbove, setAlignAbove] = useState(false);
  const timePattern = /^(\d{2}):(\d{2})$/;
  const matchedTime = timePattern.exec(value);
  const hour24 = matchedTime ? Number(matchedTime[1]) : 0;
  const minute = matchedTime ? Number(matchedTime[2]) : 0;
  const usesTwelveHourClock = ['h11', 'h12'].includes(
    new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle ?? 'h23',
  );
  const hourValue = usesTwelveHourClock ? (hour24 % 12 || 12) : hour24;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hourOptions = usesTwelveHourClock
    ? Array.from({ length: 12 }, (_, index) => index + 1)
    : Array.from({ length: 24 }, (_, index) => index);
  const minuteOptions = Array.from({ length: 60 }, (_, index) => index);
  const formattedTime = matchedTime
    ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour24, minute))
    : t('opening.selectTime', { defaultValue: 'Select time' });

  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      setAlignAbove(false);
      return undefined;
    }
    const alignWithinViewport = () => {
      const popover = popoverRef.current;
      if (!popover) return;
      const bounds = popover.getBoundingClientRect();
      setAlignRight(bounds.right > document.documentElement.clientWidth - 12);
      setAlignAbove(bounds.bottom > window.innerHeight - 12 && bounds.top > bounds.height + 12);
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

  function updateHour(nextHour: number) {
    const localHour = usesTwelveHourClock
      ? (nextHour % 12) + (period === 'PM' ? 12 : 0)
      : nextHour;
    onChange(`${String(localHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  function updateMinute(nextMinute: number) {
    onChange(`${String(hour24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`);
  }

  function updatePeriod(nextPeriod: 'AM' | 'PM') {
    const localHour = (hour24 % 12) + (nextPeriod === 'PM' ? 12 : 0);
    onChange(`${String(localHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  return <div className={`time-picker-control ${fieldClassName}`}>
    <label htmlFor={id}>{label}</label>
    <div className="time-picker-field" ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        className={`time-picker-trigger ${inputClassName}`}
        type="button"
        aria-label={`${label}: ${formattedTime}`}
        aria-required="true"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
      ><span>{formattedTime}</span><Clock3 size={18} aria-hidden="true" /></button>
      {open ? <div
        ref={popoverRef}
        className={`time-picker-popover${alignRight ? ' is-align-right' : ''}${alignAbove ? ' is-align-above' : ''}`}
        id={popoverId}
        role="dialog"
        aria-label={label}
      >
        <div className="time-picker-header"><h3>{label}</h3></div>
        <div className={`time-picker-columns${usesTwelveHourClock ? ' has-period' : ''}`}>
          <TimeOptionColumn
            id={`${popoverId}-hour`}
            label={t('opening.hour', { defaultValue: 'Hour' })}
            options={hourOptions}
            value={hourValue}
            formatOption={(option) => usesTwelveHourClock ? String(option) : String(option).padStart(2, '0')}
            onChange={updateHour}
            focusOnMount
          />
          <TimeOptionColumn
            id={`${popoverId}-minute`}
            label={t('opening.minute', { defaultValue: 'Minute' })}
            options={minuteOptions}
            value={minute}
            formatOption={(option) => String(option).padStart(2, '0')}
            onChange={updateMinute}
          />
          {usesTwelveHourClock ? <div className="time-picker-column">
            <span className="time-picker-column-label">{t('opening.period', { defaultValue: 'Period' })}</span>
            <div className="time-picker-period" role="group" aria-label={t('opening.period', { defaultValue: 'Period' })}>
              {(['AM', 'PM'] as const).map((option) => <button
                key={option}
                type="button"
                aria-pressed={period === option}
                className={`time-picker-option time-picker-period-option${period === option ? ' is-selected' : ''}`}
                onClick={() => updatePeriod(option)}
              >{option}</button>)}
            </div>
          </div> : null}
        </div>
        <div className="time-picker-footer">
          <span>{formattedTime}</span>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{t('form.done', { defaultValue: 'Done' })}</button>
        </div>
      </div> : null}
    </div>
  </div>;
}

export { TimePickerField };
