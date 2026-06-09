# 🚀 Полный план оптимизации EduCenter

## Обзор проблемы

Каждый переход между страницами вызывает:
1. Полную перезагрузку React-компонента (unmount → mount)
2. Новый API-запрос к бэкенду (даже если данные не изменились)
3. Показ лоадера на каждую страницу
4. N+1 запросы в бэкенде (множество мелких SQL-запросов в циклах)
5. Отсутствие кеширования на любом уровне

**Результат**: пользователь видит спиннер загрузки при каждом переходе, даже если данные уже были загружены секунду назад.

---

## Фаза 1: Frontend — Кеширование данных (Самый большой эффект)

### 1.1 Установить TanStack React Query

**Что**: Библиотека `@tanstack/react-query` — стандарт индустрии для кеширования API-данных в React.

**Где**: `mini-app/package.json`, `mini-app/src/main.tsx`

**Как**:

1. Установить зависимость:
```bash
cd mini-app && npm install @tanstack/react-query
```

2. Создать `mini-app/src/providers/QueryProvider.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,        // данные "свежие" 30 секунд
        gcTime: 5 * 60_000,       // кеш живёт 5 минут
        refetchOnWindowFocus: false, // не перезапрашивать при фокусе
        retry: 1,                  // одна попытка при ошибке
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

3. Обернуть приложение в `mini-app/src/main.tsx`:
```tsx
import { QueryProvider } from './providers/QueryProvider'

// ...
<ErrorBoundary>
  <BrowserRouter>
    <QueryProvider>
      <UserProvider>
        <App />
      </UserProvider>
    </QueryProvider>
  </BrowserRouter>
</ErrorBoundary>
```

**Эффект**: Все запросы автоматически кешируются. Повторный переход на страницу — мгновенный показ кешированных данных + фоновое обновление.

### 1.2 Создать React Query хуки для каждого API-эндпоинта

**Что**: Вместо ручных `useState` + `useEffect` + `fetch` — использовать `useQuery` и `useMutation`.

**Где**: Новая папка `mini-app/src/api/hooks/`

**Как**: Создать файлы хуков:

`mini-app/src/api/hooks/useDashboard.ts`:
```tsx
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../client'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    staleTime: 60_000, // дашборд — 1 минута
  })
}
```

`mini-app/src/api/hooks/useCourses.ts`:
```tsx
import { useQuery } from '@tanstack/react-query'
import { getCourses, getCourseDetail } from '../client'

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
    staleTime: 2 * 60_000, // курсы меняются редко
  })
}

export function useCourseDetail(id: number) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => getCourseDetail(id),
    enabled: !!id,
  })
}
```

`mini-app/src/api/hooks/useCalendar.ts`:
```tsx
import { useQuery } from '@tanstack/react-query'
import { getCalendar } from '../client'

export function useCalendar(weekOffset: number) {
  return useQuery({
    queryKey: ['calendar', weekOffset],
    queryFn: () => getCalendar(weekOffset),
    staleTime: 60_000,
    placeholderData: (prev) => prev, // показывать предыдущую неделю пока грузится новая
  })
}
```

`mini-app/src/api/hooks/useAnnouncements.ts`:
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAnnouncements, getTeacherAnnouncements, markAnnouncementAsRead } from '../client'

export function useAnnouncements(role: string) {
  return useQuery({
    queryKey: ['announcements', role],
    queryFn: role === 'student' ? getAnnouncements : getTeacherAnnouncements,
    staleTime: 30_000,
  })
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markAnnouncementAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
```

Аналогично для: `useTests`, `useRegistrations`, `useResults`, `useTeacherDashboard`, `useTeacherStudents`, `useAdmin*`.

### 1.3 Переписать страницы на React Query

**Что**: Заменить `useState` + `useEffect` + ручной fetch на хуки из шага 1.2.

**Где**: Каждый файл в `mini-app/src/pages/`

**Как** — пример для `Courses.tsx`:

