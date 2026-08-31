import { expect, test } from '@playwright/test';

/**
 * Основной пользовательский сценарий бронирования:
 * гость → выбирает тип события → выбирает свободный слот → заполняет форму →
 * подтверждает бронирование; владелец видит новую бронь в панели.
 *
 * Одна хелп-функция waitForSlots используется, чтобы дождаться загрузки
 * слотов из бэкенда (асинхронный запрос /guest/availability).
 */
async function waitForSlots(page: import('@playwright/test').Page, eventTypeTitle: string) {
  const card = page.locator('.card').filter({ hasText: eventTypeTitle });
  await card.getByRole('button', { name: 'Выбрать' }).click();
  // Слоты появляются асинхронно — ждём первый доступный слот.
  const slotList = page.locator('.grid.grid-2 button');
  await expect(slotList.first()).toBeVisible();
  return { card, slotList };
}

test.describe('Основной сценарий бронирования', () => {
  test('гость записывается на свободный слот, владелец видит бронь', async ({ page }) => {
    const guestName = `Гость из e2e ${Date.now()}`;
    const email = 'guest.e2e@example.org';

    await page.goto('/');

    // По умолчанию открыта вкладка «Гость», типы событий загружены с бэкенда.
    await expect(page.getByRole('button', { name: 'Гость' })).toHaveClass(/active/);
    await expect(page.getByText(/Консультация/)).toBeVisible();

    // Шаг 1 → шап 2: выбираем тип события и ждём свободные слоты.
    const { slotList } = await waitForSlots(page, 'Консультация');
    const countBefore = await slotList.count();
    expect(countBefore).toBeGreaterThan(0);

    // Шаг 2 → шап 3: выбираем первый свободный слот.
    await slotList.first().click();

    // Шаг 3: заполняем форму и подтверждаем.
    await page.locator('#guestName').fill(guestName);
    await page.locator('#guestEmail').fill(email);
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();

    // Шаг 4: бэкенд сохранил бронь и вернул подтверждение.
    await expect(page.getByText('Бронирование подтверждено')).toBeVisible();
    await expect(page.getByText('Записаться ещё')).toBeVisible();

    // Возвращаемся к слотам: занятый слот исчез → число свободных уменьшилось на 1.
    await page.getByRole('button', { name: 'Записаться ещё' }).click();
    const { slotList: slotList2 } = await waitForSlots(page, 'Консультация');
    expect(await slotList2.count()).toBe(countBefore - 1);

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