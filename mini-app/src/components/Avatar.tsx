import React, { useState, useCallback } from 'react';
import styles from './Avatar.module.css';

interface AvatarProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

const Avatar = React.memo(function Avatar({ photoUrl, name, size = 40, className }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const handleError = useCallback(() => {
    setImgError(true);
  }, []);

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '';

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    minWidth: size,
    fontSize: size * 0.4,
  };

  if (photoUrl && !imgError) {
    return (
      <div className={`${styles.avatar} ${className || ''}`} style={containerStyle}>
        <img
          src={photoUrl}
          alt={name || 'Avatar'}
          className={styles.img}
          loading="lazy"
          onError={handleError}
        />
      </div>
    );
  }

  if (initials) {
    return (
      <div className={`${styles.avatar} ${styles.initials} ${className || ''}`} style={containerStyle}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`${styles.avatar} ${styles.placeholder} ${className || ''}`} style={containerStyle}>
      <span className="material-symbols-outlined" style={{ fontSize: size * 0.5 }}>person</span>
    </div>
  );
});

export default Avatar;