**Было**:
```tsx
const [courses, setCourses] = useState<CourseOut[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  getCourses()
    .then(setCourses)
    .catch(console.error)
    .finally(() => setLoading(false))
}, [])

if (loading) return <Loading fullPage />
```

**Стало**:
```tsx
import { useCourses } from '../api/hooks/useCourses'

const { data: courses = [], isLoading, error } = useCourses()

if (isLoading) return <Loading fullPage />
```

**Страницы для переписывания** (порядок по приоритету):
1. `Dashboard.tsx` → `useDashboard()`
2. `Calendar.tsx` → `useCalendar(weekOffset)`
3. `Courses.tsx` → `useCourses()`
4. `CourseDetail.tsx` → `useCourseDetail(id)`
5. `Announcements.tsx` → `useAnnouncements(role)`
6. `TeacherDashboard.tsx` → `useTeacherDashboard()` + `useAnnouncements('teacher')`
7. `Home.tsx` → `useTests()`
8. `TestDetail.tsx` → `useTest(id)` + `useMyRegistrations()`
9. `MyRegistrations.tsx` → `useMyRegistrations()` + `useMyResults()`
10. `MyResults.tsx` → `useMyResults()`
11. `Profile.tsx` — уже через `useUser()`, не требует изменений
12. `TeacherStudents.tsx` → `useTeacherStudents()`
13. `TeacherStudentDetail.tsx` → `useTeacherStudentDetail(id)`
14. `AdminDashboard.tsx` → `useAdminStats()` + `useAnnouncements('admin')`
15. `AdminCourses.tsx` → `useAdminSubjects()`
16. `AdminCourseDetail.tsx` → `useAdminSubjectDetail(id)`
17. `AdminPeople.tsx` → `useAdminUsers(role)`
18. `AdminUserProfile.tsx` → `useAdminUser(id)`
19. `AdminCalendar.tsx` → `useAdminLessons(filters)`
20. `AdminAnnouncements.tsx` → `useAdminAnnouncements()`
21. `AdminAnnouncementDetail.tsx` → `useAdminAnnouncementDetail(id)`
22. `LessonDetail.tsx` → `useLessonDetail(id, date)`
23. `AnnouncementDetail.tsx` → `useAnnouncementDetail(id)`
24. `CreateAnnouncement.tsx` → `useTeacherCourses()` + mutations

### 1.4 Исправить OnboardingModal — убрать дублирование getMe()

**Что**: `OnboardingModal.tsx` вызывает `getMe()` напрямую, хотя данные уже есть в `UserContext`.

**Где**: `mini-app/src/components/OnboardingModal.tsx`

**Как**: Заменить `getMe()` на `useUser().refresh()`.

---

## Фаза 2: Frontend — Code Splitting (Lazy Loading)

### 2.1 Добавить React.lazy для всех страниц

**Что**: Каждая страница загружается только когда пользователь переходит на неё.

**Где**: `mini-app/src/App.tsx`

**Как**:

**Было**:
```tsx
import Landing from './pages/Landing'
import DashboardRouter from './pages/DashboardRouter'
import Calendar from './pages/Calendar'
// ... 25+ импортов
```

