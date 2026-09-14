import { useMemo } from 'react';
import { toDateInputValue } from '../lib/format';

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  month?: Date;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  hasSlots?: (date: string) => boolean;
  loading?: boolean;
}

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_LABELS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** День недели (0=Пн … 6=Вс) */
function dayOfWeek(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isPast(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cmp = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return cmp.getTime() < today.getTime();
}

function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export default function Calendar({
  selectedDate,
  onSelectDate,
  month,
  onPrevMonth,
  onNextMonth,
  hasSlots,
  loading,
}: CalendarProps) {
  const currentMonth = month ?? new Date();

  const days = useMemo(() => {
    const firstDay = startOfMonth(currentMonth);
    const totalDays = getDaysInMonth(currentMonth);
    const offset = dayOfWeek(firstDay);
    const result: (Date | null)[] = [];

    for (let i = 0; i < offset; i++) {
      result.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      result.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    }
    return result;
  }, [currentMonth]);

  const today = new Date();

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          className="calendar-nav-btn"
          onClick={onPrevMonth}
          disabled={!onPrevMonth}
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <span className="calendar-title">
          {MONTH_LABELS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button
          className="calendar-nav-btn"
          onClick={onNextMonth}
          disabled={!onNextMonth}
          aria-label="Следующий месяц"
        >
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="calendar-day empty" />;
          }

          const iso = toDateInputValue(day);
          const isSelected = iso === selectedDate;
          const past = isPast(day);
          const weekend = isWeekend(day);
          const todayMatch = isSameDay(day, today);
          const slots = hasSlots ? hasSlots(iso) : undefined;

          const classes = [
            'calendar-day',
            past && 'past',
            weekend && 'weekend',
            todayMatch && 'today',
            isSelected && 'selected',
            slots === true && 'has-slots',
            slots === false && 'no-slots',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={iso}
              className={classes}
              disabled={past || weekend || loading}
              onClick={() => onSelectDate(iso)}
              aria-label={`${day.getDate()} ${MONTH_LABELS[day.getMonth()]}`}
            >
              <span className="calendar-day-number">{day.getDate()}</span>
              {slots === true && !past && <span className="calendar-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
