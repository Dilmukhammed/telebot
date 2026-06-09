# EduCenter — Документация проекта

## Обзор

Telegram Mini App для образовательного центра. Ученики записываются на уроки, учителя ведут расписание и посещаемость, админ управляет всем через админ-панель.

---

## Архитектура

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram App   │────▶│  Vercel (Frontend)│────▶│ Railway (Backend)│
│  (Mini App)     │     │  React + Vite    │     │ FastAPI + aiogram│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                   ┌──────▼──────┐
                                                   │   SQLite    │
                                                   │  app.db     │
                                                   │ (persistent)│
                                                   └─────────────┘
```

### Frontend (Vercel)
- **URL:** https://telebot-blush.vercel.app
- **Стек:** React 19, TypeScript, Vite, @twa-dev/sdk
- **i18n:** react-i18next (ru, en, uz)

### Backend (Railway)
- **URL:** https://serene-manifestation-production-5a60.up.railway.app
- **Стек:** FastAPI, aiogram, SQLAlchemy, aiosqlite
- **Бот:** @ZuhraMathBot (id: 8936387460)

---

## Авторизация

### Две системы авторизации:

| Система | Таблица | Для чего | Как работает |
|---------|---------|----------|--------------|
| JWT | `admins` | Админ-панель `/admin` | Логин/пароль → JWT токен |
| Telegram | `users` | Mini App | Telegram initData → HMAC проверка |

### Telegram Auth Flow (Mini App):
1. Пользователь открывает Mini App в Telegram
2. Frontend отправляет `X-Telegram-Init-Data` (HMAC) + `X-Telegram-User` (fallback)
3. Backend ищет пользователя:
   - По `telegram_id` → если нашёл → возвращает
   - По `username` → если нашёл → обновляет `telegram_id` → возвращает
   - Не нашёл → создаёт нового (role=student)
4. Frontend показывает данные пользователя

### Роли:
- **student** — ученик, видит расписание, записывается на уроки
- **teacher** — учитель, ведёт уроки, отмечает посещаемость
- **admin** — администратор, управляет всем

---

## База данных

### SQLite на Railway (persistent volume)

**Важно:** `app.db` удалена из Git. При первом деплое создаётся пустая, seed заполняет admin.

### Таблицы (15 штук):

| Таблица | Описание |
|---------|----------|
| `users` | Все пользователи (student, teacher, admin) |
| `admins` | JWT-авторизация админов |
| `subjects` | Предметы (Математика, English и т.д.) |
| `lessons` | Уроки (дата, время, аудитория, учитель) |
| `lesson_enrollments` | Записи учеников на уроки |
| `lesson_statuses` | Статусы уроков (happened, cancelled, rescheduled) |
| `attendance` | Посещаемость |
| `teacher_availability` | Доступность учителей |
| `tests` | Тесты/экзамены |
| `registrations` | Записи на тесты |
| `results` | Результаты тестов |
| `notifications` | Уведомления |
| `notification_recipients` | Получатели уведомлений |
| `audit_logs` | Лог действий |

### Seed (запускается при каждом старте):
- Создаёт admin `gi_rocke` в обеих таблицах (`admins` + `users`)
- Idempotent — пропускает если уже существует
- Учителя и ученики создаются через UI

### RESET_DB:
- Переменная окружения `RESET_DB=true` — очищает все таблицы при старте
- Использовать только при необходимости (сброс базы)
- После сброса поставить `RESET_DB=false`

---

## Деплой

### Frontend (Vercel):
- Автоматический деплой при push в `main`
- Переменные окружения: `VITE_API_URL`, `VITE_BOT_USERNAME`

### Backend (Railway):
- Автоматический деплой при push в `main`
- Dockerfile в `backend/Dockerfile`

### Переменные окружения (Railway):

| Переменная | Описание |
|-----------|----------|
| `BOT_TOKEN` | Токен Telegram бота |
| `ADMIN_JWT_SECRET` | Секрет для JWT токенов админа |
| `DATABASE_URL` | `sqlite+aiosqlite:///./app.db` |
| `WEBAPP_URL` | URL фронтенда |
| `WEBHOOK_URL` | URL для webhook бота |
| `CORS_ORIGINS` | Разрешённые origins (по умолчанию `*`) |
| `RESET_DB` | `true`/`false` — очистка базы при старте |

---

## Структура проекта

```
├── backend/
│   ├── api/
│   │   ├── admin.py          # Админ-эндпоинты (курсы, уроки, учителя)
│   │   ├── admin_auth.py     # JWT-авторизация админа
│   │   ├── deps.py           # Авторизация (Telegram HMAC, X-Telegram-User)
│   │   ├── router.py         # Общий роутер
│   │   └── student.py        # Эндпоинты для учеников
│   ├── bot/
│   │   ├── bot.py            # aiogram бот
│   │   └── handlers/         # Хендлеры бота
│   ├── config.py             # Настройки (env vars)
│   ├── database.py           # SQLAlchemy engine + session
│   ├── main.py               # FastAPI app + lifespan
│   ├── models.py             # SQLAlchemy модели (15 таблиц)
│   ├── schemas.py            # Pydantic схемы
│   ├── scheduler.py          # APScheduler (напоминания)
│   ├── seed.py               # Production seed (admin only)
│   └── auth.py               # JWT + bcrypt
├── mini-app/
│   ├── src/
│   │   ├── api/client.ts     # API клиент
│   │   ├── components/       # React компоненты
│   │   ├── context/          # UserContext
│   │   ├── pages/            # Страницы
│   │   └── i18n/             # Переводы (ru, en, uz)
│   └── ...
└── docs/
    └── project-overview.md   # Этот файл
```

---

## Важные решения

### Почему SQLite?
- Простота для MVP
- Persistent volume на Railway хранит данные между деплоями
- При масштабировании можно перейти на PostgreSQL

### Почему две таблицы для авторизации?
- `admins` — отдельная для JWT (логин/пароль в браузере)
- `users` — для Telegram (Mini App, initData)
- Admin дублируется в обеих таблицах с одинаковым `username`

### Почему seed только admin?
- Учителей и учеников создаёт админ через UI
- Не нужно хардкодить пользователей
- Seed нужен только для первого входа

---

## История изменений

### 2026-06-09
- Production cleanup: удалены демо-скрипты, app.db из Git
- Добавлен чистый seed (admin only)
- Добавлен RESET_DB env var
- Фикс auth: X-Telegram-User header fallback для production

---

## TODO

- [ ] Админ может создавать других админов
- [ ] Админ может создавать учителей
- [ ] i18n для админ-панели (сейчас hardcoded RU)