**Стало**:
```tsx
import { lazy, Suspense } from 'react'
import { Loading } from './shared/components'

const Landing = lazy(() => import('./pages/Landing'))
const DashboardRouter = lazy(() => import('./pages/DashboardRouter'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Courses = lazy(() => import('./pages/Courses'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const LessonDetail = lazy(() => import('./pages/LessonDetail'))
const Announcements = lazy(() => import('./pages/Announcements'))
const AnnouncementDetail = lazy(() => import('./pages/AnnouncementDetail'))
const CreateAnnouncement = lazy(() => import('./pages/CreateAnnouncement'))
const Profile = lazy(() => import('./pages/Profile'))
const TeacherStudents = lazy(() => import('./pages/TeacherStudents'))
const TeacherStudentDetail = lazy(() => import('./pages/TeacherStudentDetail'))
const Home = lazy(() => import('./pages/Home'))
const TestDetail = lazy(() => import('./pages/TestDetail'))
const MyRegistrations = lazy(() => import('./pages/MyRegistrations'))
const MyResults = lazy(() => import('./pages/MyResults'))
const AdminPeople = lazy(() => import('./pages/AdminPeople'))
const AdminUserProfile = lazy(() => import('./pages/AdminUserProfile'))
const AdminCourses = lazy(() => import('./pages/AdminCourses'))
const AdminCourseDetail = lazy(() => import('./pages/AdminCourseDetail'))
const AdminLessonDetail = lazy(() => import('./pages/AdminLessonDetail'))
const AdminAnnouncements = lazy(() => import('./pages/AdminAnnouncements'))
const AdminAnnouncementDetail = lazy(() => import('./pages/AdminAnnouncementDetail'))
const AdminCalendar = lazy(() => import('./pages/AdminCalendar'))
const AdminMore = lazy(() => import('./pages/AdminMore'))
const NotFound = lazy(() => import('./pages/NotFound'))
```

Обернуть Routes в Suspense:
```tsx
<Suspense fallback={<Loading fullPage />}>
  <Routes>
    {/* ... все маршруты ... */}
  </Routes>
</Suspense>
```

**Эффект**: Начальный бандл уменьшится с ~500KB до ~100-150KB. Страницы загружаются по demand.

### 2.2 Оптимизировать vite.config.ts — ручные чанки

**Что**: Разделить vendor-библиотеки на отдельные чанки для лучшего кеширования.

**Где**: `mini-app/vite.config.ts`

**Как**:
```ts
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          'vendor-twa': ['@twa-dev/sdk'],
        },
      },
    },
  },
  // ...
})
```

**Эффект**: Vendor-чанки кешируются браузером отдельно. Обновление кода приложения не инвалидирует кеш React.

---

## Фаза 3: Backend — Исправление N+1 запросов

### 3.1 `list_courses` — батчевая загрузка уроков

**Где**: `backend/api/courses.py:69-86`

**Проблема**: Для каждого предмета — отдельный запрос уроков в цикле.

**Было**:
```python
for subject in subjects:
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.subject_id == subject.id, Lesson.is_active == True)
    )
    lessons = lessons_result.scalars().all()
```

**Стало**:
```python
# Один запрос для всех уроков всех предметов
subject_ids = [s.id for s in subjects]
all_lessons_result = await db.execute(
    select(Lesson)
    .where(Lesson.subject_id.in_(subject_ids), Lesson.is_active == True)
    .order_by(Lesson.subject_id, Lesson.day_of_week, Lesson.time)
)
all_lessons = all_lessons_result.scalars().all()

# Группируем по subject_id
lessons_by_subject: dict[int, list] = {}
for lesson in all_lessons:
    lessons_by_subject.setdefault(lesson.subject_id, []).append(lesson)

# Собираем ответ
courses = []
for subject in subjects:
    lessons = lessons_by_subject.get(subject.id, [])
    first_lesson = lessons[0] if lessons else None
    courses.append(CourseOut(
        id=subject.id,
        name=subject.name,
        teacher_name=first_lesson.teacher_name if first_lesson else "",
        lesson_count=len(lessons),
    ))
```

### 3.2 `get_teacher_dashboard` — батчевый подсчёт записей

**Где**: `backend/api/teacher.py:112-119`

**Проблема**: Для каждого урока — отдельный COUNT-запрос.

**Было**:
```python
for lesson, subject in teacher_lessons:
    enrollments_count = await db.execute(
        select(func.count(LessonEnrollment.id))
        .where(LessonEnrollment.lesson_id == lesson.id)
    )
    student_count = enrollments_count.scalar() or 0
```

**Стало**:
```python
# Один запрос для всех уроков
lesson_ids = [l.id for l, _ in teacher_lessons]
counts_result = await db.execute(
    select(LessonEnrollment.lesson_id, func.count(LessonEnrollment.id))
    .where(LessonEnrollment.lesson_id.in_(lesson_ids))
    .group_by(LessonEnrollment.lesson_id)
)
enrollment_counts = dict(counts_result.all())

# Используем в цикле
for lesson, subject in teacher_lessons:
    student_count = enrollment_counts.get(lesson.id, 0)
```

