import React from 'react';
import styles from './Loading.module.css';

export interface LoadingProps {
  message?: string;
  'data-testid'?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Загрузка...',
  'data-testid': dataTestId,
}) => {
  return (
    <div className={styles.container} data-testid={dataTestId} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  );
};

export default Loading;
