import { randomUUID } from 'node:crypto';
import type { Booking, CreateEventTypeRequest, EventType } from './types.ts';

/**
 * Хранилище в памяти. По требованиям этапа БД не нужна:
 * после перезапуска сервиса данные сбрасываются.
 */
export interface Store {
  eventTypes: EventType[];
  bookings: Booking[];
}

export function createStore(): Store {
  return { eventTypes: [], bookings: [] };
}

/** Единственное хранилище приложения. */
export const store: Store = createStore();

export function findEventType(st: Store, id: string): EventType | undefined {
  return st.eventTypes.find((t) => t.id === id);
}

export function findBooking(st: Store, id: string): Booking | undefined {
  return st.bookings.find((b) => b.id === id);
}

/** Создаёт запись типа события из данных запроса (id и createdAt генерируются). */
export function createEventTypeRecord(req: CreateEventTypeRequest): EventType {
  const record: EventType = {
    id: randomUUID(),
    title: req.title,
    durationMinutes: req.durationMinutes,
    createdAt: new Date().toISOString(),
  };
  if (req.description) {
    record.description = req.description;
  }
  return record;
}

/** Добавляет бронирование в хранилище. */
export function addBooking(st: Store, booking: Booking): Booking {
  st.bookings.push(booking);
  return booking;
}

/** Удаляет бронирование по id; возвращает удалённую запись либо undefined. */
export function removeBooking(st: Store, id: string): Booking | undefined {
  const index = st.bookings.findIndex((b) => b.id === id);
  if (index === -1) {
    return undefined;
  }
  const [removed] = st.bookings.splice(index, 1);
  return removed;
}

/** Заполняет хранилище демонстрационными данными на старте. */
export function seedStore(st: Store = store): void {
  const seeds: Array<{ title: string; description?: string; durationMinutes: number }> = [
    { title: 'Консультация', description: 'Индивидуальная консультация по проекту', durationMinutes: 30 },
    { title: 'Созвон', description: 'Видеозвонок для обсуждения задач', durationMinutes: 60 },
    { title: 'Мастер-класс', description: 'Групповое занятие до 5 человек', durationMinutes: 90 },
  ];
  for (const seed of seeds) {
    st.eventTypes.push(createEventTypeRecord(seed));
  }
}