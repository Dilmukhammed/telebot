# Telegram Mock Test Registration Bot

## TL;DR

> **Quick Summary**: Полноценный Telegram Mini App для регистрации студентов на мок-тесты в учебном центре + админ-панель для управления расписанием. Стек: Python (FastAPI + aiogram), React (Vite), SQLite, TDD.
>
> **Deliverables**:
> - Telegram бот с Web App (React) — просмотр тестов, регистрация, результаты, напоминания
> - Админ-панель (React) — управление тестами, просмотр записей, вход по логину/паролю
> - REST API (FastAPI) — обслуживает оба фронтенда
> - Система напоминаний — бот отправляет уведомления перед тестами
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 5 → Task 8 → Task 13-16 → Task 20 → F1-F4

---

## Context

### Original Request
Создать Telegram-бота с Mini App для регистрации на мок-тесты в учебном центре. Студенты просматривают доступные тесты, регистрируются, видят результаты. Администраторы управляют расписанием через веб-панель.

### Interview Summary
**Key Discussions**:
- **Стек**: Python (FastAPI + aiogram 3.x) — решающий фактор: aiogram — лучшая библиотека для Telegram ботов на Python
- **БД**: SQLite — простота, не требует сервера, идеально для MVP
- **Фронтенд**: React + Vite для обоих интерфейсов — единый стек, переиспользование
- **Роли**: Только студенты (Mini App) + администраторы (Web панель). Без преподавателей.
- **Оплата**: Заглушка — не интегрируем реальную платёжную систему
- **Деплой**: Локально (MVP first), продакшен позже
- **Аутентификация**: Админы — логин/пароль + JWT; Студенты — через Telegram initData
- **Напоминания**: Бот отправляет личные сообщения перед тестом
- **Тестирование**: TDD — pytest (Python) + vitest (React)

**Research Findings**:
- (librarian agents still running — patterns will be incorporated during implementation)

### Metis Review
**Identified Gaps** (addressed):
- Админ-команды бота: упомянуты но не детализированы — включены как вспомогательный канал управления (Task 22)
- Валидация Telegram initData: критична для безопасности — выделена в отдельную задачу (Task 7)

---

## Work Objectives

### Core Objective
Telegram-бот + Mini App + Админ-панель для регистрации студентов на мок-тесты с полным циклом: создание тестов → регистрация → результаты → напоминания.

### Concrete Deliverables
- `backend/` — FastAPI приложение + aiogram бот (Python)
- `backend/models.py` — SQLAlchemy модели (Subject, Test, Registration, Result, Admin)
- `backend/api/` — REST API эндпоинты (tests, registrations, results, admin)
- `backend/bot/` — aiogram бот (команды, webhook, напоминания)
- `mini-app/` — React Telegram Mini App (Vite)
- `admin-panel/` — React админ-панель (Vite)
- `backend/tests/` — pytest тесты
- `mini-app/src/__tests__/` — vitest тесты

### Definition of Done
- [ ] Студент открывает бота → видит кнопку «Открыть приложение» → попадает в Mini App
- [ ] Mini App показывает список доступных тестов с фильтрацией по предмету
- [ ] Студент регистрируется на тест → запись сохраняется → видна в «Мои записи»
- [ ] Админ заходит в веб-панель → логинится → создаёт/редактирует/удаляет тесты
- [ ] Бот отправляет напоминание за 1 час до теста
- [ ] `pytest` → все тесты проходят
- [ ] `npm test` (mini-app) → все тесты проходят
- [ ] `npm test` (admin-panel) → все тесты проходят

### Must Have
- Telegram Mini App с навигацией между экранами (список тестов / детали / регистрация / мои записи / результаты)
- Валидация Telegram initData на бэкенде (безопасность)
- CRUD тестов через админ-панель
- Ограничение по количеству мест (нельзя зарегистрироваться на заполненный тест)
- Напоминания от бота (сообщение в Telegram)
- Аутентификация админов (JWT)

### Must NOT Have (Guardrails)
- **NO** реальная платёжная интеграция — только заглушка
- **NO** деплой на продакшен — только локальная разработка
- **NO** роли преподавателей — только студенты и админы
- **NO** онлайн-сдача тестов — только регистрация
- **NO** over-engineering: без микросервисов, без Docker (на MVP), без Redis
- **NO** AI slop: избегать чрезмерной абстракции, избыточных комментариев, преждевременной оптимизации

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield — будет создана)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: pytest (Python) + vitest (React)
- **Setup tasks**: Tasks 3-4 создают структуру и примеры тестов

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Backend**: Bash (curl) — Send requests, assert status + response fields
- **Frontend Mini App**: Playwright — Navigate, interact, assert DOM, screenshot
- **Admin Panel**: Playwright — Login, CRUD operations, verify state
- **CLI/TUI**: interactive_bash (tmux) — Run tests, verify output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + scaffolding, 7 tasks):
├── Task 1: Project scaffolding + monorepo structure [quick]
├── Task 2: Environment config + settings [quick]
├── Task 3: Database models (SQLAlchemy) + migrations [quick]
├── Task 4: pytest + vitest infrastructure setup [quick]
├── Task 5: Shared API type definitions [quick]
├── Task 6: FastAPI app skeleton + health check [quick]
└── Task 7: aiogram bot skeleton + webhook integration [quick]

Wave 2 (After Wave 1 — core backend + frontend foundations, MAX PARALLEL, 8 tasks):
├── Task 8: Admin auth (login/password + JWT) [quick]
├── Task 9: Telegram initData validation middleware [quick]
├── Task 10: Test CRUD API endpoints [unspecified-high]
├── Task 11: Registration API (enroll + capacity check) [unspecified-high]
├── Task 12: Results API (CRUD results) [quick]
├── Task 13: React Mini App scaffolding + Telegram SDK integration [visual-engineering]
├── Task 14: React Admin Panel scaffolding + routing [visual-engineering]
└── Task 15: Shared UI components + design system [visual-engineering]

Wave 3 (After Wave 2 — UI screens, MAX PARALLEL, 7 tasks):
├── Task 16: Mini App: Home screen (test list + filters) [visual-engineering]
├── Task 17: Mini App: Test detail + registration screen [visual-engineering]
├── Task 18: Mini App: My registrations screen [visual-engineering]
├── Task 19: Mini App: My results screen [visual-engineering]
├── Task 20: Admin Panel: Login page [visual-engineering]
├── Task 21: Admin Panel: Tests management (CRUD table + forms) [visual-engineering]
└── Task 22: Admin Panel: Registrations view [visual-engineering]

Wave 4 (After Wave 3 — integration + extras, 4 tasks):
├── Task 23: Admin bot commands (/add_test, /results, /list) [quick]
├── Task 24: Payment stub placeholder [quick]
├── Task 25: Reminders system (APScheduler + bot messages) [unspecified-high]
└── Task 26: End-to-end flow integration + polish [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan Compliance Audit (oracle)
├── Task F2: Code Quality Review (unspecified-high)
├── Task F3: Real Manual QA (unspecified-high + playwright)
└── Task F4: Scope Fidelity Check (deep)
→ Present results → Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-7, 13-15 | 1 |
| 2 | — | 5-7 | 1 |
| 3 | 1 | 8-12 | 1 |
| 4 | 1 | 8-12 | 1 |
| 5 | 1, 2 | 8-12, 13-15 | 1 |
| 6 | 1 | 8-12 | 1 |
| 7 | 1, 2 | 8-12, 23, 25 | 1 |
| 8 | 3, 4, 5, 6 | 20 | 2 |
| 9 | 5, 6, 7 | 10-12, 16-19 | 2 |
| 10 | 3, 5, 6, 9 | 16, 17, 21 | 2 |
| 11 | 3, 5, 6, 9 | 16-19, 22 | 2 |
| 12 | 3, 5, 6, 9 | 19, 22 | 2 |
| 13 | 1, 5 | 16-19 | 2 |
| 14 | 1, 5 | 20-22 | 2 |
| 15 | 13, 14 | 16-22 | 2 |
| 16 | 10, 11, 13, 15 | 26 | 3 |
| 17 | 10, 11, 13, 15 | 26 | 3 |
| 18 | 11, 13, 15 | 26 | 3 |
| 19 | 12, 13, 15 | 26 | 3 |
| 20 | 8, 14, 15 | 26 | 3 |
| 21 | 10, 14, 15 | 26 | 3 |
| 22 | 11, 12, 14, 15 | 26 | 3 |
| 23 | 7, 10, 11 | 26 | 4 |
| 24 | — | 26 | 4 |
| 25 | 7, 11 | 26 | 4 |
| 26 | 16-25 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: 7 tasks — T1-T7 → `quick`
- **Wave 2**: 8 tasks — T8-T9 → `quick`, T10-T11 → `unspecified-high`, T12 → `quick`, T13-T15 → `visual-engineering`
- **Wave 3**: 7 tasks — T16-T22 → `visual-engineering`
- **Wave 4**: 4 tasks — T23-T24 → `quick`, T25 → `unspecified-high`, T26 → `deep`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. **Project scaffolding + monorepo structure**

  **What to do**:
  - Создать корневую структуру: `backend/`, `mini-app/`, `admin-panel/`
  - Backend: инициализировать Python проект с `requirements.txt` или `pyproject.toml` (fastapi, aiogram, sqlalchemy, aiosqlite, uvicorn, pytest, httpx)
  - Mini App: инициализировать React проект через `npm create vite@latest mini-app -- --template react-ts`
  - Admin Panel: инициализировать React проект через `npm create vite@latest admin-panel -- --template react-ts`
  - Установить зависимости фронтенда: `@twa-dev/sdk`, `react-router-dom`
  - Создать корневой `README.md` с инструкциями по запуску

  **Must NOT do**:
  - Не добавлять Docker, docker-compose
  - Не создавать сложную монорепу (nx, turborepo) — просто отдельные папки

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Стандартная инициализация проектов, copy-paste шаблонов
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2-7)
  - **Blocks**: Tasks 3-7, 13-15
  - **Blocked By**: None

  **References**:
  - `https://core.telegram.org/bots/webapps` — Telegram Mini App overview
  - `https://docs.aiogram.dev/en/latest/` — aiogram 3.x docs (installation, quickstart)

  **Acceptance Criteria**:
  - [ ] `backend/` exists with `requirements.txt`
  - [ ] `mini-app/` exists with `package.json` (react, vite, typescript)
  - [ ] `admin-panel/` exists with `package.json` (react, vite, typescript)
  - [ ] `pip install -r backend/requirements.txt` → success
  - [ ] `cd mini-app && npm install` → success
  - [ ] `cd admin-panel && npm install` → success

  **QA Scenarios**:
  ```
  Scenario: Project structure is correct
    Tool: Bash
    Preconditions: Fresh workspace
    Steps:
      1. ls backend/ — verify requirements.txt exists
      2. ls mini-app/ — verify package.json, vite.config.ts exist
      3. ls admin-panel/ — verify package.json, vite.config.ts exist
      4. cat backend/requirements.txt | findstr fastapi — verify fastapi listed
      5. cat backend/requirements.txt | findstr aiogram — verify aiogram listed
    Expected Result: All directories and files present with correct dependencies
    Failure Indicators: Missing files, wrong dependency names
    Evidence: .sisyphus/evidence/task-1-scaffold.txt

  Scenario: Dependencies install cleanly
    Tool: Bash
    Preconditions: Project structure exists
    Steps:
      1. cd backend && pip install -r requirements.txt — should succeed without errors
      2. cd mini-app && npm install — should succeed without errors
      3. cd admin-panel && npm install — should succeed without errors
    Expected Result: All three installs complete with exit code 0
    Failure Indicators: Dependency conflicts, missing packages, exit code ≠ 0
    Evidence: .sisyphus/evidence/task-1-install.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(scaffold): project setup with monorepo structure`
  - Files: `backend/`, `mini-app/`, `admin-panel/`, `README.md`

