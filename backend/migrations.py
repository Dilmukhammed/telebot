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

        if dialect == "postgresql":
            await conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_subjects_invite_code ON subjects (invite_code)")
            )
        else:
            await conn.execute(
                text("CREATE UNIQUE INDEX IF NOT EXISTS ix_subjects_invite_code ON subjects (invite_code)")
            )

        await _backfill_invite_codes(conn)

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
                    CHECK (type IN ('file', 'video', 'youtube', 'link', 'text'))
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
                    CHECK (type IN ('file', 'video', 'youtube', 'link', 'text'))
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

    logger.info("Schema migrations complete")
