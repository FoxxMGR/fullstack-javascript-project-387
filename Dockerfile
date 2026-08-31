# syntax=docker/dockerfile:1

# ===== Стадия 1: сборка фронтенда (Vite → статика) =====
FROM node:24-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ===== Стадия 2: runtime =====
# Бэкенд не имеет runtime-зависимостей и исполняет TypeScript нативно
# (Node 24, без шага компиляции). В образ идут только исходники сервера
# и собранная статика фронтенда: один контейнер обслуживает и API (/guest,
# /admin, /health), и SPA по PORT из окружения.
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/tsconfig.json ./server/
COPY server/src ./server/src
COPY --from=web-build /app/web/dist ./web/dist
# Документация порта: фактический порт задаётся переменной окружения PORT
# (платформа деплоя подставляет своё значение, приложение его читает).
EXPOSE 8080
# Непривилегированный пользователь из официального образа.
USER node
CMD ["node", "server/src/server.ts"]