- [ ] 2. **Environment config + settings**

  **What to do**:
  - Создать `backend/.env.example` и `backend/config.py` с настройками:
    - `BOT_TOKEN` — токен Telegram бота
    - `DATABASE_URL` — путь к SQLite (`sqlite+aiosqlite:///./app.db`)
    - `ADMIN_JWT_SECRET` — секрет для JWT токенов админов
    - `WEBHOOK_URL` — URL для webhook (по умолчанию localhost)
  - Использовать Pydantic Settings для валидации конфигурации
  - Создать `.env.example` в корне для переменных окружения фронтенда: `VITE_API_URL`, `VITE_BOT_USERNAME`

  **Must NOT do**:
  - Не коммитить `.env` файл (только `.env.example`)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3-7)
  - **Blocks**: Tasks 5-7, 13-15
  - **Blocked By**: None

  **References**:
  - `https://docs.pydantic.dev/latest/concepts/pydantic_settings/` — Pydantic Settings usage

  **Acceptance Criteria**:
  - [ ] `backend/config.py` загружает настройки из `.env`
  - [ ] `BOT_TOKEN` обязателен (ошибка при отсутствии)
  - [ ] `.env.example` содержит все переменные с комментариями
  - [ ] `.gitignore` содержит `.env`

  **QA Scenarios**:
  ```
  Scenario: Config loads correctly with valid .env
    Tool: Bash
    Preconditions: .env file with BOT_TOKEN=test_token, DATABASE_URL=sqlite+aiosqlite:///test.db, ADMIN_JWT_SECRET=secret123
    Steps:
      1. cd backend && python -c "from config import settings; print(settings.BOT_TOKEN)" — should print test_token
      2. python -c "from config import settings; print(settings.DATABASE_URL)" — should print sqlite+aiosqlite:///test.db
    Expected Result: All settings loaded without errors
    Evidence: .sisyphus/evidence/task-2-config.txt

  Scenario: Missing required token raises clear error
    Tool: Bash
    Preconditions: .env without BOT_TOKEN
    Steps:
      1. cd backend && python -c "from config import settings" 2>&1
    Expected Result: ValidationError with message about missing BOT_TOKEN
    Failure Indicators: Silent failure, generic error
    Evidence: .sisyphus/evidence/task-2-config-error.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(scaffold): environment configuration with pydantic settings`

- [ ] 3. **Database models (SQLAlchemy) + migrations**

  **What to do**:
  - Создать `backend/database.py` — async SQLAlchemy engine + session factory (aiosqlite)
  - Создать `backend/models.py` с моделями:
    - `Subject`: id, name (unique)
    - `Test`: id, subject_id (FK), datetime, max_capacity, format (enum: online/offline), duration_minutes, is_active (bool), created_at
    - `Registration`: id, test_id (FK), telegram_id, username, first_name, status (enum: registered/cancelled), registered_at, reminder_sent (bool, default False)
    - `Result`: id, registration_id (FK), score, max_score, comment, created_at
    - `Admin`: id, username (unique), password_hash, telegram_id (nullable), created_at
  - Добавить ограничения: Registration (test_id, telegram_id) unique вместе — нельзя записаться дважды
  - Создать `backend/migrations.py` — скрипт для создания таблиц (create_all)

  **Must NOT do**:
  - Не использовать Alembic (избыточно для SQLite MVP)
  - Не добавлять неиспользуемые поля «на будущее»

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Стандартное определение моделей, CRUD-схема
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-2, 4-7)
  - **Blocks**: Tasks 8-12
  - **Blocked By**: Task 1

  **References**:
  - `https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html` — Async SQLAlchemy setup

  **Acceptance Criteria**:
  - [ ] Все 5 моделей определены с корректными типами и связями
  - [ ] `python backend/migrations.py` создаёт `app.db` со всеми таблицами
  - [ ] Уникальный constraint на (test_id, telegram_id) в Registration

  **QA Scenarios**:
  ```
  Scenario: Database tables are created
    Tool: Bash
    Preconditions: SQLite file does not exist
    Steps:
      1. cd backend && python migrations.py — should complete without errors
      2. python -c "import sqlite3; conn=sqlite3.connect('app.db'); cursor=conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table'\"); print([r[0] for r in cursor.fetchall()])" — should list subjects, tests, registrations, results, admins
    Expected Result: All 5 tables exist in app.db
    Failure Indicators: Missing tables, constraint violations at creation
    Evidence: .sisyphus/evidence/task-3-db-tables.txt

  Scenario: Unique constraint prevents double registration
    Tool: Bash
    Preconditions: Tables created, subject and test exist
    Steps:
      1. Insert registration (test_id=1, telegram_id=123) → success
      2. Insert same (test_id=1, telegram_id=123) again → should fail with IntegrityError
    Expected Result: Second insert raises IntegrityError
    Evidence: .sisyphus/evidence/task-3-constraint.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(models): SQLAlchemy models for tests, registrations, results, admins`

- [ ] 4. **pytest + vitest infrastructure setup**

  **What to do**:
  - Backend: создать `backend/tests/__init__.py`, `backend/tests/conftest.py` с фикстурами (тестовая БД, клиент FastAPI, мок бота)
  - Backend: создать `backend/tests/test_health.py` — простой тест для проверки инфраструктуры
  - Mini App: настроить vitest, создать `mini-app/src/__tests__/App.test.tsx` — тест рендеринга
  - Admin Panel: настроить vitest, создать `admin-panel/src/__tests__/App.test.tsx` — тест рендеринга
  - Добавить скрипты: `backend/run_tests.sh` (или настройка pytest.ini), `mini-app/package.json` test script, `admin-panel/package.json` test script

  **Must NOT do**:
  - Не писать тесты на реальный функционал — только инфраструктурные

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Настройка тестовых фреймворков, boilerplate
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-3, 5-7)
  - **Blocks**: Tasks 8-12
  - **Blocked By**: Task 1

  **References**:
  - `https://docs.pytest.org/en/stable/` — pytest configuration
  - `https://vitest.dev/guide/` — vitest setup with Vite

  **Acceptance Criteria**:
  - [ ] `cd backend && pytest -v` → 1 test passes (test_health)
  - [ ] `cd mini-app && npm test` → 1 test passes
  - [ ] `cd admin-panel && npm test` → 1 test passes
  - [ ] `conftest.py` содержит фикстуры для async test client и test database

  **QA Scenarios**:
  ```
  Scenario: All three test suites run successfully
    Tool: Bash
    Preconditions: Project structure exists, dependencies installed
    Steps:
      1. cd backend && pytest -v — should show 1 passed (green)
      2. cd mini-app && npm test — should show 1 passed (green)
      3. cd admin-panel && npm test — should show 1 passed (green)
    Expected Result: All three commands exit 0, all tests green
    Failure Indicators: Any test failure, import errors, config issues
    Evidence: .sisyphus/evidence/task-4-tests.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(tests): pytest + vitest infrastructure with smoke tests`

