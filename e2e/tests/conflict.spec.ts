import { expect, test } from '@playwright/test';

/**
 * Проверка ключевого бизнес-правила бронирования: выбранный слот нельзя
 * занять дважды. Тестируется через прокси фронтенда (5173 → 8080), то есть
 * фактически через всю связку front ↔ back.
 */
test.describe('Бизнес-правило: слот уже занят', () => {
  test('один и тот же слот нельзя забронировать дважды (409 SLOT_UNAVAILABLE)', async ({
    request,
  }) => {
    // Достаём типы событий и свободный слот через API.
    const typesRes = await request.get('/guest/event-types');
    expect(typesRes.ok()).toBeTruthy();
    const types = (await typesRes.json()) as Array<{ id: string }>;
    expect(types.length).toBeGreaterThan(0);
    const eventTypeId = types[0].id;

    const slotsRes = await request.get(`/guest/availability?eventTypeId=${eventTypeId}`);
    expect(slotsRes.ok()).toBeTruthy();
    const slots = (await slotsRes.json()) as Array<{ startTime: string; isAvailable: boolean }>;
    const free = slots.find((s) => s.isAvailable);
    expect(free).toBeTruthy();

    const payload = {
      eventTypeId,
      guestName: 'Гость Первый',
      guestEmail: 'first@example.org',
      startTime: free!.startTime,
    };

    // Первое бронирование успешно.
    const first = await request.post('/guest/bookings', { data: payload });
    expect(first.status()).toBe(200);

    // Второе бронирование того же слота отклоняется бэкендом.
    const second = await request.post('/guest/bookings', {
      data: { ...payload, guestName: 'Гость Второй', guestEmail: 'second@example.org' },
    });
    expect(second.status()).toBe(409);
    const body = (await second.json()) as { code: string; message: string };
    expect(body.code).toBe('SLOT_UNAVAILABLE');

    // Занятый слот исчезает из выбора в UI: в актуальном списке свободных
    // слотов момент начала booked слота отсутствует.
    const fresh = await (await request.get(`/guest/availability?eventTypeId=${eventTypeId}`)).json();
    const stillAvailable = (fresh as Array<{ startTime: string; isAvailable: boolean }>).some(
      (s) => s.startTime === payload.startTime && s.isAvailable,
    );
    expect(stillAvailable).toBe(false);
  });
});