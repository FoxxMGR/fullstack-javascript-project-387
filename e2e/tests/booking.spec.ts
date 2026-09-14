import { expect, test } from '@playwright/test';

/**
 * Основной пользовательский сценарий бронирования:
 * гость → выбирает тип события → выбирает свободный слот → заполняет форму →
 * подтверждает бронирование; владелец видит новую бронь в панели.
 *
 * Слоты в UI-шаге «выбор даты» показывает DatePicker (web/src/components/
 * DatePicker.tsx): календарь на месяц с доступными днями (`.dp-cell.dp-available`)
 * и таймлайн слотов по выбранному дню (`.dp-timeline .dp-slot`). Данные
 * асинхронно приходят с /guest/availability, поэтому хелп-функция ждёт
 * появления доступного дня и первой ячейки таймлайна.
 */
async function waitForSlots(
  page: import('@playwright/test').Page,
  eventTypeTitle: string,
  dayNumber?: string,
) {
  const card = page.locator('.card').filter({ hasText: eventTypeTitle });
  await card.getByRole('button', { name: 'Выбрать' }).click();

  const calendar = page.locator('.datepicker');
  await expect(calendar).toBeVisible();

  // Доступные дни появляются после ответа /guest/availability.
  const availableDays = page.locator('.datepicker .dp-grid button.dp-cell.dp-available');
  let day = availableDays.first();
  if (dayNumber) {
    day = availableDays.filter({
      has: page.locator('span.dp-day', { hasText: new RegExp(`^${dayNumber}$`) }),
    });
  }
  await expect(day).toBeVisible();
  const selectedDay = dayNumber ?? (await day.locator('span.dp-day').innerText());

  // Открывается таймлайн выбранного дня, слоты приходят тем же запросом.
  await day.click();
  const slotList = page.locator('.datepicker .dp-timeline button.dp-slot');
  await expect(slotList.first()).toBeVisible();
  return { card, slotList, dayNumber: selectedDay };
}

test.describe('Основной сценарий бронирования', () => {
  test('гость записывается на свободный слот, владелец видит бронь', async ({ page }) => {
    const guestName = `Гость из e2e ${Date.now()}`;
    const email = 'guest.e2e@example.org';

    await page.goto('/');

    // По умолчанию открыта вкладка «Гость», типы событий загружены с бэкенда.
    await expect(page.getByRole('button', { name: 'Гость' })).toHaveClass(/active/);
    await expect(page.getByText(/Консультация/)).toBeVisible();

    // Шаг 1 → шаг 2: выбираем тип события, день в календаре и ждём таймлайн.
    const { slotList, dayNumber } = await waitForSlots(page, 'Консультация');
    const countBefore = await slotList.count();
    expect(countBefore).toBeGreaterThan(0);
    const bookedTime = ((await slotList.first().textContent()) ?? '').replace(/\s+/g, '');

    // Шаг 2 → шаг 3: выбираем первый свободный слот.
    await slotList.first().click();

    // Шаг 3: заполняем форму и подтверждаем.
    await page.locator('#guestName').fill(guestName);
    await page.locator('#guestEmail').fill(email);
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();

    // Шаг 4: бэкенд сохранил бронь и вернул подтверждение.
    await expect(page.getByText('Бронирование подтверждено')).toBeVisible();
    await expect(page.getByText('Записаться ещё')).toBeVisible();

    // Возвращаемся к тому же дню: занятый слот исчез, число свободных −1.
    await page.getByRole('button', { name: 'Записаться ещё' }).click();
    const { slotList: slotList2 } = await waitForSlots(page, 'Консультация', dayNumber);
    expect(await slotList2.count()).toBe(countBefore - 1);
    await expect(slotList2.filter({ hasText: bookedTime }).first()).toHaveCount(0);

    // Владелец видит созданную бронь в списке "предстоящих" бронирований.
    await page.getByRole('button', { name: 'Владелец' }).click();
    await page.getByRole('button', { name: 'Бронирования' }).click();
    await expect(page.getByRole('cell', { name: guestName })).toBeVisible();
    await expect(page.getByRole('cell', { name: email })).toBeVisible();
  });

  test('Владелец создаёт тип события — гость видит его и может записаться', async ({ page }) => {
    const title = `Новый тип ${Date.now()}`;

    // Владелец создаёт новый тип события.
    await page.goto('/');
    await page.getByRole('button', { name: 'Владелец' }).click();
    await page.locator('#title').fill(title);
    await page.locator('#duration').fill('20');
    await page.getByRole('button', { name: 'Создать' }).click();

    // Новый тип появился в списке типов владельца.
    await expect(page.locator('.card').filter({ hasText: title })).toBeVisible();

    // Гость видит новый тип день на /guest и может записаться.
    await page.getByRole('button', { name: 'Гость' }).click();
    await expect(page.getByText(title)).toBeVisible();

    const { slotList } = await waitForSlots(page, title);
    await slotList.first().click();
    await page.locator('#guestName').fill(`Гость ${Date.now()}`);
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();
    await expect(page.getByText('Бронирование подтверждено')).toBeVisible();
  });
});