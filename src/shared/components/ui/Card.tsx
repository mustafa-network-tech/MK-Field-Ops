import type { ReactNode } from 'react';
import styles from './Card.module.css';

export function Card({ children, title, className = '' }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <div className={`${styles.card} ${className}`}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </div>
  );
}
