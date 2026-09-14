import { useCallback, useEffect, useMemo, useState } from 'react';
import { guestApi, ApiError } from '../api/client';
import type { EventType, TimeSlot } from '../api/types';
import { addDays, formatDate, formatTime, toDateInputValue } from '../lib/format';
import Calendar from './Calendar';
import TimeSlots from './TimeSlots';

interface DateTimePickerProps {
  eventType: EventType;
  onSelectSlot: (slot: TimeSlot) => void;
  onBack: () => void;
}

export type ViewMode = 'monthly' | 'weekly' | 'daily' | 'timeline';

export default function DateTimePicker({
  eventType,
  onSelectSlot,
  onBack,
}: DateTimePickerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    toDateInputValue(new Date())
  );
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [weekRange, setWeekRange] = useState<{ from: string; to: string } | null>(null);

  const loadSlots = useCallback(
    async (dateFrom: string, dateTo: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await guestApi.getAvailableSlots(eventType.id, dateFrom, dateTo);
        setSlots(data);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Не удалось загрузить слоты');
        setSlots([]);
      } finally {
        setLoading(false);
      }
    },
    [eventType.id],
  );

  useEffect(() => {
    if (selectedDate) {
      void loadSlots(selectedDate, selectedDate);
    }
  }, [selectedDate, loadSlots]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handlePrevWeek = () => {
    if (!weekRange) return;
    const prevFrom = addDays(new Date(weekRange.from), -7);
    const prevTo = addDays(prevFrom, 6);
    setWeekRange({
      from: toDateInputValue(prevFrom),
      to: toDateInputValue(prevTo),
    });
  };

  const handleNextWeek = () => {
    if (!weekRange) return;
    const nextFrom = addDays(new Date(weekRange.from), 7);
    const nextTo = addDays(nextFrom, 6);
    setWeekRange({
      from: toDateInputValue(nextFrom),
      to: toDateInputValue(nextTo),
    });
  };

  const startWeekly = () => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7;
    const monday = addDays(today, -dow);
    const sunday = addDays(monday, 6);
    setWeekRange({
      from: toDateInputValue(monday),
      to: toDateInputValue(sunday),
    });
    setViewMode('weekly');
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleConfirmSlot = () => {
    if (selectedSlot) {
      onSelectSlot(selectedSlot);
    }
  };

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  const weeklySlots = useMemo(() => {
    if (viewMode !== 'weekly' || !weekRange) return [];
    return slots;
  }, [viewMode, weekRange, slots]);

  const weeklyDays = useMemo(() => {
    if (!weekRange) return [];
    const from = new Date(weekRange.from);
    const result: { date: string; label: string; dayName: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      const iso = toDateInputValue(d);
      result.push({
        date: iso,
        label: `${d.getDate()} ${d.getMonth() + 1}`,
        dayName: dayNames[d.getDay()],
      });
    }
    return result;
  }, [weekRange]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, TimeSlot[]> = {};
    for (const slot of weeklySlots) {
      const d = new Date(slot.startTime);
      const key = toDateInputValue(d);
      if (!map[key]) map[key] = [];
      map[key].push(slot);
    }
    return map;
  }, [weeklySlots]);

  return (
    <div className="dtpicker">
      <div className="dtpicker-toolbar">
        <button className="btn" onClick={onBack}>
          ← Назад
        </button>
        <h3 className="dtpicker-title">{eventType.title}</h3>
        <div className="dtpicker-view-toggle">
          <button
            className={`btn ${viewMode === 'monthly' ? 'primary' : ''}`}
            onClick={() => setViewMode('monthly')}
          >
            Месяц
          </button>
          <button
            className={`btn ${viewMode === 'weekly' ? 'primary' : ''}`}
            onClick={() => { if (!weekRange) startWeekly(); else setViewMode('weekly'); }}
          >
            Неделя
          </button>
          <button
            className={`btn ${viewMode === 'daily' ? 'primary' : ''}`}
            onClick={() => setViewMode('daily')}
          >
            День
          </button>
          <button
            className={`btn ${viewMode === 'timeline' ? 'primary' : ''}`}
            onClick={() => setViewMode('timeline')}
          >
            Таймлайн
          </button>
        </div>
      </div>

      {error && <div className="err">{error}</div>}

      {/* === MONTHLY VIEW === */}
      {viewMode === 'monthly' && (
        <div className="dtpicker-body">
          <div className="dtpicker-calendar-panel">
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              month={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              loading={loading}
            />
          </div>
          <div className="dtpicker-slots-panel">
            {selectedDate && (
              <TimeSlots
                slots={slots}
                selectedSlot={selectedSlot}
                onSelectSlot={handleSelectSlot}
                loading={loading}
                dateLabel={formatDate(selectedDate)}
              />
            )}
            {!selectedDate && (
              <div className="dtpicker-hint">Выберите дату на календаре</div>
            )}
          </div>
        </div>
      )}

      {/* === WEEKLY VIEW === */}
      {viewMode === 'weekly' && (
        <div className="dtpicker-weekly">
          <div className="dtpicker-week-nav">
            <button className="btn" onClick={handlePrevWeek}>‹ Неделя</button>
            <span className="dtpicker-week-label">
              {weekRange
                ? `${formatDate(weekRange.from)} — ${formatDate(weekRange.to)}`
                : ''}
            </span>
            <button className="btn" onClick={handleNextWeek}>Неделя ›</button>
          </div>
          {loading && (
            <div className="timeslots-loading">
              <span className="spin">⏳</span> Загрузка…
            </div>
          )}
          {!loading && (
            <div className="dtpicker-weekly-grid">
              {weeklyDays.map((day) => {
                const daySlots = slotsByDate[day.date] ?? [];
                return (
                  <div key={day.date} className="dtpicker-weekly-day">
                    <div className="dtpicker-weekly-day-header">
                      <span className="dtpicker-weekly-dayname">{day.dayName}</span>
                      <span className="dtpicker-weekly-daynum">{day.label}</span>
                    </div>
                    <div className="dtpicker-weekly-slots">
                      {daySlots.length === 0 && (
                        <div className="dtpicker-weekly-empty">—</div>
                      )}
                      {daySlots.map((slot) => (
                        <button
                          key={slot.startTime}
                          className={`timeslot-mini ${!slot.isAvailable ? 'unavailable' : ''} ${
                            selectedSlot?.startTime === slot.startTime ? 'selected' : ''
                          }`}
                          disabled={!slot.isAvailable}
                          onClick={() => handleSelectSlot(slot)}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === DAILY VIEW === */}
      {viewMode === 'daily' && (
        <div className="dtpicker-daily">
          <div className="dtpicker-day-nav">
            <button
              className="btn"
              onClick={() => {
                if (selectedDate) {
                  const prev = addDays(new Date(selectedDate), -1);
                  handleSelectDate(toDateInputValue(prev));
                }
              }}
            >
              ‹ Пред. день
            </button>
            <span className="dtpicker-day-label">
              {selectedDate ? formatDate(selectedDate) : ''}
            </span>
            <button
              className="btn"
              onClick={() => {
                if (selectedDate) {
                  const next = addDays(new Date(selectedDate), 1);
                  handleSelectDate(toDateInputValue(next));
                }
              }}
            >
              След. день ›
            </button>
          </div>
          {selectedDate && (
            <TimeSlots
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              loading={loading}
              dateLabel={formatDate(selectedDate)}
            />
          )}
        </div>
      )}

      {/* === TIMELINE VIEW === */}
      {viewMode === 'timeline' && (
        <div className="dtpicker-timeline">
          <div className="dtpicker-timeline-date-nav">
            <button
              className="btn"
              onClick={() => {
                if (selectedDate) {
                  const prev = addDays(new Date(selectedDate), -1);
                  handleSelectDate(toDateInputValue(prev));
                }
              }}
            >
              ‹
            </button>
            <span className="dtpicker-day-label">
              {selectedDate ? formatDate(selectedDate) : ''}
            </span>
            <button
              className="btn"
              onClick={() => {
                if (selectedDate) {
                  const next = addDays(new Date(selectedDate), 1);
                  handleSelectDate(toDateInputValue(next));
                }
              }}
            >
              ›
            </button>
          </div>
          {selectedDate && (
            <div className="dtpicker-timeline-body">
              <div className="timeline-line" />
              {loading ? (
                <div className="timeslots-loading">
                  <span className="spin">⏳</span> Загрузка…
                </div>
              ) : slots.length === 0 ? (
                <div className="timeslots-empty">Нет слотов на эту дату</div>
              ) : (
                slots.map((slot) => {
                  const isSelected = selectedSlot?.startTime === slot.startTime;
                  return (
                    <button
                      key={slot.startTime}
                      className={`timeline-slot ${!slot.isAvailable ? 'unavailable' : ''} ${
                        isSelected ? 'selected' : ''
                      }`}
                      disabled={!slot.isAvailable}
                      onClick={() => handleSelectSlot(slot)}
                    >
                      <div className="timeline-slot-dot" />
                      <div className="timeline-slot-content">
                        <span className="timeline-slot-time">{formatTime(slot.startTime)}</span>
                        <span className="timeline-slot-dur">— {formatTime(slot.endTime)}</span>
                        {!slot.isAvailable && <span className="timeline-slot-badge">Занято</span>}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirm button */}
      {selectedSlot && (
        <div className="dtpicker-confirm">
          <button className="btn primary" onClick={handleConfirmSlot}>
            Выбрать {formatTime(selectedSlot.startTime)} — {formatTime(selectedSlot.endTime)}
          </button>
        </div>
      )}
    </div>
  );
}