- [ ] 5. **Shared API type definitions**

  **What to do**:
  - Создать `backend/schemas.py` с Pydantic моделями для всех API ответов и запросов:
    - `TestOut` (id, subject_name, datetime, max_capacity, format, duration, registered_count, has_capacity)
    - `TestCreate`, `TestUpdate` (для админов)
    - `RegistrationOut`, `RegistrationCreate`
    - `ResultOut`, `ResultCreate`, `ResultUpdate`
    - `AdminLogin`, `AdminToken`
    - `ApiResponse[T]` — обёртка для всех ответов
  - Создать `shared/types.ts` с TypeScript типами, зеркалирующими Pydantic схемы (для фронтенда)

  **Must NOT do**:
  - Не дублировать бизнес-логику в схемах — только валидация и типизация

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Определение типов/схем, без логики
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4, 6-7)
  - **Blocks**: Tasks 8-12, 13-15
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `https://docs.pydantic.dev/latest/concepts/models/` — Pydantic model definition

  **Acceptance Criteria**:
  - [ ] `backend/schemas.py` содержит все перечисленные Pydantic модели
  - [ ] `shared/types.ts` содержит все TypeScript интерфейсы
  - [ ] TypeScript типы соответствуют Pydantic моделям по структуре полей
  - [ ] Pydantic модели проходят базовую валидацию (python -c "from backend.schemas import TestOut")

  **QA Scenarios**:
  ```
  Scenario: Pydantic schemas import and validate correctly
    Tool: Bash
    Preconditions: backend/ exists, dependencies installed
    Steps:
      1. cd backend && python -c "from schemas import TestOut, TestCreate, RegistrationOut, AdminLogin; print('All imports OK')"
    Expected Result: All imports succeed, no errors
    Failure Indicators: ImportError, Pydantic validation errors at import time
    Evidence: .sisyphus/evidence/task-5-schemas.txt

  Scenario: TypeScript types match Pydantic schemas
    Tool: Bash (structural check)
    Preconditions: Both files exist
    Steps:
      1. grep "subject_name" shared/types.ts — should find matching field
      2. grep "max_capacity" shared/types.ts — should find matching field
      3. grep "has_capacity" shared/types.ts — should find matching computed field
    Expected Result: All key fields from Pydantic exist in TypeScript types
    Evidence: .sisyphus/evidence/task-5-types-match.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(types): shared API type definitions (Pydantic + TypeScript)`

- [ ] 6. **FastAPI app skeleton + health check**

  **What to do**:
  - Создать `backend/main.py` — инициализация FastAPI приложения
  - Добавить lifespan: создание таблиц БД при старте
  - Добавить CORS middleware (разрешить все origins для локальной разработки)
  - Создать `backend/api/__init__.py` и `backend/api/router.py` — главный роутер
  - Эндпоинт `GET /health` — возвращает `{"status": "ok"}`
  - Написать тест: `backend/tests/test_health.py` — проверка что `/health` возвращает 200

  **Must NOT do**:
  - Не добавлять бизнес-эндпоинты — только скелет

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-5, 7)
  - **Blocks**: Tasks 8-12
  - **Blocked By**: Task 1

  **References**:
  - `https://fastapi.tiangolo.com/tutorial/first-steps/` — FastAPI quickstart

  **Acceptance Criteria**:
  - [ ] `uvicorn backend.main:app --reload` запускает сервер на порту 8000
  - [ ] `curl http://localhost:8000/health` → `{"status": "ok"}`
  - [ ] `cd backend && pytest -v` → 2 tests pass (health + smoke)

  **QA Scenarios**:
  ```
  Scenario: FastAPI server starts and responds
    Tool: Bash (background uvicorn, curl)
    Preconditions: backend/ exists, dependencies installed
    Steps:
      1. Start server: cd backend && uvicorn main:app --port 8000 & (wait 3s)
      2. curl -s http://localhost:8000/health — should return {"status":"ok"}
      3. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health — should return 200
    Expected Result: Server responds with 200 and correct JSON
    Failure Indicators: Connection refused, 5xx error, wrong response body
    Evidence: .sisyphus/evidence/task-6-health.txt

  Scenario: Unknown route returns 404
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/nonexistent
    Expected Result: HTTP 404
    Evidence: .sisyphus/evidence/task-6-404.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(api): FastAPI skeleton with health check endpoint`

- [ ] 7. **aiogram bot skeleton + webhook integration**

  **What to do**:
  - Создать `backend/bot/__init__.py`, `backend/bot/bot.py` — инициализация aiogram Bot + Dispatcher
  - Создать `backend/bot/handlers/__init__.py`, `backend/bot/handlers/start.py` — обработчик `/start`:
    - Отправляет приветственное сообщение с WebApp кнопкой «Открыть приложение»
  - Интегрировать бота с FastAPI через webhook:
    - Эндпоинт `POST /bot/webhook` — принимает обновления от Telegram
    - Эндпоинт `GET /bot/webhook-info` — возвращает статус webhook
  - Добавить команду `/start` с меню: кнопка WebApp + «Мои записи» + «Помощь»
  - Написать тест: `backend/tests/test_bot.py` — мок обработчика `/start`

  **Must NOT do**:
  - Не запускать бота через polling (только webhook)
  - Не добавлять бизнес-логику регистрации в обработчики

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Стандартная инициализация aiogram, webhook boilerplate
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-6)
  - **Blocks**: Tasks 8-12, 23, 25
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `https://docs.aiogram.dev/en/latest/dispatcher/webhook.html` — aiogram webhook setup
  - `https://core.telegram.org/bots/webapps` — WebApp button in inline keyboard

  **Acceptance Criteria**:
  - [ ] `POST /bot/webhook` принимает Telegram Update и отвечает 200
  - [ ] Команда `/start` отправляет ответ с WebApp кнопкой
  - [ ] `GET /bot/webhook-info` возвращает статус webhook
  - [ ] `cd backend && pytest -v` → 3 tests pass

  **QA Scenarios**:
  ```
  Scenario: Webhook endpoint accepts valid update
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -X POST http://localhost:8000/bot/webhook \
         -H "Content-Type: application/json" \
         -d '{"update_id":1,"message":{"message_id":1,"from":{"id":123,"is_bot":false,"first_name":"Test"},"chat":{"id":123,"type":"private"},"date":1234567890,"text":"/start"}}'
      2. Check response status code is 200
    Expected Result: HTTP 200, no errors in server logs
    Failure Indicators: 500 error, webhook not configured
    Evidence: .sisyphus/evidence/task-7-webhook.txt

  Scenario: Webhook info endpoint works
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -s http://localhost:8000/bot/webhook-info
    Expected Result: JSON with webhook URL and status info
    Evidence: .sisyphus/evidence/task-7-webhook-info.txt
  ```

  **Commit**: YES (Wave 1 group)
  - Message: `feat(bot): aiogram bot skeleton with webhook and /start command`

- [ ] 8. **Admin auth (login/password + JWT)**

  **What to do**:
  - Создать `backend/auth.py` — хеширование паролей (bcrypt) + создание/проверка JWT
  - Создать `backend/api/admin_auth.py`:
    - `POST /api/admin/login` — принимает username/password, возвращает JWT access_token
    - `GET /api/admin/me` — возвращает данные текущего админа (требует JWT)
  - Создать middleware `backend/api/deps.py` — `get_current_admin` зависимость для защищённых эндпоинтов
  - Создать скрипт `backend/create_admin.py` — добавляет первого админа в БД
  - Написать тесты: `backend/tests/test_auth.py` — логин (успешный + неверный пароль + несуществующий пользователь), protected endpoint

  **Must NOT do**:
  - Не добавлять refresh токены (избыточно для MVP)
  - Не хранить пароли в открытом виде

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Стандартная JWT аутентификация, известный паттерн
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9-15)
  - **Blocks**: Task 20
  - **Blocked By**: Tasks 3, 4, 5, 6

  **References**:
  - `https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/` — FastAPI JWT auth pattern
  - `https://pypi.org/project/bcrypt/` — bcrypt hashing

  **Acceptance Criteria**:
  - [ ] `POST /api/admin/login` с верными данными → 200 + JWT токен
  - [ ] `POST /api/admin/login` с неверным паролем → 401
  - [ ] `GET /api/admin/me` без токена → 401
  - [ ] `GET /api/admin/me` с валидным токеном → 200 + данные админа
  - [ ] `python backend/create_admin.py` создаёт админа в БД

  **QA Scenarios**:
  ```
  Scenario: Successful admin login
    Tool: Bash (curl)
    Preconditions: Admin created (python backend/create_admin.py), server running
    Steps:
      1. curl -s -X POST http://localhost:8000/api/admin/login \
         -H "Content-Type: application/json" \
         -d '{"username":"admin","password":"admin123"}'
      2. Verify response contains "access_token" field
      3. Verify response status is 200
    Expected Result: JSON with access_token, token_type: "bearer"
    Failure Indicators: 401, missing token field, 500 error
    Evidence: .sisyphus/evidence/task-8-login-success.txt

  Scenario: Invalid password returns 401
    Tool: Bash (curl)
    Preconditions: Admin exists
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/admin/login \
         -H "Content-Type: application/json" \
         -d '{"username":"admin","password":"wrongpassword"}'
    Expected Result: HTTP 401
    Evidence: .sisyphus/evidence/task-8-login-fail.txt

  Scenario: Protected endpoint requires auth
    Tool: Bash (curl)
    Preconditions: Admin exists, login successful
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/admin/me — no token → 401
      2. TOKEN=$(curl -s -X POST ... | jq -r .access_token)
      3. curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/admin/me → 200
    Expected Result: 401 without token, 200 with token
    Evidence: .sisyphus/evidence/task-8-protected.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(auth): admin JWT authentication with login endpoint`

