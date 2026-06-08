import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getTest, registerForTest, getMyRegistrations } from '../api/client';
import { Button } from '../shared/components/Button';
import { Loading } from '../shared/components/Loading';
import { ErrorBanner } from '../shared/components/ErrorBanner';

interface TestData {
  id: number;
  subject_name: string;
  datetime: string;
  max_capacity: number;
  format: 'online' | 'offline';
  duration_minutes: number;
  registered_count: number;
  has_capacity: boolean;
  is_active: boolean;
}

export default function TestDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [testData, regs] = await Promise.all([getTest(Number(id)), getMyRegistrations()]);
        setTest(testData as unknown as TestData);
        // Check if already registered for this test
        const isRegistered = (regs as any[]).some((r: any) => r.test_id === Number(id) && r.status === 'registered');
        setAlreadyRegistered(isRegistered);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleRegister = async () => {
    setRegistering(true);
    setError('');
    try {
      await registerForTest(Number(id));
      setSuccess(true);
      setAlreadyRegistered(true);
    } catch (e: any) {
      setError(e.message || 'Ошибка регистрации');
    } finally {
      setRegistering(false);
    }
  };

  if (loading) return <Loading fullPage message="Загрузка теста..." data-testid="loading" />;
  if (error && !test) return <ErrorBanner message={error} data-testid="error-banner" />;
  if (!test) return <ErrorBanner message="Тест не найден" data-testid="error-banner" />;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const locale = i18n.language === 'en' ? 'en-US' : i18n.language === 'uz' ? 'uz-UZ' : 'ru-RU';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const isPast = new Date(test.datetime) < new Date();
  const formatLabel = test.format === 'online' ? '🖥 Онлайн' : '🏫 Офлайн';
  const spotsLeft = test.max_capacity - test.registered_count;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error && <ErrorBanner message={error} onDismiss={() => setError('')} />}

      <h2 style={{ color: 'var(--tg-text-color)', margin: 0 }}>{test.subject_name}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--tg-text-color)' }}>
        <p style={{ margin: 0 }}>📅 {formatDate(test.datetime)}</p>
        <p style={{ margin: 0 }}>{formatLabel}</p>
        <p style={{ margin: 0 }}>⏱ {test.duration_minutes} {t('test.minutes')}</p>
        <p style={{ margin: 0 }}>
          👥 {t('test.spots')}: {test.registered_count} / {test.max_capacity}
          {spotsLeft > 0 && ` (${t('test.available')}: ${spotsLeft})`}
        </p>
      </div>

      {success ? (
        <div data-testid="success-message" style={{ padding: '12px', background: '#e8f5e9', borderRadius: '8px', color: '#2e7d32', textAlign: 'center' }}>
          ✅ {t('test.registered')}
        </div>
      ) : alreadyRegistered ? (
        <div style={{ padding: '12px', background: 'var(--tg-secondary-bg-color, #f0f0f0)', borderRadius: '8px', color: 'var(--tg-text-color)', textAlign: 'center' }}>
          ✅ {t('test.alreadyRegistered')}
        </div>
      ) : isPast ? (
        <p style={{ color: 'var(--tg-hint-color, #999)', textAlign: 'center' }}>{t('test.passed')}</p>
      ) : !test.has_capacity ? (
        <p style={{ color: '#d32f2f', textAlign: 'center' }}>{t('test.full')}</p>
      ) : (
        <Button
          variant="primary"
          onClick={handleRegister}
          disabled={registering}
          data-testid="register-btn"
          fullWidth
        >
          {registering ? '...' : t('test.register')}
        </Button>
      )}

      {success && (
        <Button
          variant="secondary"
          onClick={() => navigate('/registrations')}
          fullWidth
        >
          {t('nav.registrations', { defaultValue: 'Мои записи' })}
        </Button>
      )}
    </div>
  );
}