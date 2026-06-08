# Draft: Educational Center CRM

## Requirements (confirmed)
- **Scope**: Full educational center CRM — группы, репетиторство, онлайн, мок-тесты
- **Roles**: Администратор, Преподаватели, Студенты
- **Payments**: Полноценная интеграция (ЮKassa/Stripe)
- **Scale**: Небольшой центр (1-3 админа, 5-10 преподавателей, 50-200 студентов) → SQLite + монолит
- **Interfaces**: Только Telegram (бот + Mini App)
- **MVP**: Личные кабинеты студентов/преподавателей + аналитика для админа
- **Homework**: Пропускаем в MVP
- **Notifications**: Только Telegram
- **Class structure**: Группы + индивидуальное репетиторство
- **Database**: SQLite (оставляем)
- **Analytics**: Базовая — посещаемость, средний балл, активность, выручка по месяцам
- **Timeline**: 1-2 недели MVP

## Scope Boundaries
- INCLUDE: Student cabinet (schedule, grades, payments, enrollments), Teacher cabinet (schedule, attendance, grades), Admin dashboard (analytics, CRUD management), Group classes, Individual tutoring booking, Payment integration (ЮKassa)
- EXCLUDE: Homework management, Email notifications, Mobile app (native), Video conferencing integration, Marketing/funnel analytics, Parent accounts

## Technical Decisions
- **Stack**: Python (FastAPI + aiogram 3.x), React (Vite) for Mini App + Admin Panel, SQLite
- **Infrastructure**: Monolith, single VPS
- **Tests**: pytest (Python) + vitest (React), TDD
- **Auth**: Telegram initData (students), JWT (admin/teachers), DEV_MODE bypass for dev
- **Payments**: ЮKassa API integration

## Existing Code to Extend
- Backend models: Test, Registration, Result, Subject → extend with Course, Group, Enrollment, Lesson, Attendance, Grade, Payment, TeacherSchedule
- Mini App: 4 routes → add Schedule, Grades, Payments, TeacherCabinet
- Admin Panel: 3 routes → add Dashboard, Students CRUD, Teachers CRUD, Groups CRUD, Schedule, Payments
- Bot: /start handler → keep, add teacher notifications

## Key Decisions Needed
- [OPEN] ЮKassa — у клиента уже есть аккаунт ЮKassa или подключать новый?
- [OPEN] Предметы/курсы — какой список у клиента? (используем Математика/Английский из seed)
- [OPEN] Расписание — фиксированное (пн/ср/пт 18:00) или плавающее?
