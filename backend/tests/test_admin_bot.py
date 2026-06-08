import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiogram.types import Message, User, Chat

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from bot.handlers.admin import router as admin_router, is_admin


@pytest.fixture
def mock_message():
    """Create a mock Message object."""
    user = User(id=123456, is_bot=False, first_name="Test", last_name="User", username="testuser")
    chat = Chat(id=123456, type="private")
    message = MagicMock(spec=Message)
    message.from_user = user
    message.chat = chat
    message.answer = AsyncMock()
    return message


@pytest.fixture
def mock_message_no_user():
    """Create a mock Message without from_user."""
    message = MagicMock(spec=Message)
    message.from_user = None
    message.answer = AsyncMock()
    return message


class TestIsAdmin:
    """Test is_admin function."""

    @pytest.mark.asyncio
    async def test_is_admin_true(self):
        """Test that is_admin returns True for existing admin."""
        mock_db = MagicMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = True
        mock_db.execute = AsyncMock(return_value=mock_res)

        class AsyncContextManagerMock:
            async def __aenter__(self):
                return mock_db
            async def __aexit__(self, exc_type, exc, tb):
                pass

        with patch("bot.handlers.admin.get_dbCtx", return_value=AsyncContextManagerMock()):
            assert await is_admin(123456) is True

    @pytest.mark.asyncio
    async def test_is_admin_false(self):
        """Test that is_admin returns False for non-admin."""
        mock_db = MagicMock()
        mock_res = MagicMock()
        mock_res.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_res)

        class AsyncContextManagerMock:
            async def __aenter__(self):
                return mock_db
            async def __aexit__(self, exc_type, exc, tb):
                pass

        with patch("bot.handlers.admin.get_dbCtx", return_value=AsyncContextManagerMock()):
            assert await is_admin(999999) is False


class TestAdminCommands:
    """Test admin bot commands."""

    @pytest.mark.asyncio
    async def test_admin_command_is_admin(self, mock_message):
        """Test /admin command for admin user."""
        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=True)):
            from bot.handlers.admin import cmd_admin
            await cmd_admin(mock_message)
            mock_message.answer.assert_called_once_with("✅ Вы являетесь администратором")

    @pytest.mark.asyncio
    async def test_admin_command_not_admin(self, mock_message):
        """Test /admin command for non-admin user."""
        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=False)):
            from bot.handlers.admin import cmd_admin
            await cmd_admin(mock_message)
            mock_message.answer.assert_called_once_with("У вас нет прав администратора")

    @pytest.mark.asyncio
    async def test_admin_command_no_user(self, mock_message_no_user):
        """Test /admin command when user cannot be identified."""
        from bot.handlers.admin import cmd_admin
        await cmd_admin(mock_message_no_user)
        mock_message_no_user.answer.assert_called_once_with("Не удалось определить пользователя")

    @pytest.mark.asyncio
    async def test_list_command_no_rights(self, mock_message):
        """Test /list command for non-admin user."""
        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=False)):
            from bot.handlers.admin import cmd_list
            await cmd_list(mock_message)
            mock_message.answer.assert_called_once_with("У вас нет прав администратора")

    @pytest.mark.asyncio
    async def test_stats_command_no_rights(self, mock_message):
        """Test /stats command for non-admin user."""
        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=False)):
            from bot.handlers.admin import cmd_stats
            await cmd_stats(mock_message)
            mock_message.answer.assert_called_once_with("У вас нет прав администратора")

    @pytest.mark.asyncio
    async def test_list_command_is_admin_empty(self, mock_message):
        """Test /list command for admin with no active tests."""
        mock_db = MagicMock()
        mock_res = MagicMock()
        mock_res.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_res)

        class AsyncContextManagerMock:
            async def __aenter__(self):
                return mock_db
            async def __aexit__(self, exc_type, exc, tb):
                pass

        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=True)):
            with patch("bot.handlers.admin.get_dbCtx", return_value=AsyncContextManagerMock()):
                from bot.handlers.admin import cmd_list
                await cmd_list(mock_message)
                mock_message.answer.assert_called_once_with("Нет активных тестов")

    @pytest.mark.asyncio
    async def test_stats_command_is_admin(self, mock_message):
        """Test /stats command for admin."""
        mock_db = MagicMock()
        
        mock_res1 = MagicMock()
        mock_res1.scalar.return_value = 10
        mock_res2 = MagicMock()
        mock_res2.scalar.return_value = 50
        mock_res3 = MagicMock()
        mock_res3.scalar.return_value = 25
        
        mock_db.execute = AsyncMock(side_effect=[mock_res1, mock_res2, mock_res3])

        class AsyncContextManagerMock:
            async def __aenter__(self):
                return mock_db
            async def __aexit__(self, exc_type, exc, tb):
                pass

        with patch("bot.handlers.admin.is_admin", new=AsyncMock(return_value=True)):
            with patch("bot.handlers.admin.get_dbCtx", return_value=AsyncContextManagerMock()):
                from bot.handlers.admin import cmd_stats
                await cmd_stats(mock_message)
                mock_message.answer.assert_called_once()
                call_args = mock_message.answer.call_args[0][0]
                assert "Всего тестов: 10" in call_args
                assert "Всего регистраций: 50" in call_args
                assert "Уникальных студентов: 25" in call_args