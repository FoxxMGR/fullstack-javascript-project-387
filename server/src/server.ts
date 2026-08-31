import { createServer } from 'node:http';
import { createApp } from './app.ts';
import { seedStore, store } from './store.ts';

/**
 * Точка входа бэкенда.
 * Запуск: npm start (или node src/server.ts).
 * Порт берётся из переменной окружения PORT (требование деплоя: Render/Railway
 * подставляют свой порт), по умолчанию — 8080, как ожидает Vite-прокси
 * фронтенда (web/vite.config.ts).
 * Вместе с API процесс раздаёт статику собранного фронтенда (web/dist),
 * поэтому один контейнер (см. Dockerfile) обслуживает всё приложение.
 */

const PORT = Number(process.env.PORT ?? 8080);

// Демонстрационные данные в памяти (сбрасываются при перезапуске).
seedStore(store);

const server = createServer(createApp(store));

server.listen(PORT, () => {
  console.log(`[server] Calendar Booking API запущен на http://localhost:${PORT}`);
  console.log('[server] Контракт: api-spec/main.tsp (Guest /guest/*, Admin /admin/*)');
});

function shutdown(): void {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);