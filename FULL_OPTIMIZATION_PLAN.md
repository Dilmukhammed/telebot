# FULL OPTIMIZATION PLAN — EduCenter

> Полный план оптимизации проекта. Все находки, приоритеты, файлы, реализация.

---

## PHASE 1: Quick Wins (баги + мелкие правки)

### 1.1 Баг: payment_router подключён дважды
- **Файл:** `backend/api/router.py` строка 40
- **Проблема:** `api_router.include_router(payment_router)` вызывается на строках 18 и 40
- **Решение:** Удалить строку 40

### 1.2 Баг: Duplicate PATCH /api/admin/subjects/{subject_id}
- **Файл:** `backend/api/tests.py` строка 244
- **Проблема:** Этот endpoint дублирует `admin.py:1072`. FastAPI берёт первый зарегистрированный
- **Решение:** Удалить endpoint из `tests.py`, оставить только в `admin.py`

### 1.3 Баг: TeacherOnboardingModal лишний getMe()
- **Файл:** `mini-app/src/components/TeacherOnboardingModal.tsx` строка 21
- **Проблема:** Делает `getMe()` хотя юзер уже есть в `UserContext`
- **Решение:** Заменить на `useUser()` из контекста

### 1.4 Добавить loading="lazy" на все аватарки
- **Файлы:** TeacherDashboard.tsx, TeacherStudents.tsx, TeacherStudentDetail.tsx, CourseDetail.tsx, AdminPeople.tsx, AdminUserProfile.tsx, AdminCourseDetail.tsx, LessonDetail.tsx, AdminLessonDetail.tsx
- **Решение:** Добавить `loading="lazy"` и `onError` fallback на каждый `<img src={photo_url}>`

---

## PHASE 2: Backend — Вынести дублированные утилиты

### 2.1 Создать `backend/utils/` модуль
- **Новый файл:** `backend/utils/__init__.py`
- **Новый файл:** `backend/utils/time.py` — `_get_tashkent_now()`, `_to_tashkent_iso()`, `_calculate_end_time()`
- **Новый файл:** `backend/utils/constants.py` — `DAY_NAMES_RU`, `DAY_NAMES_SHORT_RU`
- **Новый файл:** `backend/utils/attendance.py` — `_build_attendance_list()`
- **Новый файл:** `backend/utils/teachers.py` — batch teacher name resolution

### 2.2 Обновить все файлы для импорта из utils
- `backend/api/dashboard.py` — удалить `_to_tashkent_iso()`, `_calculate_end_time()`, `DAY_NAMES_RU`
- `backend/api/courses.py` — удалить `_get_tashkent_now()`, `_calculate_end_time()`, `DAY_NAMES_RU`
- `backend/api/admin.py` — удалить `_get_tashkent_now()`, `_calculate_end_time()`, `DAY_NAMES_RU`, `_build_attendance_list_admin()`
- `backend/api/teacher.py` — удалить `_get_tashkent_now()`, `_to_tashkent_iso()`, `DAY_NAMES_RU`, `_build_attendance_list()`
- `backend/scheduler.py` — удалить `_get_tashkent_now()`

---

## PHASE 3: Frontend — Вынести дублированные утилиты

### 3.1 Создать shared утилиты
- **Новый файл:** `mini-app/src/utils/lessonHelpers.ts` — `getTashkentDiffMs()`, `isLessThanAnHourAway()`, `isLessonOngoing()`, `getGreeting()`, `getTodayLessonsStatus()`
- **Новый файл:** `mini-app/src/components/LessonCountdown.tsx` — общий компонент
- **Новый файл:** `mini-app/src/components/MiniCalendar.tsx` — виджет календаря из дашбордов

### 3.2 Обновить страницы
- `mini-app/src/pages/Dashboard.tsx` — импортировать из общих модулей
- `mini-app/src/pages/TeacherDashboard.tsx` — импортировать из общих модулей
- `mini-app/src/pages/AdminDashboard.tsx` — импортировать MiniCalendar

---

## PHASE 4: Backend — Кэширование

### 4.1 In-memory TTL кэш для get_telegram_user()
- **Файл:** `backend/api/deps.py`
- **Решение:** `cachetools.TTLCache(maxsize=500, ttl=120)` для кэширования User объектов по telegram_id
- Инвалидация: при обновлении профиля (PUT /users/me/name, PUT /users/me/profile-theme)
- Добавить `cachetools` в requirements.txt

### 4.2 TTL кэш для редко меняющихся данных
- **Файл:** `backend/api/courses.py` — кэш list_courses (TTL 5 мин)
- **Файл:** `backend/api/tests.py` — кэш list_tests (TTL 5 мин)
- **Файл:** `backend/api/admin.py` — кэш admin stats (TTL 30 сек)
- Инвалидация при мутациях через helper функцию

