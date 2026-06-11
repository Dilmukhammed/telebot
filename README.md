# Telegram Mock Test Registration Bot

Telegram бот + Mini App для регистрации на мок-тесты в учебном центре

## Stack

Python (FastAPI + aiogram) backend, React (Vite) frontend, SQLite/PostgreSQL

## How to run

### Backend

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```

### Mini App (включая админку)

```bash
cd mini-app && npm install && npm run dev
```

Админ-панель встроена в mini-app и доступна по маршруту `/admin/*` для пользователей с ролью `admin`.

## Tests

```bash
cd backend && pytest -v
cd mini-app && npm test
```