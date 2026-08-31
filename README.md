# Календарь звонков (Calendar Booking)

Fullstack-приложение бронирования встреч по мотивам Cal.com: гость выбирает
тип события и свободный слот и записывается, владелец создаёт типы событий
и управляет бронированиями.

Код перенесён из предыдущего проекта «Календарь звонков»
([fullstack-javascript-project-386](https://github.com/FoxxMGR/fullstack-javascript-project-386)).
Этот репозиторий посвящён не новой функциональности, а **процессу командной
работы с агентом (OpenCode) в GitHub**: issue → triage → pull request → ревью →
регулярные автоматические проверки. План развития — в [ROADMAP.md](ROADMAP.md).

[![hexlet-check](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions)
[![e2e](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/e2e.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/e2e.yml)
[![commitlint](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/commitlint.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/commitlint.yml)
[![Deploy on Render](https://img.shields.io/badge/deploy-Render-46E3B8?logo=render&logoColor=white)](https://render.com/deploy?repo=https://github.com/FoxxMGR/fullstack-javascript-project-387)

## Архитектура

| Каталог    | Назначение                                                    |
| ---------- | ------------------------------------------------------------- |
| `api-spec` | Контракт API (TypeSpec → OpenAPI), определяет все эндпоинты   |
| `server`   | Бэкенд по контракту: Node.js + TypeScript, хранилище в памяти |
| `web`      | Фронтенд (React + Vite), работает с API только по контракту   |
| `e2e`      | Интеграционные тесты Playwright                               |

Бэкенд предоставляет публичное API гостя (`/guest/*`) и админское API
владельца (`/admin/*`). В dev-режиме Vite проксирует эти пути на бэкенд
(`http://localhost:8080`).

## Установка

```bash
git clone https://github.com/FoxxMGR/fullstack-javascript-project-387.git
cd fullstack-javascript-project-387
```

## Запуск

```bash
# 1. Бэкенд (порт 8080)
cd server
npm install
npm start

# 2. Фронтенд (порт 5173), в другом терминале
cd web
npm install
npm run dev
```

## Использование

Откройте http://localhost:5173 — вкладки «Гость» и «Владелец»:

- **Гость** — выбирает тип события, дату и свободный слот, оставляет имя и
  email и получает подтверждение бронирования.
- **Владелец** — создаёт типы событий (название + длительность), смотрит
  предстоящие и прошедшие брони, отменяет их.

> Бэкенд хранит данные в памяти: после перезапуска сервиса бронирования и
> созданные типы событий сбрасываются в демонстрационные.

## Docker и деплой

Один Docker-образ содержит всё приложение: бэкенд (API `/guest`, `/admin`,
`/health`) и собранный фронтенд — сервер раздаёт статику `web/dist` и
SPA-fallback. Порт задаётся переменной окружения **PORT** (обязательна для
платформ деплоя; локально по умолчанию 8080).

```bash
# Сборка образа
docker build -t calendar-booking .

# Запуск: приложение стартует автоматически по PORT
docker run --rm -p 3000:3000 -e PORT=3000 calendar-booking
curl http://localhost:3000/health   # {"status":"ok"}
```

Как это устроено (`Dockerfile`, многостадийная сборка):

1. **web-build** — `node:24-alpine`, `npm ci` + `npm run build` во фронтенде;
2. **runtime** — `node:24-alpine` (непривилегированный пользователь `node`),
   только исходники `server/src` + артефакт `web/dist`. Runtime-зависимостей
   нет: Node 24 исполняет TypeScript нативно.

Деплой настраивается Blueprint'ом Render `render.yaml` (сервис `docker`,
health-check `/health`, автодеплой из `main`, Render сам подставляет PORT):
[Deploy to Render](https://render.com/deploy?repo=https://github.com/FoxxMGR/fullstack-javascript-project-387).
На free-плане сервис «засыпает» без трафика: первый запрос может просыпаться
до ~60 секунд. Данные в памяти — при перезапуске сбрасываются в демо.

## Интеграционные тесты (Playwright)

Тесты в `e2e/` проверяют основной пользовательский сценарий бронирования в
реальном браузере (фронтенд + бэкенд), а также ключевое бизнес-правило
«занятый слот нельзя забронировать дважды».

```bash
cd e2e
npm install
npx playwright install chromium   # один раз
npm test                          # Playwright сам поднимает server и web
```

В CI (`.github/workflows/e2e.yml`) тесты запускаются на каждый push/PR, отчёт
сохраняется артефактом при падении. Подробнее — в `e2e/README.md`.

## Релизы и changelog

- Коммиты пишутся по **Conventional Commits** — см. `CONTRIBUTING.md`.
- **release-it** (`.github/workflows/release.yml`) запускается на каждый push
  в `main`: если среди новых коммитов есть `feat`/`fix`/`perf`/`revert` или
  breaking-изменения, автоматически публикуется релиз — версия поднимается
  по semver, обновляется `CHANGELOG.md`, ставится тег `vX.Y.Z`, создаётся
  GitHub Release, а коммит `chore(release): vX.Y.Z` пушится в `main`
  (с пометкой `[skip ci]`).
- Прочие типы коммитов (`docs`, `ci`, `chore`, `test`, `build`, `style`,
  `refactor`) релиз не создают — воркфлоу завершается без действий.
- Дополнительные настройки не нужны: используется стандартный `GITHUB_TOKEN`
  с правом `contents: write` (pull request'ы воркфлоу не создаёт).
- Версии до 0.2.0 выпускались в предыдущем репозитории проекта (см.
  `CHANGELOG.md`); в этом репозитории нумерация продолжается от них.

## Рабочий процесс с агентом (OpenCode)

Агент подключён к репозиторию как участник процесса разработки:

1. **Issues** — задачи из [ROADMAP.md](ROADMAP.md) заводятся как issue с
   метками `feature` / `bug` / `ci`. Задачу можно обсудить в комментариях —
   агент подключается к диалогу.
2. **Triage** — агент разбирает задачу: воспроизводит баг, предлагает план
   решения и перечисляет затрагиваемые файлы.
3. **Pull request** — агент делает PR с реализацией, привязанный к issue.
4. **Ревью** — замечания в ревью агент обрабатывает, дорабатывая PR.
5. **Регулярные проверки** — ночные проверки по расписанию
   (`schedule`-workflow), например Lighthouse-аудит фронтенда, с отчётом.

## Status

[![hexlet-check](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions)
[![e2e](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/e2e.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/e2e.yml)
[![commitlint](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/commitlint.yml/badge.svg)](https://github.com/FoxxMGR/fullstack-javascript-project-387/actions/workflows/commitlint.yml)
[![Deploy on Render](https://img.shields.io/badge/deploy-Render-46E3B8?logo=render&logoColor=white)](https://render.com/deploy?repo=https://github.com/FoxxMGR/fullstack-javascript-project-387)

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>

## О Хекслете

[Хекслет](https://ru.hexlet.io/) — школа программирования: авторские программы обучения с практикой, поддержкой наставников и реальными проектами, которые остаются в резюме. Этот репозиторий — один из таких проектов.