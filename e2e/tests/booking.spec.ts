import { expect, test } from '@playwright/test';

async function waitForDateTimePicker(page: import('@playwright/test').Page) {
  await expect(page.locator('.datetime-picker')).toBeVisible();
}

async function selectFirstAvailableSlot(page: import('@playwright/test').Page) {
  await waitForDateTimePicker(page);
  for (let attempt = 0; attempt < 14; attempt++) {
    const slotBtn = page.locator('.slot-btn:not(:disabled):not(.unavailable):not(.past)').first();
    const count = await slotBtn.count();
    if (count > 0) {
      await slotBtn.click();
      return;
    }
    const nextBtn = page.locator('.picker-nav .btn').last();
    await nextBtn.click();
    await page.waitForTimeout(300);
  }
  throw new Error('No available slots found within 14 days');
}

test.describe('Основной сценарий бронирования', () => {
  test('гость записывается на свободный слот, владелец видит бронь', async ({ page }) => {
    const guestName = `Гость из e2e ${Date.now()}`;
    const email = 'guest.e2e@example.org';

    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Гость' })).toHaveClass(/active/);
    await expect(page.getByText(/Консультация/)).toBeVisible();

    await page.locator('.card').filter({ hasText: 'Консультация' }).getByRole('button', { name: 'Выбрать' }).click();

    await selectFirstAvailableSlot(page);

    await page.locator('#guestName').fill(guestName);
    await page.locator('#guestEmail').fill(email);
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();

    await expect(page.getByText('Бронирование подтверждено')).toBeVisible();
    await expect(page.getByText('Записаться ещё')).toBeVisible();

    await page.getByRole('button', { name: 'Записаться ещё' }).click();
    await expect(page.locator('.card').filter({ hasText: /Консультация/ })).toBeVisible();

    await page.getByRole('button', { name: 'Владелец' }).click();
    await page.getByRole('button', { name: 'Бронирования' }).click();
    await expect(page.getByRole('cell', { name: guestName })).toBeVisible();
    await expect(page.getByRole('cell', { name: email })).toBeVisible();
  });

  test('Владелец создаёт тип события — гость видит его и может записаться', async ({ page }) => {
    const title = `Новый тип ${Date.now()}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Владелец' }).click();
    await page.locator('#title').fill(title);
    await page.locator('#duration').fill('20');
    await page.getByRole('button', { name: 'Создать' }).click();

    await expect(page.locator('.card').filter({ hasText: title })).toBeVisible();

    await page.getByRole('button', { name: 'Гость' }).click();
    await expect(page.getByText(title)).toBeVisible();

    await page.locator('.card').filter({ hasText: title }).getByRole('button', { name: 'Выбрать' }).click();
    await selectFirstAvailableSlot(page);

    await page.locator('#guestName').fill(`Гость ${Date.now()}`);
    await page.getByRole('button', { name: 'Подтвердить бронирование' }).click();
    await expect(page.getByText('Бронирование подтверждено')).toBeVisible();
  });
});
