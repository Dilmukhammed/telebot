import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getMyRegistrations,
  cancelRegistration,
  getMyResults,
} from '../api/client';
import type { RegistrationOut, ResultOut } from '../shared/types';
import {
  Card,
  Button,
  Loading,
  ErrorBanner,
  EmptyState,
  Modal,
} from '../shared/components';
import { formatDateTime, langToLocale } from '../shared/utils/formatDate';
import styles from './MyRegistrations.module.css';

type FilterType = 'active' | 'all' | 'cancelled';

function isFutureTest(iso: string): boolean {
  return new Date(iso) > new Date();
}

function getResultForRegistration(
  registrationId: number,
  results: ResultOut[]
): ResultOut | undefined {
  return results.find((r) => r.registration_id === registrationId);
}

export const MyRegistrations: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [registrations, setRegistrations] = useState<RegistrationOut[]>([]);
  const [results, setResults] = useState<ResultOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('active');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const locale = langToLocale(i18n.language);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [regs, res] = await Promise.all([
        getMyRegistrations(),
        getMyResults(),
      ]);
      setRegistrations(regs);
      setResults(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    if (filter === 'all') return registrations;
    if (filter === 'cancelled')
      return registrations.filter((r) => r.status === 'cancelled');
    return registrations.filter(
      (r) => r.status === 'registered' && isFutureTest(r.test_datetime)
    );
  }, [registrations, filter]);

  const handleCancel = async (id: number) => {
    setCancellingId(id);
    try {
      await cancelRegistration(id);
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('registrations.cancelError'));
    } finally {
      setCancellingId(null);
      setConfirmId(null);
    }
  };

  const activeCount = useMemo(
    () =>
      registrations.filter(
        (r) => r.status === 'registered' && isFutureTest(r.test_datetime)
      ).length,
    [registrations]
  );
  const cancelledCount = useMemo(
    () => registrations.filter((r) => r.status === 'cancelled').length,
    [registrations]
  );

  if (loading) {
    return <Loading fullPage message={t('registrations.loading')} data-testid="loading" />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('registrations.title')}</h1>

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          onRetry={fetchData}
          data-testid="error-banner"
        />
      )}

      <div className={styles.filters} role="tablist" aria-label={t('registrations.filterLabel')}>
        <button
          className={`${styles.filterBtn} ${filter === 'active' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('active')}
          role="tab"
          aria-selected={filter === 'active'}
          type="button"
        >
          {t('registrations.active')}
          {activeCount > 0 && (
            <span className={styles.filterBadge}>{activeCount}</span>
          )}
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('all')}
          role="tab"
          aria-selected={filter === 'all'}
          type="button"
        >
          {t('registrations.all')}
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'cancelled' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('cancelled')}
          role="tab"
          aria-selected={filter === 'cancelled'}
          type="button"
        >
          {t('registrations.cancelled')}
          {cancelledCount > 0 && (
            <span className={styles.filterBadge}>{cancelledCount}</span>
          )}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('registrations.noRegistrations')}
          message={t('registrations.noRegistrationsMessage')}
          data-testid="empty-state"
        />
      ) : (
        <div className={styles.list}>
          {filtered.map((reg) => {
            const result = getResultForRegistration(reg.id, results);
            const isActive =
              reg.status === 'registered' && isFutureTest(reg.test_datetime);

            return (
              <Card
                key={reg.id}
                className={styles.card}
                data-testid="registration-card"
              >
                <div className={styles.cardHeader}>
                  <h3 className={styles.subject}>{reg.test_subject}</h3>
                  <span
                    className={`${styles.badge} ${reg.status === 'registered' ? styles.badgeGreen : styles.badgeGray}`}
                  >
                    {reg.status === 'registered' ? t('registrations.registered') : t('registrations.statusCancelled')}
                  </span>
                </div>

                <p className={styles.datetime}>
                  {formatDateTime(reg.test_datetime, locale)}
                </p>

                {result && (
                  <div className={styles.resultBlock}>
                    <span className={styles.resultLabel}>{t('registrations.result')}</span>
                    <span className={styles.resultScore}>
                      {result.score} / {result.max_score}
                    </span>
                  </div>
                )}

                {isActive && (
                  <div className={styles.actions}>
                    <Button
                      variant="danger"
                      onClick={() => setConfirmId(reg.id)}
                      loading={cancellingId === reg.id}
                      data-testid="cancel-btn"
                      fullWidth
                    >
                      {t('registrations.cancel')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title={t('registrations.confirmCancel')}
      >
        <p className={styles.confirmText}>
          {t('registrations.confirmCancelText')}
        </p>
        <div className={styles.confirmActions}>
          <Button
            variant="secondary"
            onClick={() => setConfirmId(null)}
            fullWidth
          >
            {t('registrations.noLeave')}
          </Button>
          <Button
            variant="danger"
            onClick={() => confirmId !== null && handleCancel(confirmId)}
            loading={cancellingId === confirmId}
            fullWidth
          >
            {t('registrations.yesCancel')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default MyRegistrations;
