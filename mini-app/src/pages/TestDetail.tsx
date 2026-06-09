import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTest, useMyRegistrations, useRegisterForTest } from '../api/hooks';
import { Button, Loading, ErrorBanner } from '../shared/components';
import { formatDateTime, langToLocale } from '../shared/utils/formatDate';

export default function TestDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const testId = Number(id);
  const { data: test, isLoading, error } = useTest(testId);
  const { data: registrations = [] } = useMyRegistrations();
  const registerMutation = useRegisterForTest();
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const locale = langToLocale(i18n.language);

  const alreadyRegistered = useMemo(() => {
    return registrations.some(r => r.test_id === testId && r.status === 'registered');
  }, [registrations, testId]);

  const handleRegister = async () => {
    setRegistering(true);
    setRegisterError('');
    try {
      await registerMutation.mutateAsync(testId);
      setSuccess(true);
    } catch (e: unknown) {
      setRegisterError(e instanceof Error ? e.message : t('test.registerError'));
    } finally {
      setRegistering(false);
    }
  };

  if (isLoading) return <Loading fullPage message={t('test.loading')} data-testid="loading" />;
  if (error && !test) return <ErrorBanner message={error.message} data-testid="error-banner" />;
  if (!test) return <ErrorBanner message={t('test.notFound')} data-testid="error-banner" />;

  const isPast = new Date(test.datetime) < new Date();
  const formatLabel = test.format === 'online' ? t('test.online') : t('test.offline');
  const spotsLeft = test.max_capacity - test.registered_count;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {registerError && <ErrorBanner message={registerError} onDismiss={() => setRegisterError('')} />}

      <h2 style={{ color: 'var(--color-on-surface)', margin: 0 }}>{test.subject_name}</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-on-surface)' }}>
        <p style={{ margin: 0 }}>📅 {formatDateTime(test.datetime, locale)}</p>
        <p style={{ margin: 0 }}>{formatLabel}</p>
        <p style={{ margin: 0 }}>⏱ {test.duration_minutes} {t('test.minutes')}</p>
        <p style={{ margin: 0 }}>
          👥 {t('test.spots')}: {test.registered_count} / {test.max_capacity}
          {spotsLeft > 0 && ` (${t('test.available')}: ${spotsLeft})`}
        </p>
      </div>

      {success ? (
        <div data-testid="success-message" style={{ padding: '12px', background: 'rgba(67, 160, 71, 0.1)', borderRadius: '8px', color: '#2e7d32', textAlign: 'center' }}>
          ✅ {t('test.registered')}
        </div>
      ) : alreadyRegistered ? (
        <div style={{ padding: '12px', background: 'var(--color-surface-container-high)', borderRadius: '8px', color: 'var(--color-on-surface)', textAlign: 'center' }}>
          ✅ {t('test.alreadyRegistered')}
        </div>
      ) : isPast ? (
        <p style={{ color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{t('test.passed')}</p>
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
          {t('nav.registrations')}
        </Button>
      )}
    </div>
  );
}
