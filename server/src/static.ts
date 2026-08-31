import { existsSync, statSync, createReadStream } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import type { ServerResponse } from 'node:http';

/**
 * Раздача собранного фронтенда (web/dist) тем же процессом, что и API.
 *
 * Это позволяет упаковать всё приложение (API + SPA) в один Docker-образ:
 * бэкенд слушает PORT и отдаёт и контрактные пути /guest, /admin, /health,
 * и статические файлы фронтенда. Фронтенд-клиент ходит по относительным
 * путям (same-origin), поэтому никакого CORS/прокси в продакшене не нужно.
 *
 * Корень статики: переменная окружения STATIC_DIR или (по умолчанию)
 * web/dist относительно исходников сервера — одинаково работает в репозитории
 * и в контейнере (см. Dockerfile). Если каталог не существует (например,
 * запуск только API в dev-режиме без сборки фронта), раздача отключена и
 * сервер ведёт себя как прежде — отдаёт JSON 404 для неизвестных путей.
 */

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

export const STATIC_ROOT = resolve(
  process.env.STATIC_DIR ?? join(import.meta.dirname, '..', '..', 'web', 'dist'),
);

/** Раздача включена, только если фронтенд реально собран. */
const ENABLED = existsSync(join(STATIC_ROOT, 'index.html'));

export function isStaticEnabled(): boolean {
  return ENABLED;
}

/** Отправляет файл с корректным Content-Type и кэш-заголовками. */
function sendFile(res: ServerResponse, filePath: string, cacheable: boolean): void {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': statSync(filePath).size,
    // Хэшированные ассеты Vite кэшируем «навсегда», index.html — всегда свежий.
    'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(filePath).pipe(res);
}

/**
 * Пытается ответить статикой по pathname. Возвращает true, если ответ отправлен.
 * Неизвестные пути (кроме /guest/*, /admin/*, /health — их фильтрует вызывающий
 * код) отдают index.html — это SPA-fallback для клиентской навигации.
 */
export function serveStatic(res: ServerResponse, pathname: string): boolean {
  if (!ENABLED) {
    return false;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  // Защита от path traversal: путь обязан остаться внутри STATIC_ROOT.
  const relative = normalize(decoded).replace(/^([.][.][/\\])+/, '');
  let filePath = resolve(STATIC_ROOT, `.${sep}${relative}`);
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + sep)) {
    return false;
  }

  try {
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const cacheable = filePath.startsWith(join(STATIC_ROOT, 'assets') + sep);
      sendFile(res, filePath, cacheable);
      return true;
    }
  } catch {
    return false;
  }

  // Файла нет — отдаём index.html (SPA решает, что показать).
  try {
    sendFile(res, join(STATIC_ROOT, 'index.html'), false);
    return true;
  } catch {
    return false;
  }
}
