import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  'data-testid'?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onClick,
  className = '',
  'data-testid': dataTestId,
}) => {
  const isClickable = !!onClick;

  const classNames = [
    styles.card,
    isClickable ? styles.clickable : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classNames}
      onClick={onClick}
      data-testid={dataTestId}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
};

export default Card;