- [ ] 9. **Telegram initData validation middleware**

  **What to do**:
  - Создать `backend/telegram_auth.py` — валидация Telegram initData:
    - Проверка хеша (HMAC-SHA256 с использованием bot token)
    - Проверка срока давности данных (auth_date не старше 24 часов)
  - Создать FastAPI зависимость `get_telegram_user` в `backend/api/deps.py`:
    - Извлекает initData из заголовка `X-Telegram-Init-Data`
    - Валидирует и возвращает `telegram_id`, `username`, `first_name`
  - Интегрировать зависимость в студенческие эндпоинты (регистрация, записи, результаты)
  - Написать тесты: валидный initData, просроченный, поддельный, отсутствующий заголовок

  **Must NOT do**:
  - Не доверять данным из initData без проверки хеша
  - Не использовать устаревший метод проверки (только HMAC-SHA256)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Криптографическая проверка по документированному алгоритму Telegram
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 10-15)
  - **Blocks**: Tasks 10-12, 16-19
  - **Blocked By**: Tasks 5, 6, 7

  **References**:
  - `https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app` — initData validation algorithm
  - `https://docs.aiogram.dev/en/latest/api/methods/check_authorization.html` — aiogram utility (if available in v3)

  **Acceptance Criteria**:
  - [ ] Валидный initData → извлечён telegram_id, username
  - [ ] Поддельный initData (неверный хеш) → 401 Unauthorized
  - [ ] Просроченный auth_date (>24ч) → 401 Unauthorized
  - [ ] Отсутствующий заголовок → 401 Unauthorized
  - [ ] `cd backend && pytest tests/test_telegram_auth.py` → все тесты проходят

  **QA Scenarios**:
  ```
  Scenario: Valid initData passes validation
    Tool: Bash (curl + Python script to generate valid initData)
    Preconditions: BOT_TOKEN set in .env, server running
    Steps:
      1. python backend/tests/generate_valid_initdata.py — generates valid initData string
      2. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/tests \
         -H "X-Telegram-Init-Data: $VALID_INITDATA"
    Expected Result: HTTP 200 (or appropriate response, NOT 401)
    Failure Indicators: 401 on valid initData
    Evidence: .sisyphus/evidence/task-9-valid.txt

  Scenario: Tampered initData returns 401
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/tests \
         -H "X-Telegram-Init-Data: user=%7B%22id%22%3A123%7D&hash=fakehash123"
    Expected Result: HTTP 401
    Evidence: .sisyphus/evidence/task-9-invalid.txt

  Scenario: Missing initData header returns 401
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/tests
    Expected Result: HTTP 401
    Evidence: .sisyphus/evidence/task-9-missing.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(auth): Telegram initData validation middleware`

- [ ] 10. **Test CRUD API endpoints**

  **What to do**:
  - Создать `backend/api/tests.py`:
    - `GET /api/tests` — список активных тестов (пагинация, фильтр по subject_id)
    - `GET /api/tests/{id}` — детали теста с количеством зарегистрированных
    - `POST /api/admin/tests` — создать тест (только для админов)
    - `PUT /api/admin/tests/{id}` — обновить тест (только для админов)
    - `DELETE /api/admin/tests/{id}` — удалить тест (только для админов)
  - Добавить `registered_count` как computed поле (count регистраций)
  - Добавить `has_capacity` (registered_count < max_capacity)
  - Написать тесты: создание, чтение, обновление, удаление, фильтрация, 401 без админ-токена

  **Must NOT do**:
  - Не разрешать студентам создавать/редактировать тесты

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Полноценный CRUD с пагинацией, фильтрацией, computed полями — требует аккуратной реализации
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-9, 11-15)
  - **Blocks**: Tasks 16, 17, 21
  - **Blocked By**: Tasks 3, 5, 6, 9

  **References**:
  - `backend/models.py` — модели Test, Registration
  - `backend/schemas.py` — TestOut, TestCreate, TestUpdate
  - `backend/api/deps.py` — get_current_admin, get_telegram_user

  **Acceptance Criteria**:
  - [ ] `GET /api/tests` возвращает список активных тестов с registered_count
  - [ ] `GET /api/tests?subject_id=1` фильтрует по предмету
  - [ ] `POST /api/admin/tests` с валидным JWT → 201 + созданный тест
  - [ ] `POST /api/admin/tests` без токена → 401
  - [ ] `PUT /api/admin/tests/{id}` обновляет поля теста
  - [ ] `DELETE /api/admin/tests/{id}` удаляет тест (soft-delete: is_active=false)

  **QA Scenarios**:
  ```
  Scenario: Admin creates and lists tests
    Tool: Bash (curl)
    Preconditions: Admin logged in, JWT token obtained
    Steps:
      1. curl -s -X POST http://localhost:8000/api/admin/tests \
         -H "Authorization: Bearer $ADMIN_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"subject_name":"Математика","datetime":"2026-06-15T14:00:00","max_capacity":20,"format":"offline","duration_minutes":90}'
         → 201, verify test in response has id, subject, etc.
      2. curl -s http://localhost:8000/api/tests → verify test appears in list
      3. curl -s http://localhost:8000/api/tests/1 → verify detail has registered_count: 0, has_capacity: true
    Expected Result: Test created, appears in list and detail, computed fields correct
    Failure Indicators: 401, 500, missing computed fields
    Evidence: .sisyphus/evidence/task-10-crud.txt

  Scenario: Student cannot create tests
    Tool: Bash (curl)
    Preconditions: Valid initData (student), no admin token
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/admin/tests \
         -H "Content-Type: application/json" \
         -d '{"subject_name":"Физика","datetime":"2026-06-20T10:00:00","max_capacity":15,"format":"online","duration_minutes":60}'
    Expected Result: HTTP 401 (no admin token)
    Evidence: .sisyphus/evidence/task-10-unauthorized.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(api): test CRUD endpoints with admin-only create/update/delete`

- [ ] 11. **Registration API (enroll + capacity check)**

  **What to do**:
  - Создать `backend/api/registrations.py`:
    - `POST /api/tests/{test_id}/register` — зарегистрировать студента (требует initData)
    - `GET /api/registrations/my` — список регистраций текущего студента (требует initData)
    - `POST /api/registrations/{id}/cancel` — отменить регистрацию (требует initData)
    - `GET /api/admin/registrations?test_id={id}` — все регистрации на тест (только админ)
  - Логика проверки:
    - Тест существует и активен
    - Есть свободные места (registered_count < max_capacity)
    - Студент ещё не зарегистрирован на этот тест
    - Возвращать понятные ошибки: "Тест заполнен", "Вы уже зарегистрированы"
  - Написать тесты: успешная регистрация, полный тест, двойная регистрация, отмена

  **Must NOT do**:
  - Не разрешать регистрацию на неактивные тесты
  - Не создавать race condition при проверке capacity (использовать пессимистичную блокировку или проверку constraint)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Бизнес-логика с capacity check, race condition handling, несколько состояний
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-10, 12-15)
  - **Blocks**: Tasks 16-19, 22
  - **Blocked By**: Tasks 3, 5, 6, 9

  **References**:
  - `backend/models.py` — Registration модель, constraint (test_id, telegram_id) unique
  - `backend/schemas.py` — RegistrationCreate, RegistrationOut
  - `backend/api/deps.py` — get_telegram_user

  **Acceptance Criteria**:
  - [ ] `POST /api/tests/{id}/register` с валидным initData → 201 + данные регистрации
  - [ ] Повторная регистрация на тот же тест → 409 Conflict
  - [ ] Регистрация на заполненный тест → 400 "Тест заполнен"
  - [ ] Регистрация на неактивный тест → 400
  - [ ] `GET /api/registrations/my` → список регистраций студента

  **QA Scenarios**:
  ```
  Scenario: Student registers for test successfully
    Tool: Bash (curl)
    Preconditions: Active test exists (id=1, capacity=20), student initData valid
    Steps:
      1. curl -s -X POST http://localhost:8000/api/tests/1/register \
         -H "X-Telegram-Init-Data: $VALID_INITDATA"
         → verify 201, response contains test_id, status "registered"
      2. curl -s http://localhost:8000/api/tests/1 → verify registered_count increased to 1
    Expected Result: Registration created, test count updated
    Failure Indicators: 500, wrong count, missing status field
    Evidence: .sisyphus/evidence/task-11-register.txt

  Scenario: Double registration returns conflict
    Tool: Bash (curl)
    Preconditions: Student already registered on test 1
    Steps:
      1. curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/tests/1/register \
         -H "X-Telegram-Init-Data: $VALID_INITDATA"
    Expected Result: HTTP 409
    Evidence: .sisyphus/evidence/task-11-conflict.txt

  Scenario: Registration on full test returns error
    Tool: Bash (curl)
    Preconditions: Test with max_capacity=1, 1 student already registered
    Steps:
      1. curl -s -X POST http://localhost:8000/api/tests/2/register \
         -H "X-Telegram-Init-Data: $OTHER_INITDATA"
    Expected Result: HTTP 400, message "Тест заполнен" or "No available slots"
    Evidence: .sisyphus/evidence/task-11-full.txt

  Scenario: Cancel registration works
    Tool: Bash (curl)
    Preconditions: Student registered on test 1
    Steps:
      1. curl -s -X POST http://localhost:8000/api/registrations/1/cancel \
         -H "X-Telegram-Init-Data: $VALID_INITDATA"
      2. curl -s http://localhost:8000/api/tests/1 → verify registered_count decreased
    Expected Result: Registration status changed to cancelled, capacity freed
    Evidence: .sisyphus/evidence/task-11-cancel.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(api): registration endpoints with capacity checks and conflict prevention`

