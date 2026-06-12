"""Lightweight schema migrations for existing databases.

SQLAlchemy create_all() does not add columns to existing tables.
These run on every startup and are idempotent.
"""

import logging
import secrets
import string

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger(__name__)


async def _column_exists(conn: AsyncConnection, table: str, column: str, dialect: str) -> bool:
    if dialect == "postgresql":
        result = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_schema = 'public' AND table_name = :table AND column_name = :column"
            ),
            {"table": table, "column": column},
        )
        return result.scalar_one_or_none() is not None

    if dialect == "sqlite":
        result = await conn.execute(text(f"PRAGMA table_info({table})"))
        return any(row[1] == column for row in result.fetchall())

    return False


async def _table_exists(conn: AsyncConnection, table: str, dialect: str) -> bool:
    if dialect == "postgresql":
        result = await conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_name = :table"
            ),
            {"table": table},
        )
        return result.scalar_one_or_none() is not None

    if dialect == "sqlite":
        result = await conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :table"),
            {"table": table},
        )
        return result.scalar_one_or_none() is not None

    return False


async def _backfill_invite_codes(conn: AsyncConnection) -> None:
    """Assign invite codes to existing subjects that don't have one."""
    alphabet = string.ascii_uppercase + string.digits
    result = await conn.execute(text("SELECT id FROM subjects WHERE invite_code IS NULL"))
    subject_ids = [row[0] for row in result.fetchall()]
    if not subject_ids:
        return

    for subject_id in subject_ids:
        for _ in range(20):
            code = "".join(secrets.choice(alphabet) for _ in range(6))
            exists = await conn.execute(
                text("SELECT 1 FROM subjects WHERE invite_code = :code"),
                {"code": code},
            )
            if exists.scalar_one_or_none() is None:
                await conn.execute(
                    text("UPDATE subjects SET invite_code = :code WHERE id = :id"),
                    {"code": code, "id": subject_id},
                )
                break
        else:
            logger.error("Failed to generate invite code for subject id=%s", subject_id)

    logger.info("Backfilled invite codes for %d subject(s)", len(subject_ids))


async def _ensure_materials_image_type(conn: AsyncConnection, dialect: str) -> None:
    if dialect != "postgresql" or not await _table_exists(conn, "materials", dialect):
        return
    try:
        # Find ALL check constraints on materials table that mention 'type'
        check = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = 'materials'::regclass
              AND contype = 'c'
        """))
        rows = check.fetchall()

        has_image = False
        type_constraints = []
        for conname, condef in rows:
            if condef and "type" in condef.lower():
                type_constraints.append(conname)
                if "'image'" in condef:
                    has_image = True

        if has_image:
            logger.debug("materials type constraint already includes 'image'")
            return

        # Drop ALL check constraints that mention 'type' (handles any format)
        for conname in type_constraints:
            await conn.execute(text(
                f'ALTER TABLE materials DROP CONSTRAINT {conname}'
            ))
            logger.info("Dropped stale materials constraint: %s", conname)

        # Recreate with correct values
        await conn.execute(text("""
            ALTER TABLE materials ADD CONSTRAINT ck_material_type
            CHECK (type IN ('file', 'image', 'video', 'youtube', 'link', 'text'))
        """))
        logger.info("Created materials ck_material_type with 'image' support")
    except Exception as exc:
        logger.error("CRITICAL: materials image type constraint fix FAILED: %s", exc, exc_info=True)


async def _ensure_notification_attachment_type(conn: AsyncConnection, dialect: str) -> None:
    """Update notification_attachments type constraint to include 'image' and 'video'."""
    if dialect != "postgresql" or not await _table_exists(conn, "notification_attachments", dialect):
        return
    try:
        # Find ALL check constraints on notification_attachments table that mention 'type'
        check = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = 'notification_attachments'::regclass
              AND contype = 'c'
        """))
        rows = check.fetchall()

        has_image = False
        type_constraints = []
        for conname, condef in rows:
            if condef and "type" in condef.lower():
                type_constraints.append(conname)
                if "'image'" in condef:
                    has_image = True

        if has_image:
            logger.debug("notification_attachments type constraint already includes 'image'")
            return

        # Drop ALL check constraints that mention 'type' (handles any format)
        for conname in type_constraints:
            await conn.execute(text(
                f'ALTER TABLE notification_attachments DROP CONSTRAINT {conname}'
            ))
            logger.info("Dropped stale notification_attachments constraint: %s", conname)

        # Recreate with correct values
        await conn.execute(text("""
            ALTER TABLE notification_attachments ADD CONSTRAINT ck_attachment_type
            CHECK (type IN ('file', 'link', 'image', 'video'))
        """))
        logger.info("Created notification_attachments ck_attachment_type with 'image' and 'video' support")
    except Exception as exc:
        logger.error("CRITICAL: notification_attachments type constraint fix FAILED: %s", exc, exc_info=True)


