import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError, toValidationError } from './errors.ts';
import {
  DAY_MS_CONST,
  addDays,
  generateSlots,
  isGridSlotStart,
  isTimeSlotFree,
  parseISODate,
  todayStartDate,
} from './slots.ts';
import {
  addBooking,
  createEventTypeRecord,
  findEventType,
  removeBooking,
  type Store,
} from './store.ts';
import type { Booking, SuccessResult } from './types.ts';
import { serveStatic } from './static.ts';
import {
  MAX_BODY_BYTES,
  validateBookingRequest,
  validateEventTypeRequest,
} from './validation.ts';

/**
 * HTTP-слой приложения: маршрутизация контрактных путей /guest/* и /admin/*
 * (см. api-spec/main.tsp) + минимальные служебные эндпоинты /health и OPTIONS.
 * Намеренно без внешних зависимостей (только node:http).
 */

interface RouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
}

type Handler = (ctx: RouteContext) => void | Promise<void>;

interface Route {
  method: string;
  segments: string[];
  handler: Handler;
}

function matchRoute(route: Route, method: string, pathname: string): Record<string, string> | null {
  if (route.method !== method) {
    return null;
  }
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== route.segments.length) {
    return null;
  }
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i += 1) {
    const segment = route.segments[i] ?? '';
    const part = parts[i] ?? '';
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decodeURIComponent(part);
    } else if (segment !== part) {
      return null;
    }
  }
  return params;
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(),
  });
  res.end(status === 204 ? undefined : JSON.stringify(body));
}

