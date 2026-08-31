import type { Store } from './store.ts';
import type { TimeSlot } from './types.ts';

/**
 * Бизнес-правила расписания владельца календаря.
 *
 * Слоты генерируются по рабочему окну: Пн–Пт с 09:00 до 18:00 (локальное
 * время сервера), шаг сетки равен длительности типа события. Слот считается
 * занятым, если пересекается с любым существующим бронированием — владелец
 * не может находиться на двух встречах одновременно, даже разных типов.
 */

export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 18;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Разбирает ISO-дату YYYY-MM-DD в локальную полночь; null, если строка невалидна. */
export function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) {
    return null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** Локальная полночь текущего дня. */
export function todayStartDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Дата через n локальных дней. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Является ли день рабочим (Пн–Пт). */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay(); // 0 = вс, 6 = сб
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
    return intervalsOverlap(startMs, endMs, Date.parse(b.startTime), Date.parse(b.endTime));
  });
}

/** Является ли момент корректным началом слота в сетке рабочего времени? */
export function isGridSlotStart(durationMinutes: number, start: Date): boolean {
  if (!isWorkingDay(start)) {
    return false;
  }
  const minutes = start.getHours() * 60 + start.getMinutes();
  if (minutes < WORK_START_HOUR * 60) {
    return false;
  }
  if (minutes + durationMinutes > WORK_END_HOUR * 60) {
    return false;
  }
  if (start.getSeconds() !== 0 || start.getMilliseconds() !== 0) {
    return false;
  }
  return (minutes - WORK_START_HOUR * 60) % durationMinutes === 0;
}

/**
 * Генерирует слоты для типа события в диапазоне [dateFrom, dateTo].
 * Прошедшие слоты не возвращаются; занятые помечаются isAvailable: false.
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
  const from = new Date(dateFrom.getFullYear(), dateFrom.getMonth(), dateFrom.getDate());
  const to = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate());

  for (let day = from; day.getTime() <= to.getTime(); day = addDays(day, 1)) {
    if (!isWorkingDay(day)) {
      continue;
    }
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORK_START_HOUR, 0, 0, 0);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), WORK_END_HOUR, 0, 0, 0);

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

/** Длительность полного дня в миллисекундах (для границ фильтра dateTo). */
export const DAY_MS_CONST = DAY_MS;