### 3.3 `get_teacher_courses` — батчевый подсчёт студентов

**Где**: `backend/api/teacher.py:586-604`

**Проблема**: Для каждого предмета — отдельный COUNT-запрос.

**Решение**: Аналогично 3.2 — один GROUP BY запрос.

### 3.4 `get_admin_subjects` — батчевая загрузка уроков и подсчёт студентов

**Где**: `backend/api/admin.py:686-715`

**Проблема**: Для каждого предмета — 2 отдельных запроса (уроки + COUNT записей).

**Решение**: Один запрос уроков для всех предметов + один COUNT запрос.

### 3.5 `get_my_registrations` — убрать лишний запрос Subject

**Где**: `backend/api/registrations.py:120-145`

**Проблема**: Subject уже JOIN-ится в основном запросе, но потом для каждой регистрации делается отдельный SELECT Subject.name.

**Было**:
```python
result = await db.execute(
    select(Registration, Test)
    .join(Test, Registration.test_id == Test.id)
    .join(Subject, Test.subject_id == Subject.id)  # уже joined!
    .where(Registration.telegram_id == telegram_id)
)
for reg, test in rows:
    subject_result = await db.execute(  # лишний запрос!
        select(Subject.name).where(Subject.id == test.subject_id)
    )
```

**Стало**:
```python
result = await db.execute(
    select(Registration, Test, Subject.name)  # выбираем Subject.name сразу
    .join(Test, Registration.test_id == Test.id)
    .join(Subject, Test.subject_id == Subject.id)
    .where(Registration.telegram_id == telegram_id)
)
for reg, test, subject_name in rows:
    registrations.append(RegistrationOut(
        # ...
        test_subject=subject_name,
    ))
```

### 3.6 `admin_get_registrations` — аналогично 3.5

**Где**: `backend/api/registrations.py:226-248`

**Решение**: То же — выбирать Subject.name в основном запросе.

---

## Фаза 4: Backend — Индексы БД

### 4.1 Добавить недостающие индексы

**Где**: `backend/models.py`

**Как**: Добавить `index=True` к полям, по которым часто фильтруем:

```python
# Lesson.is_active — фильтруется в КАЖДОМ запросе уроков
is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

# Test.is_active — фильтруется в КАЖДОМ запросе тестов
is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

# Subject.is_archived — фильтруется в КАЖДОМ запросе предметов
is_archived: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
```

**Миграция**: Поскольку используется `create_all` при старте, SQLAlchemy создаст индексы автоматически для новых колонок. Для существующих таблиц — добавить миграцию в `main.py` lifespan:

```python
# В lifespan, после create_all:
if "postgresql" in str(engine.url):
    for idx_name, table, col in [
        ("ix_lessons_is_active", "lessons", "is_active"),
        ("ix_tests_is_active", "tests", "is_active"),
        ("ix_subjects_is_archived", "subjects", "is_archived"),
    ]:
        try:
            await conn.execute(text(
                f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ("{col}")'
            ))
        except Exception:
            pass
```

**Эффект**: Фильтрация по `is_active`/`is_archived` ускорится в 2-10 раз на больших таблицах.

---

## Фаза 5: Backend — HTTP-кеширование

### 5.1 Добавить Cache-Control заголовки

**Что**: Браузер кеширует GET-ответы, не делая повторный запрос к серверу.

**Где**: `backend/main.py` (middleware) или отдельные эндпоинты

**Как** — добавить middleware:
```python
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method == "GET" and response.status_code == 200:
            path = request.url.path

            # Редко меняющиеся данные — кешировать долго
            if path.startswith("/api/courses") or path.startswith("/api/tests"):
                response.headers["Cache-Control"] = "private, max-age=60"
            # Дашборд — короткий кеш
            elif path.startswith("/api/dashboard"):
                response.headers["Cache-Control"] = "private, max-age=15"
            # Админ-данные — не кешировать
            elif path.startswith("/api/admin"):
                response.headers["Cache-Control"] = "private, no-cache"
            # Остальное — умеренный кеш
            else:
                response.headers["Cache-Control"] = "private, max-age=30"

        return response
```

