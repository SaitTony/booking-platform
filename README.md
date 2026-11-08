# Платформа онлайн-записи

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
GitHub Actions собирает проект и публикует папку `dist` в GitHub Pages после push в ветки `main` и `feature/full-platform-implementation`.

Для репозитория `SaitTony/workflows` базовый путь приложения — `/workflows/`. В репозитории откройте **Settings → Pages → Build and deployment → Source → GitHub Actions**.

## Маршруты
- `/` — перенаправление на `/demo`
- `/demo` — демонстрационная стартовая страница
- `/demo/my-company` — демонстрационная компания
- `/demo/pro/:slug` — демонстрационная индивидуальная страница мастера
- `/:slug` — персональная страница мастера
- `/admin` — будущая панель управления

Пока это каркас интерфейса. Supabase, авторизация, схема БД и защищённое бронирование будут добавляться отдельными этапами. Секретный service-role ключ Supabase нельзя помещать во frontend или GitHub.
