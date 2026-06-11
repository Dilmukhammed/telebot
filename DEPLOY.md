# Деплой на Railway + Vercel

## 1. Backend → Railway

### Шаг 1: Создай GitHub репозиторий
1. Зайди на github.com → New repository
2. Назови `zuhrabot` (или как хочешь)
3. НЕ ставь галочки (README, .gitignore) — уже есть
4. Скопируй URL репозитория

### Шаг 2: Запуши код
```bash
cd "C:/Users/dimaa/OneDrive/Desktop/notion_integration/New folder (10)"
git remote add origin https://github.com/ТВОЙ_АККАУНТ/zuhrabot.git
git branch -M main
git push -u origin main
```

### Шаг 3: Деплой на Railway
1. Зайди на railway.app → войди через GitHub
2. New Project → Deploy from GitHub Repo → выбери `zuhrabot`
3. Railway автоматически найдёт Dockerfile в папке `backend/`
4. Settings → Root Directory → `backend`
5. Variables → добавь:
   - `BOT_TOKEN` = `<ТВОЙ_BOT_TOKEN_ИЗ_BOTFATHER>`
   - `DATABASE_URL` = `postgresql+asyncpg://<user>:<pass>@<host>:<port>/<db>`
   - `ADMIN_JWT_SECRET` = `<СЛУЧАЙНАЯ_СТРОКА_МИНИМУМ_32_СИМВОЛА>`
   - `ADMIN_PASSWORD` = `<ПАРОЛЬ_АДМИНА>`
6. Deploy! Railway даст URL типа `https://zuhrabot-production.up.railway.app`

## 2. Frontend (mini-app) → Vercel

### Шаг 1: Деплой
1. Зайди на vercel.com → войди через GitHub
2. New Project → выбери репозиторий
3. Root Directory → `mini-app`
4. Framework Preset → Vite
5. Environment Variables:
   - `VITE_API_URL` = `https://zuhrabot-production.up.railway.app` (URL Railway)
6. Deploy! Vercel даст URL типа `https://zuhrabot.vercel.app`

## 3. Обнови WEBAPP_URL

После деплоя mini-app:
1. Вернись в Railway → Variables
2. Добавь `WEBAPP_URL` = URL от Vercel (например `https://zuhrabot.vercel.app`)
3. Redeploy backend

## 4. Проверь

1. Открой URL Vercel в браузере
2. Открой бота в Telegram
3. Проверь что всё работает