- [ ] 12. **Results API (CRUD results)**

  **What to do**:
  - Создать `backend/api/results.py`:
    - `GET /api/results/my` — результаты текущего студента (требует initData)
    - `POST /api/admin/results` — добавить результат для регистрации (только админ)
    - `PUT /api/admin/results/{id}` — обновить результат (только админ)
  - Результат привязан к Registration (а значит к студенту и тесту)
  - Написать тесты: добавление результата, просмотр студентом своих результатов

  **Must NOT do**:
  - Не позволять студентам видеть чужие результаты

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Простой CRUD с авторизацией, без сложной логики
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-11, 13-15)
  - **Blocks**: Tasks 19, 22
  - **Blocked By**: Tasks 3, 5, 6, 9

  **References**:
  - `backend/models.py` — Result модель
  - `backend/schemas.py` — ResultOut, ResultCreate

  **Acceptance Criteria**:
  - [ ] `POST /api/admin/results` добавляет результат к регистрации
  - [ ] `GET /api/results/my` возвращает только результаты текущего студента
  - [ ] Студент не видит результаты других студентов

  **QA Scenarios**:
  ```
  Scenario: Admin adds result and student views it
    Tool: Bash (curl)
    Preconditions: Student registered on test 1, admin logged in
    Steps:
      1. curl -s -X POST http://localhost:8000/api/admin/results \
         -H "Authorization: Bearer $ADMIN_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"registration_id":1,"score":85,"max_score":100,"comment":"Хорошая работа"}'
         → verify 201
      2. curl -s http://localhost:8000/api/results/my \
         -H "X-Telegram-Init-Data: $VALID_INITDATA"
         → verify response contains result with score 85
    Expected Result: Result created and visible to correct student
    Failure Indicators: 401, result not appearing, wrong student
    Evidence: .sisyphus/evidence/task-12-results.txt

  Scenario: Student cannot see another student's results
    Tool: Bash (curl)
    Preconditions: Student A has results, Student B logged in
    Steps:
      1. curl -s http://localhost:8000/api/results/my \
         -H "X-Telegram-Init-Data: $STUDENT_B_INITDATA"
      2. Verify response does NOT contain Student A's results
    Expected Result: Empty or only Student B's results
    Evidence: .sisyphus/evidence/task-12-isolation.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(api): results CRUD with student-scoped queries`

- [ ] 13. **React Mini App scaffolding + Telegram SDK integration**

  **What to do**:
  - Настроить Telegram Web App SDK через `@twa-dev/sdk` в `mini-app/src/main.tsx`
  - Инициализировать SDK: `WebApp.ready()`, `WebApp.expand()`
  - Настроить цвета темы из `WebApp.themeParams` в CSS variables
  - Настроить React Router в `mini-app/src/App.tsx`:
    - `/` → Home (список тестов)
    - `/test/:id` → TestDetail
    - `/registrations` → MyRegistrations
    - `/results` → MyResults
  - Создать `mini-app/src/api/client.ts` — HTTP клиент с автоматическим добавлением initData в заголовки
  - Создать `mini-app/src/components/MainButton.tsx` — обёртка над `WebApp.MainButton`
  - Создать `mini-app/src/components/BackButton.tsx` — обёртка над `WebApp.BackButton`
  - Написать тест: `App.test.tsx` — проверка рендеринга с роутером

  **Must NOT do**:
  - Не использовать window.Telegram.WebApp напрямую — только через SDK

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Фронтенд настройка с интеграцией Telegram SDK, визуальные компоненты
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-12, 14-15)
  - **Blocks**: Tasks 16-19
  - **Blocked By**: Tasks 1, 5

  **References**:
  - `shared/types.ts` — TypeScript типы API
  - `https://www.npmjs.com/package/@twa-dev/sdk` — TWA SDK docs

  **Acceptance Criteria**:
  - [ ] `npm run dev` запускает Mini App
  - [ ] Приложение вызывает `WebApp.ready()` и `WebApp.expand()` при загрузке
  - [ ] Роутинг работает: `/`, `/test/1`, `/registrations`, `/results`
  - [ ] API клиент добавляет `X-Telegram-Init-Data` заголовок к запросам
  - [ ] Стили используют `var(--tg-theme-bg-color)` и другие theme variables

  **QA Scenarios**:
  ```
  Scenario: Mini App builds and serves correctly
    Tool: Bash
    Preconditions: mini-app/ set up, npm install done
    Steps:
      1. cd mini-app && npm run build — should complete without errors
      2. ls mini-app/dist/ — verify index.html and assets exist
    Expected Result: Build succeeds, dist/ contains bundle
    Failure Indicators: Build errors, missing dist output
    Evidence: .sisyphus/evidence/task-13-build.txt

  Scenario: API client sends initData header
    Tool: Bash (check source code)
    Preconditions: api/client.ts exists
    Steps:
      1. grep "X-Telegram-Init-Data" mini-app/src/api/client.ts — should find header setting
      2. grep "initData" mini-app/src/api/client.ts — should find initData extraction
    Expected Result: Client correctly configured with initData header
    Evidence: .sisyphus/evidence/task-13-client.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(mini-app): React scaffolding with Telegram SDK and routing`

- [ ] 14. **React Admin Panel scaffolding + routing**

  **What to do**:
  - Настроить React Router в `admin-panel/src/App.tsx`:
    - `/login` → Login page
    - `/` → Tests management (защищённый маршрут)
    - `/registrations` → Registrations view (защищённый маршрут)
  - Создать `admin-panel/src/api/client.ts` — HTTP клиент с JWT токеном (из localStorage)
  - Создать `admin-panel/src/contexts/AuthContext.tsx` — контекст аутентификации (токен, login, logout)
  - Создать `admin-panel/src/components/ProtectedRoute.tsx` — редирект на /login если нет токена
  - Написать тест: `App.test.tsx` — проверка роутинга

  **Must NOT do**:
  - Не хранить пароль в localStorage — только JWT токен

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Фронтенд админ-панели с роутингом и аутентификацией
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-13, 15)
  - **Blocks**: Tasks 20-22
  - **Blocked By**: Tasks 1, 5

  **References**:
  - `shared/types.ts` — TypeScript типы
  - `https://reactrouter.com/en/main/start/tutorial` — React Router setup

  **Acceptance Criteria**:
  - [ ] `npm run dev` запускает Admin Panel
  - [ ] `/login` показывает страницу входа
  - [ ] `/` (без токена) редиректит на `/login`
  - [ ] API клиент добавляет `Authorization: Bearer` заголовок
  - [ ] AuthContext сохраняет/удаляет токен в localStorage

  **QA Scenarios**:
  ```
  Scenario: Admin panel builds and routing works
    Tool: Bash
    Preconditions: admin-panel/ set up
    Steps:
      1. cd admin-panel && npm run build — should complete without errors
      2. ls admin-panel/dist/ — verify output exists
    Expected Result: Build succeeds
    Failure Indicators: Build errors
    Evidence: .sisyphus/evidence/task-14-build.txt

  Scenario: Protected route redirects to login
    Tool: Bash (code check)
    Preconditions: ProtectedRoute.tsx exists
    Steps:
      1. grep "Navigate" admin-panel/src/components/ProtectedRoute.tsx — should redirect to /login
      2. grep "localStorage" admin-panel/src/contexts/AuthContext.tsx — token storage
    Expected Result: Route protection implemented
    Evidence: .sisyphus/evidence/task-14-auth.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(admin): React admin panel scaffolding with auth and routing`

- [ ] 15. **Shared UI components + design system**

  **What to do**:
  - Создать общие компоненты (используются в обоих фронтендах):
    - `shared/components/Button.tsx` — кнопка с вариантами (primary, secondary, danger)
    - `shared/components/Card.tsx` — карточка для теста
    - `shared/components/Modal.tsx` — модальное окно
    - `shared/components/Loading.tsx` — спиннер загрузки
    - `shared/components/ErrorBanner.tsx` — баннер ошибки
    - `shared/components/EmptyState.tsx` — заглушка «нет данных»
  - Настроить CSS модули или Tailwind (на выбор)
  - Создать `shared/styles/variables.css` — CSS custom properties для цветов, отступов, шрифтов
  - Экспортировать компоненты для использования в Mini App и Admin Panel

  **Must NOT do**:
  - Не использовать готовую UI библиотеку (Material UI, Ant Design) — слишком тяжело для Telegram Mini App

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Дизайн-система, визуальные компоненты
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8-14)
  - **Blocks**: Tasks 16-22
  - **Blocked By**: Tasks 13, 14

  **References**:
  - `https://core.telegram.org/bots/webapps#themeparams` — Telegram theme colors reference
  - `https://m3.material.io/` — Material Design 3 (для inspiration, не для копирования)

  **Acceptance Criteria**:
  - [ ] Все 6 компонентов реализованы и экспортированы
  - [ ] Компоненты имеют варианты (primary/secondary для Button, разные состояния)
  - [ ] CSS variables корректно применяются
  - [ ] `npm run build` проходит без ошибок

  **QA Scenarios**:
  ```
  Scenario: All components render without errors
    Tool: Bash (build)
    Preconditions: shared/ components exist, imported in mini-app
    Steps:
      1. cd mini-app && npm run build — no errors from shared components
      2. cd admin-panel && npm run build — no errors from shared components
    Expected Result: Both builds succeed
    Failure Indicators: Import errors, missing exports, type errors
    Evidence: .sisyphus/evidence/task-15-build.txt

  Scenario: Button variants render correctly
    Tool: Bash (grep)
    Preconditions: Button.tsx exists
    Steps:
      1. grep "primary" shared/components/Button.tsx — should find variant styling
      2. grep "secondary" shared/components/Button.tsx — should find variant styling
      3. grep "danger" shared/components/Button.tsx — should find variant styling
    Expected Result: Three button variants defined
    Evidence: .sisyphus/evidence/task-15-variants.txt
  ```

  **Commit**: YES (Wave 2 group)
  - Message: `feat(ui): shared component library with design tokens`

