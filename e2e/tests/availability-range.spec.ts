import { expect, test } from '@playwright/test';

/**
 * Защита `/guest/availability` от слишком большого диапазона дат (BUG-2):
 * запрос диапазона больше 60 дней включительно отклоняется с 400
 * RANGE_TOO_LARGE, пограничное значение (ровно 60 дней) разрешено.
 */
function isoDateDaysFromToday(days: number): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
  const month = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${month}-${day}`;
}

test.describe('Лимит диапазона /guest/availability', () => {
  test('60 дней включительно разрешены, 61 — 400 RANGE_TOO_LARGE', async ({ request }) => {
    const typesRes = await request.get('/guest/event-types');
    expect(typesRes.ok()).toBeTruthy();
    const types = (await typesRes.json()) as Array<{ id: string }>;
    expect(types.length).toBeGreaterThan(0);
    const eventTypeId = types[0].id;

    const dateFrom = isoDateDaysFromToday(0);
    const dateToBoundary = isoDateDaysFromToday(59); // ровно 60 дней включительно
    const dateToOver = isoDateDaysFromToday(60); // 61 день — превышение

    // Пограничное значение: 60 дней включительно — запрос успешен.
    const ok = await request.get(
      `/guest/availability?eventTypeId=${eventTypeId}&dateFrom=${dateFrom}&dateTo=${dateToBoundary}`,
    );
    expect(ok.status()).toBe(200);

    // Превышение лимита: 61 день — 400 RANGE_TOO_LARGE.
    const bad = await request.get(
      `/guest/availability?eventTypeId=${eventTypeId}&dateFrom=${dateFrom}&dateTo=${dateToOver}`,
    );
    expect(bad.status()).toBe(400);
    const body = (await bad.json()) as { code: string; message: string };
    expect(body.code).toBe('RANGE_TOO_LARGE');
    expect(body.message).toContain('60');
  });

  test('dateFrom позже dateTo по-прежнему даёт 400 INVALID_DATE_RANGE', async ({ request }) => {
    const typesRes = await request.get('/guest/event-types');
    const types = (await typesRes.json()) as Array<{ id: string }>;
    const eventTypeId = types[0].id;

    const bad = await request.get(
      `/guest/availability?eventTypeId=${eventTypeId}&dateFrom=${isoDateDaysFromToday(5)}&dateTo=${isoDateDaysFromToday(0)}`,
    );
    expect(bad.status()).toBe(400);
    const body = (await bad.json()) as { code: string };
    expect(body.code).toBe('INVALID_DATE_RANGE');
  });
});