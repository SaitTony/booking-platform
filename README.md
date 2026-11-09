# Workflows

Workflows — платформа онлайн-записи к индивидуальным мастерам и командам компаний.

## Текущий стек

- Frontend: React 19, TypeScript, Vite, React Router.
- Публикация frontend: GitHub Pages.
- Backend: Supabase PostgreSQL, Auth, Edge Functions и RLS.
- Проверки: GitHub Actions, TypeScript/Vite build, локальная disposable Supabase DB, pgTAP и Deno.
- Основная ветка разработки и публикации: `main`.

## Ссылки

- Публичное приложение: https://saittony.github.io/workflows/
- Административная панель: https://saittony.github.io/workflows/admin
- Supabase project ref: `cetcxttaqtberrntsntr`
- Supabase API: https://cetcxttaqtberrntsntr.supabase.co

## Локальный запуск

Требуются Node.js 22 и npm.

```bash
npm ci
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

Для локального frontend задайте:
- `VITE_SUPABASE_URL=https://cetcxttaqtberrntsntr.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key проекта>`

Публичный publishable key допустим во frontend. Никогда не добавляйте `service_role` или secret key в Vite-переменные, GitHub Pages или клиентский код.

## Публикация и проверки

- GitHub Pages публикует только ветку `main`.
- Backend Edge Functions разворачиваются workflow GitHub Actions при изменениях в `supabase/functions/**` или deploy workflow.
- CI проверяет сборку, миграции на одноразовой локальной Supabase DB, pgTAP-тесты и типизацию всех Edge Functions.
- Схема hosted Supabase изменяется только миграциями из `supabase/migrations`.
- Не применяйте уже выполненные миграции повторно.

## Основные маршруты

- `/pro/:slug` — публичная индивидуальная страница Master_pro.
- `/:companySlug` — публичная страница компании.
- `/:companySlug/:masterSlug` — публичная страница мастера компании.
- `/admin/*` — административная панель и рабочие пространства.
- `/admin/master-pro-builder` — демонстрационный прототип конструктора Master_pro, пока без сохранения в Supabase.
- `/demo` и `/demo/**` — отдельный демонстрационный режим на тестовых данных.

Системные slug компаний `admin`, `demo` и `pro` зарезервированы и не могут быть назначены компании.

## Документация

- [Архитектура и бизнес-правила](docs/architecture.md)
- [Каталог UI-компонентов](docs/UI_COMPONENT_CATALOG.md)
- [Настройка и эксплуатация Supabase](supabase/README.md)

## Важные текущие ограничения

- Конструктор Master_pro — интерактивный прототип; изменения в нём не сохраняются в БД и не публикуются.
- Фото и обложки пока хранятся как URL-поля; полноценная загрузка файлов в Supabase Storage не подключена.
- Интерфейс редактирования правил онлайн-записи пока не реализован, хотя `booking_settings.rules_text` существует в БД.
- PostHog-проект создан, но frontend SDK и события аналитики ещё не подключены.
- Перед запуском для реальных клиентов необходимы сквозные тесты всех ролей и сценариев бронирования.