async def _drop_subjects_name_unique(conn: AsyncConnection, dialect: str) -> None:
    """Course names are unique per teacher, not globally — drop legacy UNIQUE(name)."""
    if dialect != "postgresql" or not await _table_exists(conn, "subjects", dialect):
        return
    try:
        check = await conn.execute(text("""
            SELECT conname, pg_get_constraintdef(oid) AS def
            FROM pg_constraint
            WHERE conrelid = 'subjects'::regclass AND contype = 'u'
        """))
        for conname, condef in check.fetchall():
            if not condef:
                continue
            def_lower = condef.lower()
            if "name" in def_lower and "invite_code" not in def_lower:
                await conn.execute(text(f'ALTER TABLE subjects DROP CONSTRAINT IF EXISTS "{conname}"'))
                logger.info("Dropped subjects unique constraint on name: %s", conname)
    except Exception as exc:
        logger.error("CRITICAL: drop subjects.name unique constraint FAILED: %s", exc, exc_info=True)


async def ensure_critical_schema(conn: AsyncConnection, dialect: str) -> None:
    """Idempotent columns required by current models. Safe to run every startup."""
    await _drop_subjects_name_unique(conn, dialect)

    if await _table_exists(conn, "subjects", dialect):
        if not await _column_exists(conn, "subjects", "google_drive_folder_id", dialect):
            logger.info("Adding subjects.google_drive_folder_id (critical)")
            await conn.execute(text("ALTER TABLE subjects ADD COLUMN google_drive_folder_id VARCHAR"))

        if not await _column_exists(conn, "subjects", "archived_at", dialect):
            logger.info("Adding subjects.archived_at (critical)")
            await conn.execute(text("ALTER TABLE subjects ADD COLUMN archived_at TIMESTAMP"))

        # Legacy archive deactivated lessons — reactivate so enrollments/staff remain visible
        try:
            await conn.execute(text("""
                UPDATE lessons SET is_active = TRUE
                WHERE subject_id IN (
                    SELECT id FROM subjects WHERE is_archived = TRUE AND is_deleted = FALSE
                )
            """))
        except Exception as exc:
            logger.debug("Reactivate archived lessons skipped: %s", exc)

    await _ensure_materials_image_type(conn, dialect)
    await _ensure_notification_attachment_type(conn, dialect)

    if await _table_exists(conn, "users", dialect):
        if not await _column_exists(conn, "users", "profile_theme", dialect):
            logger.info("Adding users.profile_theme (critical)")
            if dialect == "postgresql":
                await conn.execute(text("ALTER TABLE users ADD COLUMN profile_theme JSONB"))
            else:
                await conn.execute(text("ALTER TABLE users ADD COLUMN profile_theme TEXT"))