### 4.3 Создать модуль кэша
- **Новый файл:** `backend/cache.py` — единый модуль с TTLCache инстансами и helper для инвалидации

---

## PHASE 5: Backend — Исправить N+1 запросы

### 5.1 HIGH: get_admin_subject_detail
- **Файл:** `backend/api/admin.py` строки 992-1007
- **Проблема:** 2 запроса на каждый lesson (LessonStatus + enrollment count)
- **Решение:** Один batch-запрос для всех LessonStatus по списку lesson_ids, один COUNT ... GROUP BY для enrollments

### 5.2 HIGH: get_teachers_for_schedule
- **Файл:** `backend/api/admin.py` строки 918-965
- **Проблема:** 1 запрос TeacherAvailability на каждого учителя
- **Решение:** Один batch-запрос WHERE teacher_id IN (...)

### 5.3 MEDIUM: get_teacher_student_detail
- **Файл:** `backend/api/teacher.py` строки 306-368
- **Проблема:** 3 запроса на каждый курс
- **Решение:** Один batch-запрос с GROUP BY

### 5.4 MEDIUM: Dashboard unread_count
- **Файл:** `backend/api/dashboard.py` строки 201-224
- **Проблема:** 2 запроса (все notification IDs + все reads) только для count
- **Решение:** Один COUNT запрос с LEFT JOIN на notification_reads

### 5.5 LOW: Scheduler N+1
- **Файл:** `backend/scheduler.py` строки 156, 289-303
- **Решение:** Batch-загрузка users для enrollments

### 5.6 LOW: create_admin_subject N+1
- **Файл:** `backend/api/admin.py` строки 888-898
- **Решение:** Batch SELECT WHERE id IN (...)

---

## PHASE 6: Frontend — React.memo и useMemo

### 6.1 React.memo для shared компонентов
- `mini-app/src/shared/components/Card.tsx`
- `mini-app/src/shared/components/Button.tsx`
- `mini-app/src/shared/components/Loading.tsx`
- `mini-app/src/components/SiteHeader.tsx`
- `mini-app/src/components/BottomNavBar.tsx`
- `mini-app/src/components/LessonCountdown.tsx` (после создания)
- `mini-app/src/components/MaterialCard.tsx`

### 6.2 useMemo для дорогих вычислений
- `TeacherDashboard.tsx:242` — `announcements.filter(...)` → useMemo
- `AdminDashboard.tsx:15` — `announcements.filter(...)` → useMemo
- `AdminPeople.tsx:28` — `filteredUsers` → useMemo
- `CourseDetail.tsx:68` — 3x `.filter()` → useMemo
- `CourseDetail.tsx:249` — O(n²) dedup → useMemo
- `Profile.tsx:269` — `availability.reduce()` → useMemo
- `MaterialCard.tsx:62` — `parseInlineMarkdown` → useMemo

### 6.3 useCallback для обработчиков
- `BottomNavBar.tsx` — навигационные обработчики
- `AdminPeople.tsx` — search handler
- `Calendar.tsx` — cell click handlers

### 6.4 Константы вне компонентов
- `Dashboard.tsx` — массивы месяцев/дней → module-level
- `TeacherDashboard.tsx` — то же самое
- `AdminDashboard.tsx` — то же самое
- `BottomNavBar.tsx` — tab arrays → module-level

---

## PHASE 7: Frontend — Единый Avatar компонент

### 7.1 Создать Avatar компонент
- **Новый файл:** `mini-app/src/components/Avatar.tsx`
- Props: `telegramId`, `photoUrl`, `name`, `size`, `className`
- Поведение: loading="lazy", onError → initials fallback, React.memo
- Кэш: localStorage Map<telegram_id, photo_url> (TTL 24 часа)

### 7.2 Заменить все inline аватарки
- Все 10+ файлов из Phase 1.4 → использовать `<Avatar>`

---

## PHASE 8: Frontend — UserContext → React Query

### 8.1 Миграция UserContext на React Query
- **Файл:** `mini-app/src/context/UserContext.tsx`
- **Проблема:** Использует raw useState+useEffect, нет кэширования
- **Решение:** Использовать `useQuery` с queryKey=['me'], staleTime: 5 мин
- Сохранить `refresh` через `queryClient.invalidateQueries(['me'])`

---

## PHASE 9: Backend — Connection Pool + Пагинация

### 9.1 Connection pool tuning
- **Файл:** `backend/database.py`
- Добавить: `pool_size=20, max_overflow=10, pool_recycle=300, pool_pre_ping=True`

