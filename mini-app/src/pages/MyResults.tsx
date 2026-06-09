import { useTranslation } from 'react-i18next';
import { useMyResults } from '../api/hooks';
import { Card, Loading, EmptyState, ErrorBanner } from '../shared/components';
import { formatDate, langToLocale } from '../shared/utils/formatDate';

function getScoreColor(score: number, maxScore: number): string {
  if (maxScore <= 0) return 'var(--color-on-surface-variant)';
  const pct = (score / maxScore) * 100;
  if (pct >= 75) return '#2e7d32';
  if (pct >= 50) return '#f9a825';
  return '#d32f2f';
}

function getScoreLabel(score: number, maxScore: number): string {
  if (maxScore <= 0) return '⚪';
  const pct = (score / maxScore) * 100;
  if (pct >= 75) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

export default function MyResults() {
  const { t, i18n } = useTranslation();
  const { data: results = [], isLoading, error } = useMyResults();

  const locale = langToLocale(i18n.language);

  if (isLoading) return <Loading fullPage message={t('results.loading')} data-testid="loading" />;
  if (error) return <ErrorBanner message={error.message} data-testid="error-banner" />;
  if (results.length === 0) return <EmptyState title={t('results.noResults')} message={t('results.noResultsMessage')} data-testid="empty-state" />;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 style={{ color: 'var(--color-on-surface)', margin: 0 }}>{t('results.title')}</h2>
      {results.map((r) => (
        <Card key={r.id} data-testid="result-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--color-on-surface)' }}>{r.test_subject}</h4>
              <p style={{ margin: 0, color: 'var(--color-on-surface-variant)', fontSize: '13px' }}>
                {formatDate(r.test_datetime, locale)}
              </p>
              {r.comment && (
                <p style={{ margin: '4px 0 0 0', color: 'var(--color-on-surface-variant)', fontSize: '13px', fontStyle: 'italic' }}>
                  «{r.comment}»
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '24px' }}>{getScoreLabel(r.score, r.max_score)}</span>
              <p style={{ margin: 0, color: getScoreColor(r.score, r.max_score), fontWeight: 'bold', fontSize: '18px' }}>
                {r.score} / {r.max_score}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
