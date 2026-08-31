// Вспомогательные функции форматирования дат.

/** ISO-дата (YYYY-MM-DD) для заданной даты. */
export function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Дата через n дней от сегодня. */
export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Сегодня как ISO-дата (YYYY-MM-DD). */
export function todayISO(): string {
  return toDateInputValue(new Date());
}

/** Дата через 14 дней как ISO-дата. */
export function inTwoWeeksISO(): string {
  return toDateInputValue(addDays(new Date(), 14));
}

/**
 * Форматирует ISO-время (startTime) в читаемый вид:
 * дд.мм.гггг чч:мм (часовой пояс пользователя).
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Форматирует дату в короткий вид дд.мм.гггг. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Форматирует время чч:мм (без даты). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}