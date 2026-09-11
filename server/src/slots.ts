import type { Store } from './store.ts';
import type { TimeSlot } from './types.ts';

/**
 * Бизнес-правила расписания владельца календаря.
 *
 * Слоты генерируются по рабочему окну: Пн–Пт с 09:00 до 18:00 (UTC),
 * шаг сетки равен длительности типа события. Слот считается
 * занятым, если пересекается с любым существующим бронированием — владелец
 * не может находиться на двух встречах одновременно, даже разных типов.
 */

export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 18;

/** Длительность полного дня в миллисекундах (для границ фильтра dateTo). */
export const DAY_MS_CONST = 24 * 60 * 60 * 1000;

/** Разбирает ISO-дату YYYY-MM-DD в UTC-полночь; null, если строка невалидна. */
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) {
    return null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** UTC-полночь текущего дня. */
export function todayStartDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Дата через n UTC-дней. */
export function addDays(date: Date, days: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

/** Является ли день рабочим (Пн–Пт) по UTC. */
export function isWorkingDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

/** Пересекаются ли полуинтервалы [aStart, aEnd) и [bStart, bEnd)? */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Свободна ли ячейка времени: никакие бронирования не пересекаются с
 * интервалом [start, end). Проверяется по всему календарю, а не только по
 * типу события.
 */
export function isTimeSlotFree(st: Store, start: Date, end: Date): boolean {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return !st.bookings.some((b) => {
    return intervalsOverlap(startMs, endMs, new Date(b.startTime).getTime(), new Date(b.endTime).getTime());
  });
}

/** Является ли момент корректным началом слота в сетке рабочего времени (UTC)? */
export function isGridSlotStart(durationMinutes: number, start: Date): boolean {
  if (!isWorkingDay(start)) {
    return false;
  }
  const minutes = start.getUTCHours() * 60 + start.getUTCMinutes();
  if (minutes < WORK_START_HOUR * 60) {
    return false;
  }
  if (minutes + durationMinutes > WORK_END_HOUR * 60) {
    return false;
  }
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) {
    return false;
  }
  return (minutes - WORK_START_HOUR * 60) % durationMinutes === 0;
}

/**
 * Генерирует слоты для типа события в диапазоне [dateFrom, dateTo].
 * Прошедшие слоты не возвращаются; занятые помечаются isAvailable: false.
 * Все даты в UTC.
 */
export function generateSlots(
  st: Store,
  durationMinutes: number,
  dateFrom: Date,
  dateTo: Date,
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();
  const durationMs = durationMinutes * 60_000;
  const from = new Date(Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), dateFrom.getUTCDate()));
  const to = new Date(Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate()));

  for (let day = from; day.getTime() <= to.getTime(); day = addDays(day, 1)) {
    if (!isWorkingDay(day)) {
      continue;
    }
    const dayStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), WORK_START_HOUR, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), WORK_END_HOUR, 0, 0, 0));

    let cursor = dayStart;
    while (cursor.getTime() + durationMs <= dayEnd.getTime()) {
      const start = cursor;
      const end = new Date(start.getTime() + durationMs);
      if (start.getTime() > now.getTime()) {
        slots.push({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          isAvailable: isTimeSlotFree(st, start, end),
        });
      }
      cursor = end;
    }
  }
  return slots;
}
