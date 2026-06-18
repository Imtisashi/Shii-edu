'use client';

import type { CSSProperties } from 'react';

type BackgroundLinesProps = {
  className?: string;
};

const lineCount = 12;

export default function BackgroundLines({ className = '' }: BackgroundLinesProps) {
  return (
    <div className={`tl-background-lines ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lineCount }, (_, index) => (
        <span key={index} style={{ '--line-index': index } as CSSProperties & { '--line-index': number }} />
      ))}
    </div>
  );
}