function sendError(res: ServerResponse, err: unknown): void {
  if (err instanceof ApiError) {
    sendJson(res, err.status, toValidationError(err));
    return;
  }
  console.error('[server] Внутренняя ошибка:', err);
  sendJson(res, 500, { code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
}

/** Читает и разбирает JSON-тело запроса с ограничением размера. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(
          new ApiError(413, 'BODY_TOO_LARGE', `Тело запроса слишком большое (максимум ${MAX_BODY_BYTES} байт)`),
        );
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'Тело запроса не является корректным JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ===== Обработчики =====

function listEventTypes(ctx: RouteContext, st: Store): void {
  sendJson(ctx.res, 200, st.eventTypes);
}

function getAvailableSlots(ctx: RouteContext, st: Store): void {
  const eventTypeId = ctx.query.get('eventTypeId');
  if (!eventTypeId) {
    throw new ApiError(400, 'MISSING_PARAM', 'Обязательный параметр eventTypeId отсутствует', {
      field: 'eventTypeId',
    });
  }
  const eventType = findEventType(st, eventTypeId);
  if (!eventType) {
    throw new ApiError(404, 'EVENT_TYPE_NOT_FOUND', `Тип события не найден: ${eventTypeId}`);
  }

  const rawFrom = ctx.query.get('dateFrom');
  const rawTo = ctx.query.get('dateTo');
  const dateFrom = rawFrom === null ? undefined : parseISODate(rawFrom);
  const dateTo = rawTo === null ? undefined : parseISODate(rawTo);
  if (rawFrom !== null && !dateFrom) {
    throw new ApiError(400, 'INVALID_DATE', 'dateFrom должен быть датой в формате YYYY-MM-DD', {
      field: 'dateFrom',
      expected: 'YYYY-MM-DD',
    });
  }
  if (rawTo !== null && !dateTo) {
    throw new ApiError(400, 'INVALID_DATE', 'dateTo должен быть датой в формате YYYY-MM-DD', {
      field: 'dateTo',
      expected: 'YYYY-MM-DD',
    });
  }

  const from = dateFrom ?? todayStartDate();
  const to = dateTo ?? addDays(from, 14);
  if (from.getTime() > to.getTime()) {
    throw new ApiError(400, 'INVALID_DATE_RANGE', 'dateFrom не может быть позже dateTo');
  }

  const slots = generateSlots(st, eventType.durationMinutes, from, to);
  sendJson(ctx.res, 200, slots);
}

function createBooking(ctx: RouteContext, st: Store): void {
  const req = validateBookingRequest(ctx.body);
  const eventType = findEventType(st, req.eventTypeId);
  if (!eventType) {
    throw new ApiError(404, 'EVENT_TYPE_NOT_FOUND', `Тип события не найден: ${req.eventTypeId}`);
  }

  const start = new Date(req.startTime);
  if (Number.isNaN(start.getTime())) {
    throw new ApiError(400, 'INVALID_START_TIME', 'startTime должен быть корректной ISO-датой/временем', {
      field: 'startTime',
    });
  }
  const now = new Date();
  if (start.getTime() <= now.getTime()) {
    throw new ApiError(400, 'PAST_START_TIME', 'Нельзя бронировать слот, который уже начался');
  }
  if (!isGridSlotStart(eventType.durationMinutes, start)) {
    throw new ApiError(
      400,
      'INVALID_START_TIME',
      'Выбранное время не входит в сетку рабочих слотов (Пн–Пт 09:00–18:00)',
      { field: 'startTime' },
    );
  }

  const end = new Date(start.getTime() + eventType.durationMinutes * 60_000);

  // Ключевое бизнес-правило: выбранный слот уже занят (в том числе в гонке,
  // когда два гостя бронируют одно и то же время одновременно).
  if (!isTimeSlotFree(st, start, end)) {
    throw new ApiError(409, 'SLOT_UNAVAILABLE', 'Выбранный слот уже занят. Пожалуйста, выберите другое время.');
  }

  const booking: Booking = {
    id: randomUUID(),
    eventTypeId: req.eventTypeId,
    guestName: req.guestName,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    createdAt: now.toISOString(),
  };
  if (req.guestEmail) {
    booking.guestEmail = req.guestEmail;
  }
  addBooking(st, booking);
  sendJson(ctx.res, 200, booking);
}

function adminCreateEventType(ctx: RouteContext, st: Store): void {
  const req = validateEventTypeRequest(ctx.body);
  const record = createEventTypeRecord(req);
  st.eventTypes.push(record);
  sendJson(ctx.res, 200, record);
}

function adminListBookings(ctx: RouteContext, st: Store): void {
  const status = ctx.query.get('status');
  if (status !== null && status !== 'upcoming' && status !== 'past') {
    throw new ApiError(400, 'INVALID_STATUS', 'status должен быть одним из: upcoming, past', {
      field: 'status',
      expected: 'upcoming | past',
    });
  }

  const rawFrom = ctx.query.get('from');
  const rawTo = ctx.query.get('to');
  const from = rawFrom === null ? undefined : parseISODate(rawFrom);
  const to = rawTo === null ? undefined : parseISODate(rawTo);
  if (rawFrom !== null && !from) {
    throw new ApiError(400, 'INVALID_DATE', 'from должен быть датой в формате YYYY-MM-DD', {
      field: 'from',
      expected: 'YYYY-MM-DD',
    });
  }
  if (rawTo !== null && !to) {
    throw new ApiError(400, 'INVALID_DATE', 'to должен быть датой в формате YYYY-MM-DD', {
      field: 'to',
      expected: 'YYYY-MM-DD',
    });
  }

  const nowMs = Date.now();
  let result = st.bookings.filter((b) => {
    const startMs = Date.parse(b.startTime);
    if (status === 'past') {
      return startMs < nowMs;
    }
    if (status === 'upcoming') {
      return startMs >= nowMs;
    }
    return true;
  });

  if (from) {
    const fromMs = from.getTime();
    result = result.filter((b) => Date.parse(b.startTime) >= fromMs);
  }
  if (to) {
    const toMs = to.getTime() + DAY_MS_CONST; // включая весь день dateTo
    result = result.filter((b) => Date.parse(b.startTime) < toMs);
  }

  result = [...result].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  sendJson(ctx.res, 200, result);
}

function adminCancelBooking(ctx: RouteContext, st: Store): void {
  const id = ctx.params['id'] ?? '';
  const removed = removeBooking(st, id);
  if (!removed) {
    throw new ApiError(404, 'BOOKING_NOT_FOUND', `Бронирование не найдено: ${id}`);
  }
  const result: SuccessResult = { success: true };
  sendJson(ctx.res, 200, result);
}

function health(ctx: RouteContext): void {
  sendJson(ctx.res, 200, { status: 'ok' });
}

// ===== Приложение =====

export function createApp(st: Store) {
  const routes: Route[] = [
    { method: 'GET', segments: ['guest', 'event-types'], handler: (ctx) => listEventTypes(ctx, st) },
    { method: 'GET', segments: ['guest', 'availability'], handler: (ctx) => getAvailableSlots(ctx, st) },
    { method: 'POST', segments: ['guest', 'bookings'], handler: (ctx) => createBooking(ctx, st) },
    { method: 'POST', segments: ['admin', 'event-types'], handler: (ctx) => adminCreateEventType(ctx, st) },
    { method: 'GET', segments: ['admin', 'event-types'], handler: (ctx) => listEventTypes(ctx, st) },
    { method: 'GET', segments: ['admin', 'bookings'], handler: (ctx) => adminListBookings(ctx, st) },
    { method: 'DELETE', segments: ['admin', 'bookings', ':id'], handler: (ctx) => adminCancelBooking(ctx, st) },
    { method: 'GET', segments: ['health'], handler: (ctx) => health(ctx) },
  ];

  return async function requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders());
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';

      for (const route of routes) {
        const params = matchRoute(route, method, url.pathname);
        if (!params) {
          continue;
        }
        const body = route.method === 'GET' || route.method === 'DELETE' ? undefined : await readJsonBody(req);
        await route.handler({ req, res, params, query: url.searchParams, body });
        return;
      }

      // Вне контрактных префиксов (/guest, /admin, /health) раздаём статику
      // собранного фронтенда — так API и SPA живут в одном процессе/образе.
      // Неизвестные API-пути по-прежнему получают JSON 404 (ValidationError).
      const isApiPath =
        url.pathname.startsWith('/guest') ||
        url.pathname.startsWith('/admin') ||
        url.pathname === '/health';
      if (!isApiPath && (method === 'GET' || method === 'HEAD') && serveStatic(res, url.pathname)) {
        return;
      }

      throw new ApiError(404, 'NOT_FOUND', `Маршрут не найден: ${method} ${url.pathname}`);
    } catch (err) {
      sendError(res, err);
    }
  };
}