### 9.2 Пагинация для list endpoints
- Добавить `skip`/`limit` параметры в:
  - `GET /api/admin/users`
  - `GET /api/admin/lessons`
  - `GET /api/admin/audit-log` (уже есть limit)
  - `GET /api/tests`
  - `GET /api/registrations/my`
  - `GET /api/results/my`

---

## PHASE 10: Cleanup — Убрать мёртвый код

### 10.1 Cache-Control middleware
- **Файл:** `backend/main.py` строки 41-68
- **Вариант A:** Убрать middleware (фронтенд игнорирует заголовки)
- **Вариант B:** Оставить для прямых API вызовов (curl, бот)
- **Решение:** Оставить, добавить комментарий что основной кэш — React Query

### 10.2 Удалить дубль endpoint из tests.py
- `backend/api/tests.py` строка 244 — удалить `PATCH /admin/subjects/{subject_id}`

---

## PHASE 11: Google Drive оптимизация

### 11.1 sync_subject_drive_folder только при изменении имени
- **Файл:** `backend/api/admin.py` — `_sync_subject_drive_folder_after_update`
- **Проблема:** Вызывается при любом обновлении предмета (description, duration)
- **Решение:** Проверить изменилось ли имя/teacher перед вызовом sync

---

## Сводная таблица по файлам

### Новые файлы:
| Файл | Phase |
|------|-------|
| `backend/utils/__init__.py` | 2 |
| `backend/utils/time.py` | 2 |
| `backend/utils/constants.py` | 2 |
| `backend/utils/attendance.py` | 2 |
| `backend/utils/teachers.py` | 2 |
| `backend/cache.py` | 4 |
| `mini-app/src/utils/lessonHelpers.ts` | 3 |
| `mini-app/src/components/LessonCountdown.tsx` | 3 |
| `mini-app/src/components/MiniCalendar.tsx` | 3 |
| `mini-app/src/components/Avatar.tsx` | 7 |

### Изменяемые файлы (backend):
| Файл | Changes |
|------|---------|
| `backend/api/router.py` | Remove duplicate payment_router |
| `backend/api/tests.py` | Remove duplicate PATCH endpoint |
| `backend/api/deps.py` | Add TTL cache for user lookup |
| `backend/api/dashboard.py` | Use shared utils, fix unread_count query |
| `backend/api/courses.py` | Use shared utils, add cache |
| `backend/api/admin.py` | Use shared utils, fix N+1 queries, add cache |
| `backend/api/teacher.py` | Use shared utils, fix N+1 queries |
| `backend/scheduler.py` | Use shared utils, fix N+1 |
| `backend/database.py` | Connection pool config |
| `backend/main.py` | Add comment about Cache-Control |
| `backend/requirements.txt` | Add cachetools |

### Изменяемые файлы (frontend):
| Файл | Changes |
|------|---------|
| `mini-app/src/components/TeacherOnboardingModal.tsx` | UseUser context |
| `mini-app/src/pages/Dashboard.tsx` | Shared utils, memo, constants |
| `mini-app/src/pages/TeacherDashboard.tsx` | Shared utils, memo, useMemo, constants |
| `mini-app/src/pages/AdminDashboard.tsx` | MiniCalendar, useMemo, constants |
| `mini-app/src/pages/CourseDetail.tsx` | useMemo |
| `mini-app/src/pages/AdminPeople.tsx` | useMemo |
| `mini-app/src/pages/Profile.tsx` | useMemo, Avatar component |
| `mini-app/src/pages/Calendar.tsx` | useCallback |
| `mini-app/src/pages/TeacherStudents.tsx` | Avatar component |
| `mini-app/src/pages/TeacherStudentDetail.tsx` | Avatar component |
| `mini-app/src/pages/LessonDetail.tsx` | Avatar component |
| `mini-app/src/pages/AdminUserProfile.tsx` | Avatar component |
| `mini-app/src/pages/AdminCourseDetail.tsx` | Avatar component |
| `mini-app/src/pages/AdminLessonDetail.tsx` | Avatar component |
| `mini-app/src/pages/AdminPeople.tsx` | Avatar component |
| `mini-app/src/pages/TeacherDashboard.tsx` | Avatar component |
| `mini-app/src/shared/components/Card.tsx` | React.memo |
| `mini-app/src/shared/components/Button.tsx` | React.memo |
| `mini-app/src/shared/components/Loading.tsx` | React.memo |
| `mini-app/src/components/SiteHeader.tsx` | React.memo |
| `mini-app/src/components/BottomNavBar.tsx` | React.memo, constants outside |
| `mini-app/src/components/MaterialCard.tsx` | React.memo, useMemo |
| `mini-app/src/context/UserContext.tsx` | Migrate to React Query |
| `mini-app/src/providers/QueryProvider.tsx` | Adjust staleTimes |