async def run_migrations(conn: AsyncConnection, dialect: str) -> None:
    logger.info("Running schema migrations (dialect=%s)", dialect)

    if dialect == "postgresql":
        for table_name in ("users", "registrations", "admins"):
            try:
                await conn.execute(
                    text(f'ALTER TABLE "{table_name}" ALTER COLUMN telegram_id TYPE BIGINT')
                )
            except Exception as exc:
                logger.debug("telegram_id BIGINT migration skipped for %s: %s", table_name, exc)

    if await _table_exists(conn, "subjects", dialect):
        if not await _column_exists(conn, "subjects", "is_archived", dialect):
            logger.info("Adding subjects.is_archived")
            if dialect == "postgresql":
                await conn.execute(
                    text("ALTER TABLE subjects ADD COLUMN is_archived BOOLEAN DEFAULT FALSE")
                )
            else:
                await conn.execute(
                    text("ALTER TABLE subjects ADD COLUMN is_archived BOOLEAN DEFAULT 0")
                )

        if not await _column_exists(conn, "subjects", "invite_code", dialect):
            logger.info("Adding subjects.invite_code")
            await conn.execute(text("ALTER TABLE subjects ADD COLUMN invite_code VARCHAR(6)"))

        if not await _column_exists(conn, "subjects", "is_deleted", dialect):
            logger.info("Adding subjects.is_deleted")
            if dialect == "postgresql":
                await conn.execute(
                    text("ALTER TABLE subjects ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE")
                )
            else:
                await conn.execute(
                    text("ALTER TABLE subjects ADD COLUMN is_deleted BOOLEAN DEFAULT 0")
                )

        if not await _column_exists(conn, "subjects", "deleted_at", dialect):
            logger.info("Adding subjects.deleted_at")
            await conn.execute(text("ALTER TABLE subjects ADD COLUMN deleted_at TIMESTAMP"))

        if not await _column_exists(conn, "subjects", "google_drive_folder_id", dialect):
            logger.info("Adding subjects.google_drive_folder_id")
            await conn.execute(text("ALTER TABLE subjects ADD COLUMN google_drive_folder_id VARCHAR"))

        if dialect == "postgresql":
            await conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_subjects_invite_code ON subjects (invite_code)")
            )
        else:
            await conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_subjects_invite_code ON subjects (invite_code)")
            )

        try:
            await _backfill_invite_codes(conn)
        except Exception as exc:
            logger.warning("invite code backfill skipped: %s", exc)

    if dialect == "postgresql":
        for idx_name, table, col in [
            ("ix_lessons_is_active", "lessons", "is_active"),
            ("ix_tests_is_active", "tests", "is_active"),
            ("ix_subjects_is_archived", "subjects", "is_archived"),
        ]:
            try:
                await conn.execute(
                    text(f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ("{col}")')
                )
            except Exception as exc:
                logger.debug("Index %s skipped: %s", idx_name, exc)

    # Performance indexes for common queries
    for idx_name, table, col in [
        ("idx_lessons_subject_id", "lessons", "subject_id"),
        ("idx_lesson_enrollments_lesson_id", "lesson_enrollments", "lesson_id"),
        ("idx_lesson_enrollments_user_id", "lesson_enrollments", "user_id"),
        ("idx_attendance_lesson_id", "attendance", "lesson_id"),
        ("idx_notifications_created_at", "notifications", "created_at"),
        ("idx_notification_reads_user_id", "notification_reads", "user_id"),
        ("idx_users_telegram_id", "users", "telegram_id"),
    ]:
        try:
            await conn.execute(
                text(f'CREATE INDEX IF NOT EXISTS {idx_name} ON "{table}" ("{col}")')
            )
        except Exception as exc:
            logger.debug("Index %s skipped: %s", idx_name, exc)

    if not await _table_exists(conn, "enrollment_requests", dialect):
        logger.info("Creating enrollment_requests table")
        if dialect == "postgresql":
            await conn.execute(text("""
                CREATE TABLE enrollment_requests (
                    id SERIAL PRIMARY KEY,
                    subject_id INTEGER NOT NULL REFERENCES subjects(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    status VARCHAR DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(subject_id, user_id)
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_enrollment_requests_subject_id ON enrollment_requests (subject_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_enrollment_requests_user_id ON enrollment_requests (user_id)")
            )
        else:
            await conn.execute(text("""
                CREATE TABLE enrollment_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER NOT NULL REFERENCES subjects(id),
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    status VARCHAR DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(subject_id, user_id)
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_enrollment_requests_subject_id ON enrollment_requests (subject_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_enrollment_requests_user_id ON enrollment_requests (user_id)")
            )

    if not await _table_exists(conn, "materials", dialect):
        logger.info("Creating materials table")
        if dialect == "postgresql":
            await conn.execute(text("""
                CREATE TABLE materials (
                    id SERIAL PRIMARY KEY,
                    subject_id INTEGER REFERENCES subjects(id),
                    lesson_id INTEGER REFERENCES lessons(id),
                    title VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    url VARCHAR,
                    content TEXT,
                    file_name VARCHAR,
                    file_size INTEGER,
                    google_file_id VARCHAR,
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT NOW(),
                    CHECK (subject_id IS NOT NULL OR lesson_id IS NOT NULL),
                    CHECK (type IN ('file', 'image', 'video', 'youtube', 'link', 'text'))
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_subject_id ON materials (subject_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_lesson_id ON materials (lesson_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_created_by ON materials (created_by)")
            )
        else:
            await conn.execute(text("""
                CREATE TABLE materials (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    subject_id INTEGER REFERENCES subjects(id),
                    lesson_id INTEGER REFERENCES lessons(id),
                    title VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    url VARCHAR,
                    content TEXT,
                    file_name VARCHAR,
                    file_size INTEGER,
                    google_file_id VARCHAR,
                    created_by INTEGER NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK (subject_id IS NOT NULL OR lesson_id IS NOT NULL),
                    CHECK (type IN ('file', 'image', 'video', 'youtube', 'link', 'text'))
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_subject_id ON materials (subject_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_lesson_id ON materials (lesson_id)")
            )
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_materials_created_by ON materials (created_by)")
            )

    if not await _table_exists(conn, "notification_attachments", dialect):
        logger.info("Creating notification_attachments table")
        if dialect == "postgresql":
            await conn.execute(text("""
                CREATE TABLE notification_attachments (
                    id SERIAL PRIMARY KEY,
                    notification_id INTEGER NOT NULL REFERENCES notifications(id),
                    title VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    url VARCHAR,
                    file_name VARCHAR,
                    file_size INTEGER,
                    google_file_id VARCHAR,
                    created_at TIMESTAMP DEFAULT NOW(),
                    CHECK (type IN ('file', 'link'))
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_notification_attachments_notification_id ON notification_attachments (notification_id)")
            )
        else:
            await conn.execute(text("""
                CREATE TABLE notification_attachments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    notification_id INTEGER NOT NULL REFERENCES notifications(id),
                    title VARCHAR NOT NULL,
                    type VARCHAR NOT NULL,
                    url VARCHAR,
                    file_name VARCHAR,
                    file_size INTEGER,
                    google_file_id VARCHAR,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CHECK (type IN ('file', 'link'))
                )
            """))
            await conn.execute(
                text("CREATE INDEX IF NOT EXISTS ix_notification_attachments_notification_id ON notification_attachments (notification_id)")
            )

    if await _table_exists(conn, "lessons", dialect):
        for col, col_type in [
            ("effective_from", "DATE"),
            ("effective_until", "DATE"),
            ("slot_group_id", "INTEGER"),
            ("specific_date", "DATE"),
        ]:
            if not await _column_exists(conn, "lessons", col, dialect):
                logger.info("Adding lessons.%s", col)
                await conn.execute(text(f"ALTER TABLE lessons ADD COLUMN {col} {col_type}"))

        try:
            await conn.execute(text("""
                UPDATE lessons
                SET slot_group_id = id
                WHERE slot_group_id IS NULL
            """))
            if dialect == "postgresql":
                await conn.execute(text("""
                    UPDATE lessons l
                    SET effective_from = COALESCE(
                        (SELECT s.start_date::date FROM subjects s WHERE s.id = l.subject_id),
                        l.created_at::date
                    )
                    WHERE l.effective_from IS NULL
                """))
            else:
                await conn.execute(text("""
                    UPDATE lessons
                    SET effective_from = date(created_at)
                    WHERE effective_from IS NULL
                """))
        except Exception as exc:
            logger.warning("lessons schedule backfill skipped: %s", exc)

    # Also ensure image type in run_migrations (same logic as ensure_critical_schema)
    await _ensure_materials_image_type(conn, dialect)
    await _ensure_notification_attachment_type(conn, dialect)

    # Add specific_date to teacher_availability
    if await _table_exists(conn, "teacher_availability", dialect):
        if not await _column_exists(conn, "teacher_availability", "specific_date", dialect):
            logger.info("Adding teacher_availability.specific_date")
            await conn.execute(text("ALTER TABLE teacher_availability ADD COLUMN specific_date DATE"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_teacher_availability_specific_date ON teacher_availability (specific_date)"))
        # Update unique constraint (drop old, add new)
        try:
            if dialect == "postgresql":
                await conn.execute(text("ALTER TABLE teacher_availability DROP CONSTRAINT IF EXISTS uq_teacher_day_start"))
                await conn.execute(text("""
                    DO $$ BEGIN
                        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_teacher_day_start_date') THEN
                            ALTER TABLE teacher_availability ADD CONSTRAINT uq_teacher_day_start_date UNIQUE (teacher_id, day_of_week, start_time, specific_date);
                        END IF;
                    END $$;
                """))
        except Exception as exc:
            logger.debug("teacher_availability constraint migration skipped: %s", exc)

    # Create availability_requests table
    if not await _table_exists(conn, "availability_requests", dialect):
        logger.info("Creating availability_requests table")
        if dialect == "postgresql":
            await conn.execute(text("""
                CREATE TABLE availability_requests (
                    id SERIAL PRIMARY KEY,
                    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
                    teacher_id INTEGER NOT NULL REFERENCES users(id),
                    requested_by INTEGER NOT NULL REFERENCES users(id),
                    date DATE NOT NULL,
                    start_time VARCHAR NOT NULL,
                    end_time VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT NOW(),
                    resolved_at TIMESTAMP
                )
            """))
        else:
            await conn.execute(text("""
                CREATE TABLE availability_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
                    teacher_id INTEGER NOT NULL REFERENCES users(id),
                    requested_by INTEGER NOT NULL REFERENCES users(id),
                    date DATE NOT NULL,
                    start_time VARCHAR NOT NULL,
                    end_time VARCHAR NOT NULL,
                    status VARCHAR DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP
                )
            """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_availability_requests_lesson_id ON availability_requests (lesson_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_availability_requests_teacher_id ON availability_requests (teacher_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_availability_requests_status ON availability_requests (status)"))

    # Add original_date to availability_requests
    if await _table_exists(conn, "availability_requests", dialect):
        if not await _column_exists(conn, "availability_requests", "original_date", dialect):
            logger.info("Adding availability_requests.original_date")
            await conn.execute(text("ALTER TABLE availability_requests ADD COLUMN original_date DATE"))
            # Backfill: set original_date = date for existing rows
            await conn.execute(text("UPDATE availability_requests SET original_date = date WHERE original_date IS NULL"))

    logger.info("Schema migrations complete")