- [ ] 16. **Mini App: Home screen (test list + filters)**

  **What to do**:
  - Создать `mini-app/src/pages/Home.tsx`:
    - Загружает список тестов через API клиент (`GET /api/tests`)
    - Отображает тесты в виде карточек (Card компонент): предмет, дата/время, формат, места (занято/всего)
    - Фильтр по предмету (выпадающий список или чипсы)
    - Индикатор загрузки (Loading компонент)
    - Обработка ошибок (ErrorBanner)
    - Пустое состояние «Нет доступных тестов» (EmptyState)
  - При клике на карточку → переход на `/test/:id`
  - Написать тест: `Home.test.tsx` — отображение списка, фильтрация, пустое состояние

  **Must NOT do**:
  - Не показывать неактивные тесты
  - Не показывать прошедшие тесты (datetime < now)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI экран с загрузкой данных, фильтрацией, состояниями
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 17-22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 10, 11, 13, 15

  **References**:
  - `mini-app/src/api/client.ts` — API клиент
  - `shared/types.ts` — TestOut тип
  - `shared/components/` — Card, Loading, ErrorBanner, EmptyState

  **Acceptance Criteria**:
  - [ ] Экран показывает список тестов из API
  - [ ] Фильтр по предмету работает (сортировка/фильтрация на клиенте)
  - [ ] Карточка теста показывает: предмет, дату/время, формат, места
  - [ ] При ошибке API показывается ErrorBanner
  - [ ] При пустом списке показывается EmptyState

  **QA Scenarios**:
  ```
  Scenario: Test list loads and displays correctly
    Tool: Playwright
    Preconditions: Backend running with 2+ tests in DB, Mini App served
    Steps:
      1. Navigate to Mini App URL
      2. Wait for loading spinner to disappear (selector: [data-testid="loading"])
      3. Verify at least 2 test cards visible (selector: [data-testid="test-card"])
      4. Verify first card shows subject name, date, format, capacity info
    Expected Result: Test cards rendered with correct data
    Failure Indicators: No cards, wrong data, perpetual loading
    Evidence: .sisyphus/evidence/task-16-list.png

  Scenario: Subject filter works
    Tool: Playwright
    Preconditions: Tests with different subjects exist
    Steps:
      1. Navigate to Home
      2. Click subject filter chip "Математика" (selector: [data-testid="subject-filter-Математика"])
      3. Verify only Математика tests visible
      4. Click "Все" to reset filter → all tests visible again
    Expected Result: Filter correctly shows/hides tests by subject
    Evidence: .sisyphus/evidence/task-16-filter.png

  Scenario: Empty state shown when no tests
    Tool: Bash (curl + Playwright)
    Preconditions: All tests deactivated/is_active=false
    Steps:
      1. curl -X PUT .../api/admin/tests/1 -d '{"is_active":false}' (deactivate all)
      2. Navigate to Home → verify EmptyState message visible (selector: [data-testid="empty-state"])
    Expected Result: "Нет доступных тестов" message displayed
    Evidence: .sisyphus/evidence/task-16-empty.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(mini-app): home screen with test list, filters, and states`

- [ ] 17. **Mini App: Test detail + registration screen**

  **What to do**:
  - Создать `mini-app/src/pages/TestDetail.tsx`:
    - Загружает детали теста (`GET /api/tests/:id`)
    - Показывает полную информацию: предмет, дата/время, формат, длительность, места
    - Кнопка «Зарегистрироваться» (MainButton или обычная кнопка):
      - Активна если есть места и тест не прошел
      - Неактивна/скрыта если тест заполнен или студент уже зарегистрирован
    - При нажатии → `POST /api/tests/:id/register`
    - Успех → показ подтверждения + переход на «Мои записи»
    - Ошибка → ErrorBanner с конкретной причиной
  - Обработка состояний: загрузка, уже зарегистрирован, тест заполнен, успех
  - Написать тест: `TestDetail.test.tsx`

  **Must NOT do**:
  - Не позволять регистрацию на прошедший тест
  - Не показывать кнопку регистрации если уже зарегистрирован

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16, 18-22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 10, 11, 13, 15

  **References**:
  - `mini-app/src/api/client.ts`
  - `shared/types.ts` — TestOut тип

  **Acceptance Criteria**:
  - [ ] Страница показывает все поля теста
  - [ ] Кнопка регистрации отправляет POST запрос
  - [ ] После успешной регистрации показывается подтверждение
  - [ ] Если тест заполнен — кнопка неактивна + сообщение
  - [ ] Если уже зарегистрирован — статус «Вы записаны»

  **QA Scenarios**:
  ```
  Scenario: View test details and register
    Tool: Playwright
    Preconditions: Test 1 exists with capacity, student not registered
    Steps:
      1. Navigate to /test/1
      2. Verify subject, date, format, duration, capacity displayed
      3. Click "Зарегистрироваться" button (selector: [data-testid="register-btn"])
      4. Verify success message appears (selector: [data-testid="success-message"])
      5. Verify redirect to /registrations or confirmation dialog
    Expected Result: Registration successful, confirmation shown
    Failure Indicators: Button not clickable, API error, no confirmation
    Evidence: .sisyphus/evidence/task-17-register.png

  Scenario: Already registered shows status
    Tool: Playwright
    Preconditions: Student already registered on test 1
    Steps:
      1. Navigate to /test/1
      2. Verify "Вы уже записаны" or registered status visible
      3. Verify register button hidden or disabled
    Expected Result: Status shown, no double-register possible
    Evidence: .sisyphus/evidence/task-17-already-registered.png

  Scenario: Full test shows capacity message
    Tool: Playwright
    Preconditions: Test at max capacity
    Steps:
      1. Navigate to /test/2 (full test)
      2. Verify "Нет мест" or "Тест заполнен" message visible
      3. Verify register button disabled
    Expected Result: Cannot register on full test
    Evidence: .sisyphus/evidence/task-17-full.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(mini-app): test detail page with registration flow`

- [ ] 18. **Mini App: My registrations screen**

  **What to do**:
  - Создать `mini-app/src/pages/MyRegistrations.tsx`:
    - Загружает список регистраций (`GET /api/registrations/my`)
    - Отображает карточки: предмет теста, дата/время, статус (зарегистрирован/отменён), результат (если есть)
    - Кнопка «Отменить» для активных регистраций (предстоящих тестов)
    - Фильтр: активные / все / отменённые
  - При отмене → подтверждение → `POST /api/registrations/:id/cancel` → обновление списка
  - Написать тест: `MyRegistrations.test.tsx`

  **Must NOT do**:
  - Не позволять отменить прошедшую регистрацию
  - Не показывать кнопку отмены для тестов с результатом

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-17, 19-22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 11, 13, 15

  **References**:
  - `mini-app/src/api/client.ts`
  - `shared/types.ts` — RegistrationOut тип

  **Acceptance Criteria**:
  - [ ] Список показывает регистрации текущего студента
  - [ ] Фильтр по статусу работает
  - [ ] Кнопка отмены отправляет POST /cancel
  - [ ] После отмены статус обновляется
  - [ ] Пустое состояние если нет регистраций

  **QA Scenarios**:
  ```
  Scenario: View my registrations with cancel option
    Tool: Playwright
    Preconditions: Student has 1+ active registration
    Steps:
      1. Navigate to /registrations
      2. Verify registration card visible with test info and status
      3. Click "Отменить" on active registration (selector: [data-testid="cancel-btn"])
      4. Verify confirmation dialog appears
      5. Confirm cancellation → verify status updates to "cancelled"
    Expected Result: Registration cancelled, list updated
    Failure Indicators: Cancel button missing, API error, list not updated
    Evidence: .sisyphus/evidence/task-18-cancel.png

  Scenario: Empty registrations shows message
    Tool: Playwright
    Preconditions: Student has 0 registrations
    Steps:
      1. Navigate to /registrations
      2. Verify "У вас пока нет записей" or empty state visible
    Expected Result: Empty state message shown
    Evidence: .sisyphus/evidence/task-18-empty.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(mini-app): my registrations screen with cancel functionality`

