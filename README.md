# Booking Platform

Платформа онлайн-записи к мастерам.

## Технологии
- React + TypeScript
- Vite
- React Router
- GitHub Pages — публикация интерфейса
- Supabase — планируемая база данных, авторизация и серверная логика

## Локальный запуск
```bash
npm install
npm run dev
```

## Сборка
```bash
npm run build
npm run preview
```

## Публикация
GitHub Actions собирает проект и публикует папку `dist` в GitHub Pages после push в ветку `main`.

Для репозитория `SaitTony/booking-platform` базовый путь приложения — `/booking-platform/`. В репозитории откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.

## Маршруты
- `/` — стартовая страница
- `/:slug` — персональная страница мастера
- `/admin` — будущая панель управления

Пока это каркас интерфейса. Supabase, авторизация, схема БД и защищённое бронирование будут добавляться отдельными этапами. Секретный service-role ключ Supabase нельзя помещать во frontend или GitHub.