**Эффект**: Браузер не делает повторные запросы в течение max-age. Переход назад — мгновенный.

### 5.2 Добавить ETag для тяжёлых эндпоинтов

**Что**: Браузер отправляет `If-None-Match`, сервер отвечает `304 Not Modified` если данные не изменились.

**Где**: `GET /api/courses/:id`, `GET /api/admin/subjects/:id`

**Как**: Генерировать ETag из хеша ответа:
```python
import hashlib, json

def generate_etag(data) -> str:
    content = json.dumps(data, sort_keys=True, default=str)
    return hashlib.md5(content.encode()).hexdigest()
```

В эндпоинте:
```python
etag = generate_etag(response_data)
if request.headers.get("if-none-match") == etag:
    return Response(status_code=304)
# ...
response.headers["ETag"] = etag
```

---

## Фаза 6: Frontend — Предзагрузка и оптимизация UX

### 6.1 Prefetch при наведении на ссылку

**Что**: Когда пользователь наводит палец на карточку курса — начинаем загружать данные курса в фоне.

**Где**: `mini-app/src/pages/Courses.tsx`, `mini-app/src/pages/Dashboard.tsx`

**Как**:
```tsx
import { useQueryClient } from '@tanstack/react-query'
import { getCourseDetail } from '../api/client'

const queryClient = useQueryClient()

const handleCourseHover = (courseId: number) => {
  queryClient.prefetchQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseDetail(courseId),
    staleTime: 60_000,
  })
}
```

Для touch-устройств — prefetch при `onTouchStart`:
```tsx
<div
  onTouchStart={() => handleCourseHover(course.id)}
  onClick={() => navigate(`/course/${course.id}`)}
>
```

### 6.2 Placeholder-данные при переходе назад

**Что**: При возврате на страницу — мгновенно показать кешированные данные, обновить в фоне.

**Где**: Все хуки в `mini-app/src/api/hooks/`

**Как**: React Query делает это автоматически с `staleTime > 0`. Данные из кеша показываются мгновенно, а в фоне запускается рефетч. Лоадер показывается только при первом запросе (когда кеш пуст).

### 6.3 Skeleton-загрузчики вместо спиннеров

**Что**: Вместо полноэкранного спиннера — серые placeholder-блоки, похожие на контент.

**Где**: Новые компоненты в `mini-app/src/shared/components/`

**Как**: Создать `Skeleton.tsx`:
```tsx
export function Skeleton({ width, height, style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={styles.skeleton}
      style={{ width, height, ...style }}
    />
  )
}
```

С CSS-анимацией:
```css
.skeleton {
  background: linear-gradient(90deg, var(--color-surface-variant) 25%, var(--color-surface) 50%, var(--color-surface-variant) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}
```

---

## Фаза 7: Backend — Оптимизация тяжёлых эндпоинтов

### 7.1 `get_course_detail` — ограничить генерацию инстансов

**Где**: `backend/api/courses.py:260-328`

**Проблема**: Генерирует ВСЕ инстансы уроков от начала курса до +4 недель. Для курса на 3 урока/week × 16 недель = 48 объектов.

**Решение**: Добавить пагинацию по неделям:
```python
@router.get("/{course_id}", response_model=CourseDetailOut)
async def get_course_detail(
    course_id: int,
    week_offset: int = Query(0),  # новое поле
    db: AsyncSession = Depends(get_db),
):
    # Генерировать только запрошенную неделю (+/- 1 для контекста)
```

### 7.2 Добавить пагинацию к list-эндпоинтам

**Где**: `GET /api/admin/users`, `GET /api/tests`, `GET /api/teacher/students`

