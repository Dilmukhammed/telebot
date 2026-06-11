import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './Loading.module.css';

export interface LoadingProps {
  message?: string;
  'data-testid'?: string;
  fullPage?: boolean;
}

export const Loading = React.memo(function Loading({
  message,
  'data-testid': dataTestId,
  fullPage = false,
}: LoadingProps) {
  const { t } = useTranslation();
  const displayMessage = message || t('common.loading', 'Загрузка...');

  return (
    <div className={`${styles.container} ${fullPage ? styles.fullPage : ''}`} data-testid={dataTestId} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{displayMessage}</p>
    </div>
  );
});

export default Loading;
