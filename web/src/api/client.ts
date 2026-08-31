import type {
  Booking,
  CreateBookingRequest,
  CreateEventTypeRequest,
  EventType,
  SuccessResult,
  TimeSlot,
  ValidationError,
} from './types';

/**
 * Базовый URL API. По умолчанию — тот же origin (Vite проксирует
 * контрактные пути /guest и /admin на бэкенд в dev-режиме).
 * Можно переопределить через VITE_API_URL.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    throw new ApiError('Не удалось связаться с сервером', 'network');
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError('Некорректный ответ сервера', 'parse');
    }
  }

  if (!res.ok) {
    const err = body as Partial<ValidationError> | undefined;
    throw new ApiError(
      err?.message ?? `Ошибка запроса (${res.status})`,
      err?.code ?? String(res.status),
      err?.details,
    );
  }

  return body as T;
}

function unwrap<T>(value: T | ValidationError): T {
  const v = value as Partial<ValidationError> & T;
  if (v && typeof v === 'object' && typeof v.code === 'string' && typeof v.message === 'string') {
    throw new ApiError(v.message, v.code, v.details);
  }
  return value as T;
}

// ===== Публичное API гостя =====

export const guestApi = {
  listEventTypes: async (): Promise<EventType[]> =>
    unwrap(await request<EventType[] | ValidationError>('/guest/event-types')),

  getAvailableSlots: async (
    eventTypeId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<TimeSlot[]> => {
    const params = new URLSearchParams({ eventTypeId });
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    const data = await request<TimeSlot[] | ValidationError>(
      `/guest/availability?${params.toString()}`,
    );
    return unwrap(data);
  },

  createBooking: async (req: CreateBookingRequest): Promise<Booking> =>
    unwrap(
      await request<Booking | ValidationError>('/guest/bookings', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    ),
};

// ===== Админское API владельца =====

export const adminApi = {
  createEventType: async (req: CreateEventTypeRequest): Promise<EventType> =>
    unwrap(
      await request<EventType | ValidationError>('/admin/event-types', {
        method: 'POST',
        body: JSON.stringify(req),
      }),
    ),

  listEventTypes: async (): Promise<EventType[]> =>
    request<EventType[]>('/admin/event-types'),

  listBookings: async (status?: 'upcoming' | 'past'): Promise<Booking[]> => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return request<Booking[]>(`/admin/bookings${qs ? `?${qs}` : ''}`);
  },

  cancelBooking: async (id: string): Promise<SuccessResult> =>
    unwrap(
      await request<SuccessResult | ValidationError>(`/admin/bookings/${id}`, {
        method: 'DELETE',
      }),
    ),
};