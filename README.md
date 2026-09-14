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
6. **Автолечение** — если проверки на PR агента упали, агент чинит их сам,
   без напоминаний: см. «Автолечение агентских PR» ниже.

### Единый источник правил агента

Правила, которые агент обязан соблюдать (Definition of Done, формат коммитов,
детерминированность тестов, запрет дублей и т. д.), лежат в одном файле —
[`.github/agent-prompt.md`](.github/agent-prompt.md). Его читают воркфлоу
`opencode`, `auto-review` и `auto-heal` из default-ветки и подставляют в
`prompt`, поэтому:

- правило правится в **одном** месте и действует сразу на всех issues и PR;
- напоминать агенту в комментариях («не забудь commitlint») больше не нужно;
- воркфлоу не падает, если файла нет: промпт просто остаётся коротким.

Что менять в первую очередь, если агент снова нарушил процесс:

| Симптом | Куда вносить правило |
| ------- | -------------------- |
| Коммит не Conventional Commits → красный `commitlint` | `.github/agent-prompt.md` → «Правила коммитов» |
| Красный `e2e` после UI-правки | `.github/agent-prompt.md` → Definition of Done, п. 2 и 5 |
| Флак, зависящий от времени прогона | `.github/agent-prompt.md` → п. 3 + `e2e/README.md` → «Детерминированность» |
| PR дублирует другой PR/issue | `.github/agent-prompt.md` → «Порядок работы», п. 1 |
| PR не связан с issue | `.github/agent-prompt.md` → п. 7 (фактический номер issue) |

### Воркфлоу агента

| Воркфлоу                 | Событие / запуск                                  | Модель (провайдер/модель)      | Назначение                                                    | Права                                                                 |
| ------------------------ | ------------------------------------------------ | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `.github/workflows/opencode.yml` | `issue_comment` + `pull_request_review_comment`, команда `/oc` или `/opencode` | `opencode/mimo-v2.5-free` | Интерактивный вызов: triage, ответы в тредах, создание веток и PR по команде | `contents/issues/pull-requests: write` (нужны на коммиты/задачи/PR) |
| `.github/workflows/auto-review.yml` | `pull_request`: `opened, synchronize, reopened, ready_for_review` | `opencode/mimo-v2.5-free` | Авторевью каждого PR: первый проход по стилю, типам и очевидным ошибкам | `contents/pull-requests/issues: read` + `id-token: write` (без права сливать) |
| `.github/workflows/auto-heal.yml` | `workflow_run` падений `e2e`/`commitlint`/`hexlet-check` + `workflow_dispatch` | `opencode/mimo-v2.5-free` | Самолечение PR агента: агент сам чинит упавшие проверки в ветке PR (до 3 попыток) | `plan` — чтение + `actions/issues: write`; `heal` — `contents: write` + `id-token: write` |
| `.github/workflows/night-check.yml` | `schedule` `0 3 * * *` (03:00 UTC = 06:00 МСК) + `workflow_dispatch` | `opencode/mimo-v2.5-free` | Ночной Lighthouse-аудит по `APP_URL`, разбор отчёта, создание issue с итогами | `contents: read`, `issues: write` + `id-token: write` |

Прогоны смотреть на вкладке **Actions** репозитория: слева список воркфлоу
(`opencode`, `auto-review`, `auto-heal`, `night-check`) или сводный дашборд.
Артефакты (отчёт Lighthouse) — внутри прогона `night-check`, в job
`lighthouse`, раздел **Artifacts**.

### Автолечение агентских PR

Агент не оставляет красный PR человеку «на разбор»: упавшую проверку он чинит
сам. Механика — `.github/workflows/auto-heal.yml`:

1. падение `e2e`, `commitlint` или `hexlet-check` на PR агента (ветка
   `opencode/*` или автор-бот) ловится событием `workflow_run`;
2. job `plan` комментирует причину в PR (`упавшие job`, ссылка на прогон) и
   запускает лечение через `workflow_dispatch`;
3. job `heal` запускает агента **в ветке PR**: он воспроизводит падение
   локально, исправляет причину и пушит обратно в ту же ветку;
4. новый push запускает CI заново — цикл повторяется, пока проверки не станут
   зелёными.

Почему через `workflow_dispatch`: action OpenCode реагирует на `issue_comment`,
`pull_request_review_comment`, `issues`, `pull_request`, `schedule` и
`workflow_dispatch`, а на `workflow_run` — нет. При этом `workflow_dispatch` —
единственное событие, которое можно запустить из воркфлоу без PAT (комментарий,
поставленный `GITHUB_TOKEN`, новых прогонов не создаёт). Агент же пушит
App-токеном OpenCode, поэтому его push создаёт новые прогоны CI.

Пределы и защита:

- один коммит лечится один раз — маркер `<!-- auto-heal:<sha> -->`;
- максимум **3 попытки** на PR, дальше агент оставляет комментарий «нужен
  человек» и не вмешивается;
- `concurrency` сериализует `plan` по ветке: `e2e` и `commitlint` падают почти
  одновременно, лечение запускается один раз;
- ослаблять проверки, удалять или отключать тесты ради «зелёного» PR
  запрещено — это прямо записано в правилах агента;
- трогаются только PR агента: PR человека CI-помощник не изменяет;
- `auto-heal` запускается событием CI, а не комментарием, поэтому список
  `AGENT_ALLOWED_AUTHORS` его не гейтит — «дверь» для человека и «дверь» для
  падения проверок разные (вторая уже ограничена: только PR агента);
- если лечение не сдвинуло ветку (агент не смог починить сам), в логе прогона
  `heal` появляется warning с номером PR — такой PR по-прежнему ждёт человека.

Самолечение включается, когда `auto-heal.yml` попадёт в default-ветку: событие
`workflow_run` и запуск по `workflow_dispatch` читают файл воркфлоу именно
оттуда.

### Устойчивость: петли, права, вызов

- **Петли.** Интерактивный воркфлоу `opencode.yml` реагирует на комментарии,
  а ответ агента — тоже комментарий, поэтому без фильтра получается лавина
  прогонов. Защита: события от ботов и приложения отсекаются
  (`github.event.comment.user.type != 'Bot'`), а набор команд вызова задан
  явно через `mentions: '/oc, /opencode'` (совпадает с дефолтом, но
  зафиксирован в коде). `auto-review` и `night-check` триггерятся не
  комментарием, поэтому фильтр ботов им не нужен — это отражено в их
  комментариях-шапках.
- **Кто может звать агента.** В открытом репозитории круг вызывающих сужен:
  в `opencode.yml` автор комментария должен быть в переменной репозитория
  `AGENT_ALLOWED_AUTHORS` (список логинов через запятую). Задайте её в
  Settings → Secrets and variables → Actions → **Variables**; по умолчанию
  воркфлоу никого не пропускает (fail-safe).
- **Права.** Права выданы по воркфлоу отдельно и минимальные: write на
  содержимое есть только там, где агент реально создаёт коммиты/ветки/PR
  (`opencode`, `auto-heal`), авторевью — только чтение + `id-token`, ночной
  отчёт создаёт только issue (`issues: write`), без прав на содержимое и PR.
  `auto-heal` разделён на два job'а: `plan` умеет лишь читать, запускать
  воркфлоу и комментировать, а `contents: write` получает только `heal`.
- **Модель.** Во всех воркфлоу используется одна дешёвая модель
  `opencode/mimo-v2.5-free` (провайдер OpenCode Zen): задачи здесь —
  разбор текста, ревью и короткие отчёты, дорогая модель не нужна. Параметр
  `variant` уровня рассуждений не задан (по умолчанию); `agent` тоже — берётся
  агент `build` из умолчаний. В `night-check.yml` модель задана как
  `${{ inputs.model || 'opencode/mimo-v2.5-free' }}`: у `schedule`-события нет
  `inputs`, поэтому нужен фолбэк на значение по умолчанию.

### Публикация сессий (share)

Репозиторий публичный, а сессии OpenCode по умолчанию доступны по ссылке
(`share: true`). Мы это отключаем: в `opencode.yml` стоит `share: false` —
контекст и переписка агента не публикуются по внешней ссылке. Решение принято
осознанно; если понадобится шерить сессии (например, для обсуждения с
внешними), достаточно переключить флаг.

### Самооценка работы агента

Сводка по тому, как проходили задачи (детали — в истории веток и PR):

- **С первого прохода:** `opencode.yml` (триггер по `/oc`), типы и сборка
  (серверный код проходит `tsc` без правок), Conventional Commits
  (все коммиты, включая `fix/test/docs/ci`, прошли `commitlint` с первого раза),
  открытие веток и PR-описание.
- **Потребовали итераций:**
  - подбор модели OpenCode Zen — исходно выбрана недоступная
    `deepseek-v4-flash-free`, перепроверка списка моделей и замена на
    `ling-3.0-flash-fin-free`;
  - способ публикации ответов агента (App-токен → `github_token` через
    `use_github_token`), был шаг с падением и возвратом рабочей конфигурации;
  - при локальной проверке ночного воркфлоу Lighthouse пришлось вручную
    установить Chromium и системные библиотеки (NSS/ALSA) в окружении без
    root-прав;
  - дважды приходилось править структуру веток CI (убирался лишний diff из
    предыдущего сценария) — чисто процедурно, без изменений кода.
- **Вывод:** процесс устойчив к петлям и сбоям триггеров, права выверены, а
  стоимость агентских прогонов держится на одной бесплатной модели за счёт
  того, что задачи не требуют самой дорогой.

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