- [ ] 19. **Mini App: My results screen**

  **What to do**:
  - Создать `mini-app/src/pages/MyResults.tsx`:
    - Загружает результаты (`GET /api/results/my`)
    - Отображает карточки: предмет теста, дата, баллы (score / max_score), комментарий
    - Визуальный индикатор результата (цветовая шкала: красный/жёлтый/зелёный в зависимости от %)
    - Сортировка по дате (новые сверху)
  - Написать тест: `MyResults.test.tsx`

  **Must NOT do**:
  - Не показывать результаты других студентов

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-18, 20-22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 12, 13, 15

  **References**:
  - `mini-app/src/api/client.ts`
  - `shared/types.ts` — ResultOut тип

  **Acceptance Criteria**:
  - [ ] Список показывает результаты с баллами и комментариями
  - [ ] Цветовой индикатор работает (score/max_score в %)
  - [ ] Пустое состояние если нет результатов
  - [ ] Сортировка по дате

  **QA Scenarios**:
  ```
  Scenario: View my test results
    Tool: Playwright
    Preconditions: Student has 1+ results
    Steps:
      1. Navigate to /results
      2. Verify result card shows subject, date, score/max_score
      3. Verify color indicator matches score percentage (e.g., 85% → green)
      4. Verify comment visible if present
    Expected Result: Results displayed with scores and color coding
    Failure Indicators: Missing scores, wrong colors, wrong student's results
    Evidence: .sisyphus/evidence/task-19-results.png

  Scenario: Empty results shows message
    Tool: Playwright
    Preconditions: Student has 0 results
    Steps:
      1. Navigate to /results
      2. Verify "У вас пока нет результатов" or empty state visible
    Expected Result: Empty state message shown
    Evidence: .sisyphus/evidence/task-19-empty.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(mini-app): my results screen with score visualization`

- [ ] 20. **Admin Panel: Login page**

  **What to do**:
  - Создать `admin-panel/src/pages/Login.tsx`:
    - Форма: username, password, кнопка «Войти»
    - При сабмите → `POST /api/admin/login`
    - При успехе → сохранить токен в AuthContext → редирект на `/`
    - При ошибке → показать сообщение «Неверный логин или пароль»
  - Валидация на клиенте: оба поля обязательны
  - Написать тест: `Login.test.tsx` — успешный вход, ошибка, валидация

  **Must NOT do**:
  - Не показывать пароль в URL или консоли

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-19, 21-22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 8, 14, 15

  **References**:
  - `admin-panel/src/api/client.ts`
  - `admin-panel/src/contexts/AuthContext.tsx`

  **Acceptance Criteria**:
  - [ ] Форма отправляет POST /api/admin/login
  - [ ] При успешном входе — редирект на `/`
  - [ ] При ошибке — сообщение об ошибке
  - [ ] Поля валидируются (пустые не отправляются)

  **QA Scenarios**:
  ```
  Scenario: Admin logs in successfully
    Tool: Playwright
    Preconditions: Admin exists (admin/admin123), backend running
    Steps:
      1. Navigate to /login
      2. Fill username input (selector: [data-testid="username-input"]) with "admin"
      3. Fill password input (selector: [data-testid="password-input"]) with "admin123"
      4. Click "Войти" button (selector: [data-testid="login-btn"])
      5. Verify redirect to / (dashboard)
    Expected Result: Login successful, redirected to main page
    Failure Indicators: Error message, no redirect, stuck on login
    Evidence: .sisyphus/evidence/task-20-login-success.png

  Scenario: Invalid credentials show error
    Tool: Playwright
    Preconditions: Backend running
    Steps:
      1. Navigate to /login
      2. Fill username "wrong", password "wrong"
      3. Click "Войти"
      4. Verify error message visible (selector: [data-testid="login-error"])
    Expected Result: Error message "Неверный логин или пароль" displayed
    Evidence: .sisyphus/evidence/task-20-login-error.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(admin): login page with JWT auth integration`

- [ ] 21. **Admin Panel: Tests management (CRUD table + forms)**

  **What to do**:
  - Создать `admin-panel/src/pages/TestsManagement.tsx`:
    - Таблица со всеми тестами (активные + неактивные)
    - Колонки: ID, Предмет, Дата/Время, Формат, Места (занято/всего), Длительность, Статус, Действия
    - Кнопка «Добавить тест» → открывает модальное окно с формой
    - Форма создания/редактирования: subject_name, datetime, max_capacity, format (select), duration_minutes
    - Кнопки действий: Редактировать, Деактивировать/Активировать
  - Интеграция с API: `GET /api/tests`, `POST /api/admin/tests`, `PUT /api/admin/tests/:id`
  - Написать тест: `TestsManagement.test.tsx`

  **Must NOT do**:
  - Не удалять тесты физически (только deactivate: is_active=false)
  - Не позволять редактировать прошедшие тесты (или показывать предупреждение)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-20, 22)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 10, 14, 15

  **References**:
  - `admin-panel/src/api/client.ts`
  - `shared/types.ts` — TestOut, TestCreate, TestUpdate

  **Acceptance Criteria**:
  - [ ] Таблица показывает все тесты
  - [ ] Создание теста через модальную форму → POST запрос → обновление таблицы
  - [ ] Редактирование → PUT запрос → обновление строки
  - [ ] Деактивация → PUT is_active=false → тест скрывается из студенческого списка
  - [ ] Валидация формы: все поля обязательны, datetime в будущем

  **QA Scenarios**:
  ```
  Scenario: Admin creates new test
    Tool: Playwright
    Preconditions: Admin logged in, on Tests Management page
    Steps:
      1. Navigate to / (Tests Management)
      2. Click "Добавить тест" button (selector: [data-testid="add-test-btn"])
      3. Fill form: subject "Английский", date "2026-07-01T10:00", capacity "25", format "online", duration "60"
      4. Click "Сохранить" (selector: [data-testid="save-test-btn"])
      5. Verify new test appears in table with correct data
      6. Verify API: GET /api/tests includes new test
    Expected Result: Test created and appears in table
    Failure Indicators: Form not submitting, test not appearing, 401/500 error
    Evidence: .sisyphus/evidence/task-21-create.png

  Scenario: Admin edits existing test
    Tool: Playwright
    Preconditions: Test exists in table
    Steps:
      1. Click "Редактировать" on a test row
      2. Change capacity from 20 to 30
      3. Click "Сохранить"
      4. Verify table shows updated capacity
    Expected Result: Test updated in table and API
    Evidence: .sisyphus/evidence/task-21-edit.png

  Scenario: Admin deactivates test
    Tool: Playwright
    Preconditions: Active test exists
    Steps:
      1. Click "Деактивировать" on test row
      2. Verify status changes to "Неактивен"
      3. Verify test no longer appears in student list (curl GET /api/tests)
    Expected Result: Test deactivated, hidden from students
    Evidence: .sisyphus/evidence/task-21-deactivate.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(admin): tests management with CRUD table and modal forms`

- [ ] 22. **Admin Panel: Registrations view**

  **What to do**:
  - Создать `admin-panel/src/pages/RegistrationsView.tsx`:
    - Выбор теста (выпадающий список активных тестов)
    - При выборе → загрузка регистраций (`GET /api/admin/registrations?test_id={id}`)
    - Таблица: Telegram ID, Имя, Username, Дата регистрации, Статус, Результат (если есть)
    - Сводка: всего мест, занято, свободно
  - При клике на студента → возможность добавить/редактировать результат
  - Написать тест: `RegistrationsView.test.tsx`

  **Must NOT do**:
  - Не раскрывать личные данные сверх необходимого

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 16-21)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 11, 12, 14, 15

  **References**:
  - `admin-panel/src/api/client.ts`
  - `shared/types.ts` — RegistrationOut

  **Acceptance Criteria**:
  - [ ] Выбор теста загружает список регистраций
  - [ ] Таблица показывает студента, дату, статус
  - [ ] Сводка показывает места (занято/всего/свободно)
  - [ ] Можно добавить/редактировать результат студента

  **QA Scenarios**:
  ```
  Scenario: View registrations for a test
    Tool: Playwright
    Preconditions: Test 1 has 2+ registrations, admin logged in
    Steps:
      1. Navigate to /registrations
      2. Select test from dropdown (selector: [data-testid="test-select"])
      3. Verify registrations table loads with student data
      4. Verify summary shows correct counts (total, occupied, free)
    Expected Result: All registrations visible with correct summary
    Failure Indicators: Empty table, wrong counts, API error
    Evidence: .sisyphus/evidence/task-22-view.png

  Scenario: Add result for a student
    Tool: Playwright
    Preconditions: Registration exists, no result yet
    Steps:
      1. Click "Добавить результат" on a student row
      2. Fill score "92", max_score "100", comment "Отлично"
      3. Click "Сохранить"
      4. Verify result appears in table and student can see it
    Expected Result: Result added and visible
    Evidence: .sisyphus/evidence/task-22-add-result.png
  ```

  **Commit**: YES (Wave 3 group)
  - Message: `feat(admin): registrations view with result management`

- [ ] 23. **Admin bot commands (/add_test, /results, /list)**

  **What to do**:
  - Создать `backend/bot/handlers/admin.py` — админские команды через Telegram бота:
    - `/admin` — проверка прав (является ли пользователь админом по Telegram ID)
    - `/list` — список предстоящих тестов (краткий формат)
    - `/results <test_id>` — список студентов с результатами по тесту
    - `/stats` — общая статистика (всего тестов, регистраций, студентов)
  - Добавить список admin_telegram_ids в конфиг/БД
  - Команды доступны только админам (проверка по telegram_id)
  - Написать тест: `backend/tests/test_admin_bot.py`

  **Must NOT do**:
  - Не дублировать функционал админ-панели — bot commands это быстрый доступ

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Простые обработчики команд с проверкой прав
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 24-26)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 7, 10, 11

  **References**:
  - `backend/bot/bot.py` — Dispatcher
  - `backend/models.py` — Admin, Test

  **Acceptance Criteria**:
  - [ ] `/admin` проверяет Telegram ID и отвечает статусом
  - [ ] `/list` показывает активные тесты
  - [ ] `/stats` показывает агрегированную статистику
  - [ ] Обычный пользователь получает «Нет доступа» на админские команды

  **QA Scenarios**:
  ```
  Scenario: Admin uses bot commands
    Tool: Bash (curl webhook)
    Preconditions: Admin's telegram_id in allowed list, bot running
    Steps:
      1. curl -X POST http://localhost:8000/bot/webhook \
         -d '{"message":{"from":{"id":ADMIN_TG_ID},"text":"/list","chat":{"id":ADMIN_TG_ID}}}'
      2. Verify response or check logs — bot should respond with test list
    Expected Result: Bot responds with list of tests
    Failure Indicators: No response, "access denied" for admin
    Evidence: .sisyphus/evidence/task-23-admin-commands.txt

  Scenario: Non-admin gets access denied
    Tool: Bash (curl webhook)
    Preconditions: Regular user telegram_id
    Steps:
      1. curl -X POST ... -d '{"message":{"from":{"id":REGULAR_TG_ID},"text":"/admin"}}'
    Expected Result: Bot responds "У вас нет прав администратора"
    Evidence: .sisyphus/evidence/task-23-access-denied.txt
  ```

  **Commit**: YES (Wave 4 group)
  - Message: `feat(bot): admin commands for quick access to test list and stats`

