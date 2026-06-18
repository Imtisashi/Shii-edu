type WordmarkProps = {
  className?: string;
  compact?: boolean;
};

export default function Wordmark({ className = '', compact = false }: WordmarkProps) {
  return (
    <span className={`tl-wordmark ${compact ? 'tl-wordmark-compact' : ''} ${className}`.trim()} aria-label="Shii-Edu">
      <span className="tl-wordmark-major">S</span>
      <span className="tl-wordmark-rest">HII-</span>
      <span className="tl-wordmark-major">E</span>
      <span className="tl-wordmark-rest">DU</span>
    </span>
  );
}