**Как**:
```python
@router.get("/users", response_model=list[UserOut])
async def get_admin_users(
    role: str = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    # ...
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    query = query.offset((page - 1) * limit).limit(limit)
```

---

## Фаза 8: Telegram Bot — Предзагрузка данных

### 8.1 Отправлять данные при /start

**Что**: При первом открытии бота — отправить расписание на неделю прямо в сообщение. Пользователь видит данные до открытия Mini App.

**Где**: `backend/bot/handlers/start.py`

**Как**: При `/start` — если пользователь авторизован и записан на курсы:
```python
@router.message(CommandStart())
async def cmd_start(message: Message, db: AsyncSession = Depends(get_db)):
    user = await get_or_create_user(message, db)

    if user.onboarded:
        # Показать ближайшие уроки
        lessons = await get_upcoming_lessons(db, user.id, limit=3)
        text = format_lessons_summary(lessons)
        await message.answer(
            text,
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📱 Открыть приложение", web_app=WebAppInfo(url=WEBAPP_URL))]
            ])
        )
    else:
        # Обычный приветственный экран
        await message.answer("Добро пожаловать!", ...)
```

### 8.2 Кешировать данные пользователя в Redis (будущее)

**Что**: Для масштабирования — кешировать профиль и расписание в Redis с TTL 5 минут.

**Где**: Новый файл `backend/cache.py`

**Как**: Пока не критично, но при росте пользователей — добавить:
```python
import redis.asyncio as redis

redis_client = redis.from_url(os.environ.get("REDIS_URL", "redis://localhost:6379"))

async def get_cached_user(telegram_id: int):
    cached = await redis_client.get(f"user:{telegram_id}")
    if cached:
        return json.loads(cached)
    return None

async def cache_user(telegram_id: int, data: dict, ttl: int = 300):
    await redis_client.setex(f"user:{telegram_id}", ttl, json.dumps(data))
```

---

## Фаза 9: Безопасность (попутно)

### 9.1 Убрать .env из git

**Где**: `backend/.env` содержит реальный BOT_TOKEN

**Как**:
```bash
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
```

### 9.2 Убрать fallback на X-Telegram-User header

**Где**: `backend/api/deps.py`

**Проблема**: Если HMAC не проходит, сервер доверяет клиентскому заголовку `X-Telegram-User` без проверки. Злоумышленник может подставить любой telegram_id.

**Решение**: В production — убрать fallback, оставить только HMAC-валидацию.

---

## Порядок реализации (по приоритету)

| # | Задача | Эффект | Сложность |
|---|--------|--------|-----------|
| 1 | React Query (1.1-1.3) | ⭐⭐⭐⭐⭐ | Средняя |
| 2 | Lazy Loading (2.1) | ⭐⭐⭐⭐ | Лёгкая |
| 3 | N+1 запросы (3.1-3.6) | ⭐⭐⭐⭐ | Средняя |
| 4 | Индексы БД (4.1) | ⭐⭐⭐ | Лёгкая |
| 5 | HTTP-кеширование (5.1) | ⭐⭐⭐ | Лёгкая |
| 6 | Prefetch (6.1) | ⭐⭐⭐ | Лёгкая |
| 7 | Vite chunks (2.2) | ⭐⭐ | Лёгкая |
| 8 | Skeleton-ы (6.3) | ⭐⭐ | Средняя |
| 9 | Пагинация (7.2) | ⭐⭐ | Средняя |
| 10 | Telegram предзагрузка (8.1) | ⭐⭐ | Средняя |
| 11 | Безопасность (9.1-9.2) | 🔒 | Лёгкая |

---

## Ожидаемый результат

| Метрика | До | После |
|---------|-----|-------|
| Первый вход (FCP) | 3-5 сек | 0.5-1 сек |
| Переход между страницами | 1-3 сек (с лоадером) | <100ms (из кеша) |
| API ответы (среднее) | 200-500ms | 50-100ms |
| Размер начального бандла | ~500KB | ~100-150KB |
| Количество запросов при навигации | 2-5 на страницу | 0-1 (из кеша) |
