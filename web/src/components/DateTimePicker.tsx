import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { guestApi } from '../api/client';
import type { TimeSlot, EventType } from '../api/types';
import {
  todayISO,
  addUTCDays,
  formatTime,
  getDaysInMonth,
  getFirstDayOfMonthUTC,
  addUTCMonth,
  startOfWeekToDate,
  dateFromISO,
  dateToISO,
  getWeekNumber,
  isFuture,
} from '../lib/format';

type Variant = 'daily' | 'weekly' | 'monthly' | 'timeline';

interface DateTimePickerProps {
  eventTypeId: string;
  eventType: EventType;
  selectedSlot: TimeSlot | null;
  onSlotSelect: (slot: TimeSlot) => void;
  onBack: () => void;
}

interface FetchState {
  slots: TimeSlot[];
  loading: boolean;
  error: string | null;
}

export default function DateTimePicker({
  eventTypeId,
  eventType,
  selectedSlot,
  onSlotSelect,
  onBack,
}: DateTimePickerProps) {
  const [variant, setVariant] = useState<Variant>('daily');
  const [currentDate, setCurrentDate] = useState(() => todayISO());
  const [fetchState, setFetchState] = useState<FetchState>({ slots: [], loading: false, error: null });
  const fetchIdRef = useRef(0);

  const fetchSlots = useCallback(async (dateFrom: string, dateTo: string) => {
    const fetchId = ++fetchIdRef.current;
    setFetchState({ slots: [], loading: true, error: null });
    try {
      const slots = await guestApi.getAvailableSlots(eventTypeId, dateFrom, dateTo);
      if (fetchId === fetchIdRef.current) {
        setFetchState({ slots, loading: false, error: null });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось загрузить слоты';
      if (fetchId === fetchIdRef.current) {
        setFetchState({ slots: [], loading: false, error: msg });
      }
    }
  }, [eventTypeId]);

  const loadSlotsForRange = useCallback((dateFrom: string, dateTo: string) => {
    fetchSlots(dateFrom, dateTo);
  }, [fetchSlots]);

  useEffect(() => {
    if (variant === 'daily') {
      loadSlotsForRange(currentDate, currentDate);
    }
  }, [variant, currentDate, loadSlotsForRange]);

  useEffect(() => {
    if (variant === 'weekly') {
      const startOfWeek = startOfWeekToDate(currentDate);
      const endOfWeek = addUTCDays(startOfWeek, 6);
      loadSlotsForRange(dateToISO(startOfWeek), dateToISO(endOfWeek));
    }
  }, [variant, currentDate, loadSlotsForRange]);

  useEffect(() => {
    if (variant === 'monthly') {
      const parts = currentDate.split('-');
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const daysInMonth = getDaysInMonth(year, month);
      const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      loadSlotsForRange(currentDate, lastDay);
    }
  }, [variant, currentDate, loadSlotsForRange]);

  useEffect(() => {
    if (variant === 'timeline') {
      const from = currentDate;
      const to = dateToISO(addUTCDays(startOfWeekToDate(currentDate), 14));
      loadSlotsForRange(from, to);
    }
  }, [variant, currentDate, loadSlotsForRange]);

  const navigatePrev = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      const step = variant === 'monthly' ? -1 : variant === 'weekly' ? -7 : -1;
      const next = variant === 'monthly' ? addUTCMonth(date, step) : addUTCDays(date, step);
      return dateToISO(next);
    });
  }, [variant]);

  const navigateNext = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      const step = variant === 'monthly' ? 1 : variant === 'weekly' ? 7 : 1;
      const next = variant === 'monthly' ? addUTCMonth(date, step) : addUTCDays(date, step);
      return dateToISO(next);
    });
  }, [variant]);

  const navigatePrevWeek = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      return dateToISO(addUTCDays(date, -7));
    });
  }, []);

  const navigateNextWeek = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      return dateToISO(addUTCDays(date, 7));
    });
  }, []);

  const navigatePrevMonth = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      return dateToISO(addUTCMonth(date, -1));
    });
  }, []);

  const navigateNextMonth = useCallback(() => {
    setCurrentDate((prev: string) => {
      const date = dateFromISO(prev);
      return dateToISO(addUTCMonth(date, 1));
    });
  }, []);

  const handleSlotClick = useCallback((slot: TimeSlot) => {
    if (!slot.isAvailable) return;
    onSlotSelect(slot);
  }, [onSlotSelect]);

  const isSelected = useCallback((slotStartTime: string): boolean => {
    return selectedSlot?.startTime === slotStartTime;
  }, [selectedSlot]);

  const navLabel = useMemo(() => {
    const d = dateFromISO(currentDate);
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, [currentDate]);

  const sortedSlots = useMemo(
    () => [...fetchState.slots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [fetchState.slots]
  );

  const availableCount = useMemo(
    () => fetchState.slots.filter((s: TimeSlot) => s.isAvailable).length,
    [fetchState.slots]
  );

  return (
    <div className="datetime-picker">
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={onBack}>← Назад</button>
        <h3 style={{ margin: 0 }}>{eventType.title}</h3>
      </div>

      <div className="picker-header">
        <div className="variant-tabs">
          {(['daily', 'weekly', 'monthly', 'timeline'] as Variant[]).map((v) => (
            <button
              key={v}
              className={`btn ${variant === v ? 'primary' : ''}`}
              onClick={() => { setVariant(v); setCurrentDate(todayISO()); }}
            >
              {v === 'daily' ? 'День' : v === 'weekly' ? 'Неделя' : v === 'monthly' ? 'Месяц' : 'Лента'}
            </button>
          ))}
        </div>
      </div>

      <div className="picker-nav">
        <button className="btn" onClick={navigatePrev}>‹</button>
        <span className="nav-label">{navLabel}</span>
        <button className="btn" onClick={navigateNext}>›</button>
      </div>

      {fetchState.loading && <div className="empty">Загрузка слотов…</div>}
      {fetchState.error && <div className="err">{fetchState.error}</div>}

      {!fetchState.loading && !fetchState.error && (
        <div className="picker-body">
          {variant === 'daily' && (
            <DailyView
              slots={sortedSlots}
              currentDate={currentDate}
              onSlotClick={handleSlotClick}
              isSelected={isSelected}
              isSlotInFuture={isFuture}
            />
          )}
          {variant === 'weekly' && (
            <WeeklyView
              slots={fetchState.slots}
              currentDate={currentDate}
              onSlotClick={handleSlotClick}
              isSelected={isSelected}
              isSlotInFuture={isFuture}
              navigatePrevWeek={navigatePrevWeek}
              navigateNextWeek={navigateNextWeek}
            />
          )}
          {variant === 'monthly' && (
            <MonthlyView
              slots={fetchState.slots}
              currentDate={currentDate}
              onDateClick={(dateStr) => { setCurrentDate(dateStr); setVariant('daily'); }}
              navigatePrevMonth={navigatePrevMonth}
              navigateNextMonth={navigateNextMonth}
            />
          )}
          {variant === 'timeline' && (
            <TimelineView
              slots={sortedSlots}
              currentDate={currentDate}
              onSlotClick={handleSlotClick}
              isSelected={isSelected}
              isSlotInFuture={isFuture}
            />
          )}
        </div>
      )}

      {availableCount === 0 && !fetchState.loading && !fetchState.error && (
        <div className="empty">Нет свободных слотов</div>
      )}
    </div>
  );
}

function DailyView({ slots, currentDate, onSlotClick, isSelected, isSlotInFuture }: {
  slots: TimeSlot[];
  currentDate: string;
  onSlotClick: (slot: TimeSlot) => void;
  isSelected: (startTime: string) => boolean;
  isSlotInFuture: (slotTime: string) => boolean;
}) {
  return (
    <div className="daily-view">
      <div className="day-header">
        <span className="day-name">
          {new Date(Date.UTC(Number(currentDate.split('-')[0]), Number(currentDate.split('-')[1]) - 1, Number(currentDate.split('-')[2]))).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>
      {slots.length === 0 ? (
        <div className="empty">Нет слотов на этот день</div>
      ) : (
        <div className="slots-list">
          {slots.map((slot: TimeSlot) => (
            <button
              key={slot.startTime}
              className={`slot-btn ${isSelected(slot.startTime) ? 'selected' : ''} ${!slot.isAvailable ? 'unavailable' : ''} ${!isSlotInFuture(slot.startTime) ? 'past' : ''}`}
              onClick={() => onSlotClick(slot)}
              disabled={!slot.isAvailable || !isSlotInFuture(slot.startTime)}
            >
              <span className="slot-time">{formatTime(slot.startTime)} — {formatTime(slot.endTime)}</span>
              <span className="slot-status">
                {!slot.isAvailable ? 'Занят' : !isSlotInFuture(slot.startTime) ? 'Прошёл' : 'Свободен'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WeeklyView({ slots, currentDate, onSlotClick, isSelected, isSlotInFuture, navigatePrevWeek, navigateNextWeek }: {
  slots: TimeSlot[];
  currentDate: string;
  onSlotClick: (slot: TimeSlot) => void;
  isSelected: (startTime: string) => boolean;
  isSlotInFuture: (slotTime: string) => boolean;
  navigatePrevWeek: () => void;
  navigateNextWeek: () => void;
}) {
  const days = useMemo(() => {
    const startOfWeek = startOfWeekToDate(currentDate);
    const weekDays: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = addUTCDays(startOfWeek, i);
      weekDays.push(dateToISO(d));
    }
    return weekDays;
  }, [currentDate]);

  const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];

  const slotsByDay = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const day of days) {
      map.set(day, []);
    }
    for (const slot of slots) {
      const slotDate = slot.startTime.slice(0, 10);
      if (map.has(slotDate)) {
        map.get(slotDate)!.push(slot);
      }
    }
    return map;
  }, [slots, days]);

  return (
    <div className="weekly-view">
      <div className="week-nav">
        <button className="btn" onClick={navigatePrevWeek}>‹ Неделя назад</button>
        <span>Неделя {getWeekNumber(currentDate)}</span>
        <button className="btn" onClick={navigateNextWeek}>Неделя вперёд ›</button>
      </div>
      <div className="week-grid">
        {days.map((day: string, i: number) => {
          const daySlots = slotsByDay.get(day) || [];
          const dayName = weekDayNames[i];
          return (
            <div key={day} className="week-day">
              <div className="week-day-header">{dayName}</div>
              <div className="week-day-slots">
                {daySlots.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  daySlots.map((slot: TimeSlot) => (
                    <button
                      key={slot.startTime}
                      className={`slot-btn ${isSelected(slot.startTime) ? 'selected' : ''} ${!slot.isAvailable ? 'unavailable' : ''} ${!isSlotInFuture(slot.startTime) ? 'past' : ''}`}
                      onClick={() => onSlotClick(slot)}
                      disabled={!slot.isAvailable || !isSlotInFuture(slot.startTime)}
                    >
                      <span className="slot-time">{formatTime(slot.startTime)}</span>
                      <span className="slot-status">
                        {!slot.isAvailable ? 'Занят' : !isSlotInFuture(slot.startTime) ? 'Прошёл' : 'Свободен'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyView({ slots, currentDate, onDateClick, navigatePrevMonth, navigateNextMonth }: {
  slots: TimeSlot[];
  currentDate: string;
  onDateClick: (dateStr: string) => void;
  navigatePrevMonth: () => void;
  navigateNextMonth: () => void;
}) {
  const parts = currentDate.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfWeek = getFirstDayOfMonthUTC(year, month);

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const dateStr = slot.startTime.slice(0, 10);
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(slot);
    }
    return map;
  }, [slots]);

  const calendarDays: (string | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const today = todayISO();

  return (
    <div className="monthly-view">
      <div className="month-header">
        <button className="btn" onClick={navigatePrevMonth}>‹</button>
        <span className="month-name">{new Date(Date.UTC(year, month - 1)).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
        <button className="btn" onClick={navigateNextMonth}>›</button>
      </div>
      <div className="month-grid">
        <div className="month-day-names">
          {dayNames.map((name) => (
            <span key={name} className="month-day-name">{name}</span>
          ))}
        </div>
        <div className="month-days">
          {calendarDays.map((dateStr: string | null, i: number) => {
            if (dateStr === null) return <span key={`empty-${i}`} className="month-empty" />;
            const dayNum = Number(dateStr.split('-')[2]);
            const isT = dateStr === today;
            const daySlots = slotsByDate.get(dateStr) || [];
            const hasAvailable = daySlots.some((s: TimeSlot) => s.isAvailable && isFuture(s.startTime));
            return (
              <button
                key={dateStr}
                className={`month-cell ${isT ? 'today' : ''} ${hasAvailable ? 'has-slots' : ''}`}
                onClick={() => onDateClick(dateStr)}
              >
                <span className="month-cell-day">{dayNum}</span>
                {hasAvailable && <span className="month-cell-dot" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TimelineView({ slots, currentDate, onSlotClick, isSelected, isSlotInFuture }: {
  slots: TimeSlot[];
  currentDate: string;
  onSlotClick: (slot: TimeSlot) => void;
  isSelected: (startTime: string) => boolean;
  isSlotInFuture: (slotTime: string) => boolean;
}) {
  return (
    <div className="timeline-view">
      <div className="timeline-header">
        <span>Слоты за {currentDate} — {dateToISO(addUTCDays(dateFromISO(currentDate), 14))}</span>
      </div>
      {slots.length === 0 ? (
        <div className="empty">Нет слотов</div>
      ) : (
        <div className="timeline">
          {slots.map((slot: TimeSlot) => (
            <div
              key={slot.startTime}
              className={`timeline-item ${isSelected(slot.startTime) ? 'selected' : ''} ${!slot.isAvailable ? 'unavailable' : ''} ${!isSlotInFuture(slot.startTime) ? 'past' : ''}`}
            >
              <button
                className="timeline-btn"
                onClick={() => onSlotClick(slot)}
                disabled={!slot.isAvailable || !isSlotInFuture(slot.startTime)}
              >
                <span className="timeline-time">{formatTime(slot.startTime)}</span>
                <span className="timeline-duration">{formatTime(slot.endTime)}</span>
                <span className="timeline-status">
                  {!slot.isAvailable ? 'Занят' : !isSlotInFuture(slot.startTime) ? 'Прошёл' : 'Свободен'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
