# Telegram Mock Test Registration Bot

Telegram бот + Mini App для регистрации на мок-тесты в учебном центре

## Stack

Python (FastAPI + aiogram) backend, React (Vite) frontend, SQLite

## How to run

### Backend

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```

### Mini App

```bash
cd mini-app && npm install && npm run dev
```

### Admin Panel

```bash
cd admin-panel && npm install && npm run dev
```

## Tests

```bash
cd backend && pytest -v
cd mini-app && npm test
cd admin-panel && npm test
```