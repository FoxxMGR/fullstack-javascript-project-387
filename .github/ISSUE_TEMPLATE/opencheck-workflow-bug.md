---
name: opencheck.yml workflow bug
about: opencheck.yml has typo in action name and wrong model slug; opencode.yml is missing id-token: write
title: 'opencheck.yml: опечатка в action и модели — агент не проходит этап publish'
labels: bug, ci
---

## Что происходит сейчас (воспроизведение / диагноз)

Когда кто-то пишет `/oc fix this` или `/opencheck fix this` в issue/PR,
workflow `opencode.yml` запускается, агент OpenCode начинает работать
(этап **explain**), но **не завершает цикл** — не создаёт коммиты, не открывает
PR и не публикует ответ.

### Причина

В `opencode.yml` в `permissions:` **отсутствует `id-token: write`**.
GitHub Action `anomalyco/opencode/github` использует OIDC для аутентификации
OpenCode App, и без `id-token: write` она падает с ошибкой **403** на
`POST /issues/{n}/comments` и `POST /repos/{owner}/{repo}/issues/{n}/reactions`.

Это подтверждено комментариями в `opencheck.yml`:

> `id-token: write` (для OIDC-аутентификации OpenCode App — без неё action
> падает с 403 на POST /issues/{n}/comments и /reactions).

Тот же паттерн работает в `auto-review.yml` и `night-check.yml`, где
`id-token: write` есть.

### Дополнительная проблема: `opencheck.yml` сломан

Файл `.github/workflows/opencheck.yml` — дубликат `opencode.yml` с двумя
критическими опечатками:

1. **Опечатка в action**: `anomalo/opencode/github@latest` вместо
   `anomalyco/opencode/github@latest` → action не найден, workflow падает
   немедленно.
2. **Неверная модель**: `opencheck/ling-3.0-flash-fin-free` вместо
   `opencode/ling-3.0-flash-fin-free` → слаг `opencheck/` не существует в
   реестре моделей OpenCode Zen.

Кроме того, `opencheck.yml` конфликтует с `opencode.yml`: оба реагируют на
`/oc`, что может запустить два агента одновременно.

## Оценка (объём, затронутые файлы)

| Файл | Изменение |
|------|-----------|
| `.github/workflows/opencode.yml` | добавить `id-token: write` в `permissions`, обновить `actions/checkout` до v7 |
| `.github/workflows/opencheck.yml` | удалить (сломанный дубликат) |
| `.github/workflows/night-check.yml` | исправить модель `opencheck/...` → `opencode/...` |
| `README.md` | исправить опечатку модели `opencheck/...` → `opencode/...` |

**Объём**: небольшой, ~4 файлов, только CI/CD и документация.

## План реализации

1. ✅ Добавить `id-token: write` в `permissions` `opencode.yml` (ключевое исправление)
2. ✅ Обновить `actions/checkout` с v6 до v7
3. ✅ Удалить `opencheck.yml` (сломанный дубликат)
4. ✅ Исправить модель в `night-check.yml`
5. ✅ Исправить опечатку модели в `README.md`
6. Создать ветку `fix/opencheck-workflow-broken`, закоммитить, открыть PR
7. После мержа — релиз через `release.yml`

## Готово к PR

Все изменения внесены в ветку `fix/opencheck-workflow-broken`.
Команда для вызова агента: `/oc fix this`