- [ ] 24. **Payment stub placeholder**

  **What to do**:
  - Создать `backend/api/payment.py`:
    - `POST /api/payment/create` — заглушка: принимает test_id, возвращает `{"status": "stub", "payment_url": null, "message": "Оплата временно недоступна"}`
  - В Mini App: на экране регистрации после успешной записи показывать сообщение о заглушке оплаты
  - Не blockировать регистрацию — оплата опциональна
  - Написать тест: `backend/tests/test_payment.py`

  **Must NOT do**:
  - Не интегрировать реальный платёжный шлюз
  - Не блокировать регистрацию без оплаты

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Заглушка — минимальный код
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 23, 25-26)
  - **Blocks**: Task 26
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `POST /api/payment/create` возвращает 200 с заглушкой
  - [ ] Регистрация работает без вызова payment endpoint
  - [ ] Mini App показывает сообщение о заглушке оплаты

  **QA Scenarios**:
  ```
  Scenario: Payment stub endpoint works
    Tool: Bash (curl)
    Preconditions: Backend running
    Steps:
      1. curl -s -X POST http://localhost:8000/api/payment/create \
         -H "Content-Type: application/json" \
         -d '{"test_id":1}'
    Expected Result: {"status":"stub","payment_url":null,"message":"Оплата временно недоступна"}
    Failure Indicators: 500 error, endpoint not found
    Evidence: .sisyphus/evidence/task-24-stub.txt
  ```

  **Commit**: YES (Wave 4 group)
  - Message: `feat(payment): payment stub placeholder for future integration`

- [ ] 25. **Reminders system (APScheduler + bot messages)**

  **What to do**:
  - Установить `apscheduler` в backend
  - Создать `backend/scheduler.py`:
    - Задача, запускаемая каждые 15 минут
    - Находит тесты, которые начинаются через 1 час
    - Для каждого теста: получает список зарегистрированных студентов
    - Отправляет личное сообщение через бота: «Напоминание: тест по {предмет} начнётся через 1 час ({время})»
    - Отмечает, что напоминание отправлено (поле `reminder_sent` в Registration)
  - Интегрировать планировщик в lifespan FastAPI приложения
  - Написать тест: `backend/tests/test_scheduler.py`

  **Must NOT do**:
  - Не отправлять повторные напоминания для одного теста
  - Не спамить — одно напоминание на тест

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Планировщик с бизнес-логикой, интеграция с ботом, предотвращение дубликатов
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 23-24, 26)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 7, 11

  **References**:
  - `https://apscheduler.readthedocs.io/en/stable/` — APScheduler docs
  - `backend/bot/bot.py` — Bot instance
  - `backend/models.py` — Registration (reminder_sent field)

  **Acceptance Criteria**:
  - [ ] Планировщик запускается при старте FastAPI
  - [ ] Находит тесты за 1 час до начала
  - [ ] Отправляет сообщение каждому зарегистрированному студенту
  - [ ] Не отправляет повторно (reminder_sent = true)

  **QA Scenarios**:
  ```
  Scenario: Reminder fires for upcoming test
    Tool: Bash (manual trigger + curl)
    Preconditions: Student registered on test starting in 1 hour, reminder_sent=false
    Steps:
      1. Create test with datetime = now + 1 hour
      2. Register student on test
      3. Trigger scheduler manually or wait for cycle
      4. Check that reminder_sent field updated to true
      5. Check bot logs for sent message
    Expected Result: Reminder sent, flag updated
    Failure Indicators: No message, double-send, scheduler not running
    Evidence: .sisyphus/evidence/task-25-reminder.txt

  Scenario: Past test does not trigger reminder
    Tool: Bash
    Preconditions: Test with datetime in past, student registered
    Steps:
      1. Trigger scheduler
      2. Verify no messages sent for past test
    Expected Result: No reminders for past tests
    Evidence: .sisyphus/evidence/task-25-no-past-reminder.txt
  ```

  **Commit**: YES (Wave 4 group)
  - Message: `feat(scheduler): automated reminders for upcoming tests via APScheduler`

- [ ] 26. **End-to-end flow integration + polish**

  **What to do**:
  - Проверить полный пользовательский путь:
    - Админ создаёт тест → тест виден студентам
    - Студент регистрируется → запись в БД → видна в «Мои записи»
    - Админ добавляет результат → студент видит результат
    - Напоминание отправляется перед тестом
  - Добавить `backend/seed.py` — скрипт для заполнения тестовыми данными (2 предмета, 3 теста, 1 админ)
  - Отладка CORS для локальной разработки
  - Добавить `.gitignore` (node_modules, __pycache__, .env, *.db)
  - Финальный прогон всех тестов: `pytest` + `npm test` в обоих фронтендах

  **Must NOT do**:
  - Не добавлять новый функционал — только полировка и интеграция

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Интеграционное тестирование полного цикла, требует системного понимания
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Tasks 23-25)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 16-25

  **References**:
  - Все предыдущие файлы проекта

  **Acceptance Criteria**:
  - [ ] `python backend/seed.py` заполняет БД тестовыми данными
  - [ ] Полный пользовательский путь работает без ошибок
  - [ ] `pytest` → все тесты проходят (100%)
  - [ ] `npm test` в mini-app → все тесты проходят
  - [ ] `npm test` в admin-panel → все тесты проходят
  - [ ] `.gitignore` исключает все временные и секретные файлы

  **QA Scenarios**:
  ```
  Scenario: Complete user journey end-to-end
    Tool: Playwright + Bash (curl)
    Preconditions: Backend running, DB seeded
    Steps:
      1. (Admin) curl POST /api/admin/tests → create test → 201
      2. (Student) Playwright: open Mini App → verify test appears in list
      3. (Student) Click test → register → verify success
      4. (Student) Navigate to "Мои записи" → verify registration visible
      5. (Admin) curl POST /api/admin/results → add result
      6. (Student) Navigate to "Мои результаты" → verify result visible
      7. (Scheduler) Wait/trigger → verify reminder message
    Expected Result: Full flow works without errors at each step
    Failure Indicators: Any step failing
    Evidence: .sisyphus/evidence/task-26-e2e.png

  Scenario: All tests pass
    Tool: Bash
    Preconditions: All code complete
    Steps:
      1. cd backend && pytest -v → all green
      2. cd mini-app && npm test → all green
      3. cd admin-panel && npm test → all green
    Expected Result: 100% test pass rate
    Evidence: .sisyphus/evidence/task-26-tests.txt

  Scenario: Seed data populates correctly
    Tool: Bash
    Preconditions: Fresh DB
    Steps:
      1. python backend/seed.py
      2. curl -s http://localhost:8000/api/tests → verify 3+ tests
      3. curl -s -X POST .../api/admin/login -d '{"username":"admin","password":"admin123"}' → 200
    Expected Result: DB populated with test data, admin login works
    Evidence: .sisyphus/evidence/task-26-seed.txt
  ```

  **Commit**: YES (Wave 4 group)
  - Message: `feat(integration): end-to-end flow, seed data, and final polish`

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pytest` + `npm test` (both mini-app and admin-panel). Review all changed files for: `# type: ignore`, bare excepts, `print()` in prod code, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: register → see in my registrations → admin sees registration → reminder fires. Test edge cases: full capacity, double registration, expired test.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(scaffold): project setup with models, config, and test infra` — backend/, mini-app/, admin-panel/
- **Wave 2**: `feat(api): core backend APIs + frontend scaffolding` — backend/api/, mini-app/src/, admin-panel/src/
- **Wave 3**: `feat(ui): all screens for mini app and admin panel` — mini-app/src/, admin-panel/src/
- **Wave 4**: `feat(integration): reminders, bot commands, payment stub` — backend/bot/, backend/scheduler/
- **FINAL**: `chore(verify): final review and QA evidence`

---

## Success Criteria

### Verification Commands
```bash
# Backend tests
cd backend && pytest -v

# Mini App tests
cd mini-app && npm test

# Admin Panel tests
cd admin-panel && npm test

# Backend health check
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# API: list tests
curl http://localhost:8000/api/tests
# Expected: JSON array of tests

# Bot webhook info
curl http://localhost:8000/bot/webhook-info
# Expected: webhook status
```

### Final Checklist
- [ ] All "Must Have" present (6 items)
- [ ] All "Must NOT Have" absent (6 items)
- [ ] All pytest tests pass
- [ ] All vitest tests pass (mini-app + admin-panel)
- [ ] Mini App открывается в Telegram Web App
- [ ] Админ-панель работает в браузере
- [ ] Напоминания отправляются ботом
