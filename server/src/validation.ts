import { ApiError } from './errors.ts';
import type { CreateBookingRequest, CreateEventTypeRequest } from './types.ts';

/**
 * Валидация входящих запросов по ограничениям контракта api-spec/main.tsp.
 * Все ошибки выбрасываются в формате ApiError → ValidationError.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_BODY_BYTES = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiError(400, 'INVALID_BODY', message);
  }
  return value;
}

function requireString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== 'string' || value.length < minLength || value.length > maxLength) {
    throw new ApiError(400, 'INVALID_FIELD', `Поле ${field} обязательно и должно быть строкой длиной от ${minLength} до ${maxLength}`, {
      field,
      expected: `string(${minLength}..${maxLength})`,
    });
  }
  return value;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ApiError(400, 'INVALID_FIELD', `Поле ${field} должно быть строкой длиной до ${maxLength}`, {
      field,
      expected: `string(0..${maxLength})`,
    });
  }
  return value;
}

function optionalEmail(value: unknown, field: string): string | undefined {
  const email = optionalString(value, field, 254);
  if (email === undefined) {
    return undefined;
  }
  if (!EMAIL_RE.test(email)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'Поле guestEmail должно быть корректным email-адресом', {
      field,
      expected: 'email',
    });
  }
  return email;
}

export function validateEventTypeRequest(body: unknown): CreateEventTypeRequest {
  const b = asRecord(body, 'Тело запроса должно быть JSON-объектом');
  const title = requireString(b.title, 'title', 1, 100);
  const description = optionalString(b.description, 'description', 500);
  const durationMinutes = Number(b.durationMinutes);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
    throw new ApiError(400, 'INVALID_DURATION', 'durationMinutes должно быть целым числом от 5 до 480', {
      field: 'durationMinutes',
      expected: 'int32(5..480)',
    });
  }
  const result: CreateEventTypeRequest = { title, durationMinutes };
  if (description !== undefined) {
    result.description = description;
  }
  return result;
}

export function validateBookingRequest(body: unknown): CreateBookingRequest {
  const b = asRecord(body, 'Тело запроса должно быть JSON-объектом');
  const eventTypeId = requireString(b.eventTypeId, 'eventTypeId', 1, 100);
  const guestName = requireString(b.guestName, 'guestName', 1, 100);
  const guestEmail = optionalEmail(b.guestEmail, 'guestEmail');
  const startTime = requireString(b.startTime, 'startTime', 1, 100);

  const result: CreateBookingRequest = { eventTypeId, guestName, startTime };
  if (guestEmail !== undefined) {
    result.guestEmail = guestEmail;
  }
  return result;
}