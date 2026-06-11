import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './TimePicker.module.css';

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

type PickerMode = 'hours' | 'minutes';

export default function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('hours');
  const [tempHour, setTempHour] = useState('12');
  const [tempMinute, setTempMinute] = useState('00');

  // Parse time on open
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      setTempHour(h.padStart(2, '0'));
      setTempMinute(m.padStart(2, '0'));
    } else {
      const now = new Date();
      setTempHour(String(now.getHours()).padStart(2, '0'));
      setTempMinute(String(Math.round(now.getMinutes() / 5) * 5 % 60).padStart(2, '0'));
    }
  }, [value, isOpen]);

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    setMode('hours');
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleConfirm = () => {
    const timeString = `${tempHour}:${tempMinute}`;
    onChange(timeString);
    setIsOpen(false);
  };

  // Coordinates math
  const getCoordinates = (angleDegrees: number, radius: number) => {
    const angleRadians = ((angleDegrees - 90) * Math.PI) / 180;
    return {
      x: 100 + radius * Math.cos(angleRadians),
      y: 100 + radius * Math.sin(angleRadians),
    };
  };

  // Build hours lists (double ring: outer 1-12, inner 13-00)
  const outerHours = Array.from({ length: 12 }, (_, i) => {
    const val = i + 1; // 1 to 12
    const angle = val * 30;
    const { x, y } = getCoordinates(angle, 74);
    const label = String(val).padStart(2, '0');
    return { label, val, x, y };
  });

  const innerHours = Array.from({ length: 12 }, (_, i) => {
    const val = i === 11 ? 0 : i + 13; // 13 to 23, and 00
    const angle = (i + 1) * 30;
    const { x, y } = getCoordinates(angle, 46);
    const label = String(val).padStart(2, '0');
    return { label, val, x, y };
  });

  // Build minutes list (00, 05, 10, ..., 55)
  const minutesList = Array.from({ length: 12 }, (_, i) => {
    const val = i * 5;
    const angle = i * 30;
    const { x, y } = getCoordinates(angle, 74);
    const label = String(val).padStart(2, '0');
    return { label, val, x, y };
  });

  // Calculate clock hand coordinates
  let handX = 100;
  let handY = 100;
  let handRadius = 74;

  if (mode === 'hours') {
    const hVal = parseInt(tempHour, 10);
    const isInner = hVal === 0 || (hVal >= 13 && hVal <= 23);
    const angle = (isInner ? (hVal === 0 ? 12 : hVal - 12) : hVal) * 30;
    handRadius = isInner ? 46 : 74;
    const coords = getCoordinates(angle, handRadius);
    handX = coords.x;
    handY = coords.y;
  } else {
    const mVal = parseInt(tempMinute, 10);
    const angle = mVal * 6; // 360 / 60 = 6 degrees per minute
    const coords = getCoordinates(angle, 74);
    handX = coords.x;
    handY = coords.y;
  }

  // Handle direct adjustments
  const adjustTime = (type: 'hour' | 'minute', amount: number) => {
    if (type === 'hour') {
      let current = parseInt(tempHour, 10);
      let next = (current + amount + 24) % 24;
      setTempHour(String(next).padStart(2, '0'));
    } else {
      let current = parseInt(tempMinute, 10);
      let next = (current + amount + 60) % 60;
      setTempMinute(String(next).padStart(2, '0'));
    }
  };

  return (
    <>
      <div
        className={`${styles.trigger} ${className || ''} ${disabled ? styles.disabled : ''}`}
        onClick={handleOpen}
        role="button"
        tabIndex={disabled ? -1 : 0}
      >
        <span className={`${styles.valueText} ${!value ? styles.placeholderText : ''}`}>
          {value || '00:00'}
        </span>
        <span className={`material-symbols-outlined ${styles.icon}`}>schedule</span>
      </div>

      {isOpen && (
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.header}>
              <h3 className={styles.title}>{t('common.selectTime', 'Выберите время')}</h3>
              <button className={styles.closeBtn} onClick={handleClose}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Digital Display with Increments */}
            <div className={styles.digitalDisplay}>
              <div className={styles.timeValueWrapper}>
                <div className={styles.spinButtonWrapper}>
                  <button type="button" className={styles.spinBtn} onClick={() => adjustTime('hour', 1)}>
                    <span className="material-symbols-outlined">keyboard_arrow_up</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.timeNumber} ${mode === 'hours' ? styles.timeNumberActive : ''}`}
                    onClick={() => setMode('hours')}
                  >
                    {tempHour}
                  </button>
                  <button type="button" className={styles.spinBtn} onClick={() => adjustTime('hour', -1)}>
                    <span className="material-symbols-outlined">keyboard_arrow_down</span>
                  </button>
                </div>

                <span className={styles.timeSeparator}>:</span>

                <div className={styles.spinButtonWrapper}>
                  <button type="button" className={styles.spinBtn} onClick={() => adjustTime('minute', 1)}>
                    <span className="material-symbols-outlined">keyboard_arrow_up</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.timeNumber} ${mode === 'minutes' ? styles.timeNumberActive : ''}`}
                    onClick={() => setMode('minutes')}
                  >
                    {tempMinute}
                  </button>
                  <button type="button" className={styles.spinBtn} onClick={() => adjustTime('minute', -1)}>
                    <span className="material-symbols-outlined">keyboard_arrow_down</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Analog Clock Face */}
            <div className={styles.analogWrapper}>
              <div className={styles.clockFace}>
                {/* SVG for Clock Hand */}
                <svg className={styles.clockSvg} width="200" height="200">
                  <circle cx="100" cy="100" r="5" fill="var(--color-primary)" />
                  <line
                    x1="100"
                    y1="100"
                    x2={handX}
                    y2={handY}
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx={handX}
                    cy={handY}
                    r="16"
                    fill="var(--color-primary)"
                    className={styles.handCap}
                  />
                </svg>

                {/* Hour / Minutes labels positioning */}
                {mode === 'hours' ? (
                  <>
                    {/* Outer Ring (1-12) */}
                    {outerHours.map((item) => {
                      const isSelected = tempHour === item.label;
                      return (
                        <button
                          key={`out-${item.label}`}
                          type="button"
                          className={`${styles.clockLabel} ${styles.outerLabel} ${
                            isSelected ? styles.selectedLabel : ''
                          }`}
                          style={{ left: `${item.x}px`, top: `${item.y}px` }}
                          onClick={() => {
                            setTempHour(item.label);
                            setMode('minutes');
                          }}
                        >
                          {parseInt(item.label, 10)}
                        </button>
                      );
                    })}

                    {/* Inner Ring (13-00) */}
                    {innerHours.map((item) => {
                      const isSelected = tempHour === item.label;
                      return (
                        <button
                          key={`in-${item.label}`}
                          type="button"
                          className={`${styles.clockLabel} ${styles.innerLabel} ${
                            isSelected ? styles.selectedLabel : ''
                          }`}
                          style={{ left: `${item.x}px`, top: `${item.y}px` }}
                          onClick={() => {
                            setTempHour(item.label);
                            setMode('minutes');
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    {/* Minutes Ring */}
                    {minutesList.map((item) => {
                      const isSelected = tempMinute === item.label;
                      return (
                        <button
                          key={`min-${item.label}`}
                          type="button"
                          className={`${styles.clockLabel} ${styles.outerLabel} ${
                            isSelected ? styles.selectedLabel : ''
                          }`}
                          style={{ left: `${item.x}px`, top: `${item.y}px` }}
                          onClick={() => setTempMinute(item.label)}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                {t('common.cancel', 'Отмена')}
              </button>
              <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
                {t('common.confirm', 'Выбрать')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
