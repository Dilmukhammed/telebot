import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import styles from './MyRegistrations.module.css';

type FilterType = 'active' | 'all' | 'cancelled';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const [registrations, setRegistrations] = useState<RegistrationOut[]>([]);
  const [results, setResults] = useState<ResultOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('active');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

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
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(e instanceof Error ? e.message : 'Ошибка отмены записи');
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
    return <Loading fullPage message="Загрузка записей..." data-testid="loading" />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Мои записи</h1>

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={() => setError(null)}
          data-testid="error-banner"
        />
      )}

      <div className={styles.filters} role="tablist" aria-label="Фильтр записей">
        <button
          className={`${styles.filterBtn} ${filter === 'active' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('active')}
          role="tab"
          aria-selected={filter === 'active'}
          type="button"
        >
          Активные
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
          Все
        </button>
        <button
          className={`${styles.filterBtn} ${filter === 'cancelled' ? styles.filterBtnActive : ''}`}
          onClick={() => setFilter('cancelled')}
          role="tab"
          aria-selected={filter === 'cancelled'}
          type="button"
        >
          Отменённые
          {cancelledCount > 0 && (
            <span className={styles.filterBadge}>{cancelledCount}</span>
          )}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Нет записей"
          message="У вас пока нет записей на тесты"
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
                    {reg.status === 'registered' ? 'Записан' : 'Отменён'}
                  </span>
                </div>

                <p className={styles.datetime}>
                  {formatDateTime(reg.test_datetime)}
                </p>

                {result && (
                  <div className={styles.resultBlock}>
                    <span className={styles.resultLabel}>Результат:</span>
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
                      Отменить
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
        title="Подтвердите отмену"
      >
        <p className={styles.confirmText}>
          Вы уверены, что хотите отменить запись на тест?
        </p>
        <div className={styles.confirmActions}>
          <Button
            variant="secondary"
            onClick={() => setConfirmId(null)}
            fullWidth
          >
            Нет, оставить
          </Button>
          <Button
            variant="danger"
            onClick={() => confirmId !== null && handleCancel(confirmId)}
            loading={cancellingId === confirmId}
            fullWidth
          >
            Да, отменить
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default MyRegistrations;
