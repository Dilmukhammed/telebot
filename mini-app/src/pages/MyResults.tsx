import { useState, useEffect } from 'react';
import { getMyResults } from '../api/client';
import { Card } from '../shared/components/Card';
import { Loading } from '../shared/components/Loading';
import { EmptyState } from '../shared/components/EmptyState';
import { ErrorBanner } from '../shared/components/ErrorBanner';

interface ResultData {
  id: number;
  registration_id: number;
  test_subject: string;
  test_datetime: string;
  score: number;
  max_score: number;
  comment?: string;
}

function getScoreColor(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 75) return '#2e7d32';
  if (pct >= 50) return '#f9a825';
  return '#d32f2f';
}

function getScoreLabel(score: number, maxScore: number): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 75) return '🟢';
  if (pct >= 50) return '🟡';
  return '🔴';
}

export default function MyResults() {
  const [results, setResults] = useState<ResultData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getMyResults();
        setResults(data as unknown as ResultData[]);
      } catch (e: any) {
        setError(e.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loading fullPage message="Загрузка результатов..." data-testid="loading" />;
  if (error) return <ErrorBanner message={error} data-testid="error-banner" />;
  if (results.length === 0) return <EmptyState title="Нет результатов" message="У вас пока нет результатов тестов" data-testid="empty-state" />;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="my-results" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 style={{ color: 'var(--tg-text-color)', margin: 0 }}>Мои результаты</h2>
      {results.map((r) => (
        <Card key={r.id} data-testid="result-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: 'var(--tg-text-color)' }}>{r.test_subject}</h4>
              <p style={{ margin: 0, color: 'var(--tg-hint-color)', fontSize: 'var(--font-sm)' }}>
                {formatDate(r.test_datetime)}
              </p>
              {r.comment && (
                <p style={{ margin: '4px 0 0 0', color: 'var(--tg-hint-color)', fontSize: 'var(--font-sm)', fontStyle: 'italic' }}>
                  «{r.comment}»
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '24px' }}>{getScoreLabel(r.score, r.max_score)}</span>
              <p style={{ margin: 0, color: getScoreColor(r.score, r.max_score), fontWeight: 'bold', fontSize: 'var(--font-lg)' }}>
                {r.score} / {r.max_score}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
