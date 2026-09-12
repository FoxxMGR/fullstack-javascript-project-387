import { useCallback, useEffect, useMemo, useState } from 'react';
import { guestApi, ApiError } from '../api/client';
import type { TimeSlot } from '../api/types';
import { formatTime } from '../lib/format';

type ViewMode = 'monthly' | 'daily';

interface DatePickerProps {
  eventTypeId: string;
  durationMinutes?: number;
  onSlotSelected: (slot: TimeSlot) => void;
}

const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTH_LABELS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function getDaysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function isPast(d: Date): boolean {
  const now = new Date();
  return d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export default function DatePicker({
  eventTypeId,
  onSlotSelected,
}: DatePickerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [allSlots, setAllSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async (month: Date) => {
    setLoading(true);
    setError(null);
    try {
      const dateFrom = toDateKey(month);
      const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const dateTo = toDateKey(lastDay);
      const slots = await guestApi.getAvailableSlots(eventTypeId, dateFrom, dateTo);
      setAllSlots(slots);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось загрузить слоты');
      setAllSlots([]);
    } finally {
      setLoading(false);
    }
  }, [eventTypeId]);

  useEffect(() => {
    void loadSlots(currentMonth);
  }, [currentMonth, loadSlots]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of allSlots) {
      const key = slot.startTime.slice(0, 10);
      const list = map.get(key);
      if (list) {
        list.push(slot);
      } else {
        map.set(key, [slot]);
      }
    }
    return map;
  }, [allSlots]);

  const daySlots = useMemo(() => {
    if (!selectedDate) return [];
    const key = toDateKey(selectedDate);
    return slotsByDate.get(key) ?? [];
  }, [selectedDate, slotsByDate]);

  const availableCount = useCallback(
    (d: Date): number => {
      const key = toDateKey(d);
      const slots = slotsByDate.get(key);
      if (!slots) return 0;
      return slots.filter((s) => s.isAvailable).length;
    },
    [slotsByDate],
  );

  const handlePrevMonth = () => {
    setCurrentMonth((m) => addMonths(m, -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((m) => addMonths(m, 1));
  };

  const handleDayClick = (d: Date) => {
    if (isPast(d) || isWeekend(d)) return;
    if (availableCount(d) === 0) return;
    setSelectedDate(d);
    setViewMode('daily');
  };

  const handleBackToCalendar = () => {
    setViewMode('monthly');
    setSelectedDate(null);
  };

  const renderMonthly = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOffset = getFirstDayOfMonth(currentMonth);
    const today = new Date();
    const todayKey = toDateKey(today);

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }

    return (
      <div>
        <div className="dp-header">
          <button className="btn" onClick={handlePrevMonth} aria-label="Предыдущий месяц">
            &larr;
          </button>
          <h3 className="dp-title">
            {MONTH_LABELS[month]} {year}
          </h3>
          <button className="btn" onClick={handleNextMonth} aria-label="Следующий месяц">
            &rarr;
          </button>
        </div>
        <div className="dp-grid">
          {DAY_LABELS.map((label) => (
            <div className="dp-weekday" key={label}>
              {label}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div className="dp-cell dp-cell-empty" key={`empty-${i}`} />;
            const key = toDateKey(d);
            const past = isPast(d);
            const weekend = isWeekend(d);
            const count = availableCount(d);
            const isToday = key === todayKey;
            const disabled = past || weekend || count === 0;
            return (
              <button
                key={key}
                className={`dp-cell${isToday ? ' dp-today' : ''}${disabled ? ' dp-disabled' : ''}${count > 0 && !disabled ? ' dp-available' : ''}`}
                disabled={disabled}
                onClick={() => handleDayClick(d)}
              >
                <span className="dp-day">{d.getDate()}</span>
                {count > 0 && !disabled && (
                  <span className="dp-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {loading && <div className="dp-loading">Загрузка…</div>}
      </div>
    );
  };

  const renderDaily = () => {
    if (!selectedDate) return null;
    const dateLabel = selectedDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const available = daySlots.filter((s) => s.isAvailable);

    return (
      <div>
        <div className="dp-header">
          <button className="btn" onClick={handleBackToCalendar}>
            &larr; Календарь
          </button>
          <h3 className="dp-title">{dateLabel}</h3>
        </div>
        {loading ? (
          <div className="dp-loading">Загрузка…</div>
        ) : available.length === 0 ? (
          <div className="dp-empty">Нет свободных слотов на эту дату.</div>
        ) : (
          <div className="dp-timeline">
            {available.map((slot) => (
              <button
                key={slot.startTime}
                className="dp-slot"
                onClick={() => onSlotSelected(slot)}
              >
                <span className="dp-slot-time">{formatTime(slot.startTime)}</span>
                <span className="dp-slot-sep">—</span>
                <span className="dp-slot-time">{formatTime(slot.endTime)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="datepicker">
      {viewMode === 'monthly' ? renderMonthly() : renderDaily()}
      {error && <div className="err" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
