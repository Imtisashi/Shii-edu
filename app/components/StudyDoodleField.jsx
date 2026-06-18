'use client';

const doodles = [
  { accent: '#4f46e5', delay: '-0.3s', duration: '7.2s', kind: 'notebook', rotate: '-8deg', size: '90px', x: '7%', y: '13%' },
  { accent: '#b45309', delay: '-2.2s', duration: '8.1s', kind: 'pencilTrail', rotate: '13deg', size: '78px', x: '82%', y: '10%' },
  { accent: '#0f766e', delay: '-1.4s', duration: '7.7s', kind: 'rulerCurve', rotate: '-18deg', size: '82px', x: '65%', y: '76%' },
  { accent: '#312e81', delay: '-3.1s', duration: '8.6s', kind: 'marginNote', rotate: '7deg', size: '72px', x: '18%', y: '74%' },
  { accent: '#7c2d12', delay: '-4s', duration: '9s', kind: 'countingBox', rotate: '-4deg', size: '68px', x: '92%', y: '48%' },
  { accent: '#0f766e', delay: '-2.8s', duration: '8.4s', kind: 'paperPlane', rotate: '10deg', size: '76px', x: '39%', y: '6%' },
  { accent: '#4f46e5', delay: '-1.1s', duration: '7.6s', kind: 'bookmarkStack', rotate: '6deg', size: '62px', x: '11%', y: '44%' },
  { accent: '#b45309', delay: '-5.2s', duration: '8.8s', kind: 'tinyPencil', rotate: '-20deg', size: '58px', x: '76%', y: '38%' },
];

function Sketch({ kind }) {
  const baseProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (kind === 'pencilTrail') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="4.5" d="M23 78 C37 61 51 48 69 31" />
        <path {...baseProps} strokeWidth="3" d="M69 31 L86 23 L79 40 Z" />
        <path {...baseProps} strokeWidth="3.5" d="M83 27 L93 17" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.52" d="M25 91 C43 84 50 101 67 91 C77 84 81 88 91 82" />
        <path {...baseProps} strokeWidth="2" opacity="0.34" d="M31 26 C42 18 53 19 62 26" />
      </svg>
    );
  }

  if (kind === 'rulerCurve') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="3" d="M21 76 C37 35 71 23 96 45 C77 53 57 64 42 91 C34 87 27 82 21 76 Z" />
        <path {...baseProps} strokeWidth="2.2" opacity="0.58" d="M42 61 L49 66 M52 49 L58 57 M64 40 L69 50 M78 38 L80 48" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.38" d="M26 96 C42 104 72 103 91 91" />
      </svg>
    );
  }

  if (kind === 'marginNote') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="3" d="M34 19 L83 25 C90 26 94 31 93 38 L86 89 C85 96 79 101 72 99 L29 91 C23 90 19 84 21 78 L27 28 C28 22 30 20 34 19 Z" />
        <path {...baseProps} strokeWidth="2.1" opacity="0.54" d="M38 42 L73 47 M35 57 L70 62 M33 72 L58 77" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.42" d="M84 24 C80 36 88 42 96 37" />
        <circle cx="38" cy="33" r="2.5" fill="currentColor" opacity="0.72" />
      </svg>
    );
  }

  if (kind === 'countingBox') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="3" d="M32 29 C47 22 70 22 87 30 C92 48 91 72 84 91 C64 97 43 94 27 86 C22 65 22 45 32 29 Z" />
        <path {...baseProps} strokeWidth="2.1" opacity="0.54" d="M42 42 L77 42 M40 56 L80 56 M39 70 L76 70" />
        <path {...baseProps} strokeWidth="2.1" opacity="0.54" d="M51 35 L48 82 M66 35 L65 84" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.5" d="M31 97 L47 102 M72 18 L86 13" />
      </svg>
    );
  }

  if (kind === 'paperPlane') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="3" d="M24 58 L95 28 L74 91 L58 66 L24 58 Z" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.62" d="M58 66 L95 28 M58 66 L48 86" />
        <path {...baseProps} strokeWidth="2" opacity="0.38" d="M20 83 C32 78 34 91 47 87 C58 84 59 94 72 90" />
      </svg>
    );
  }

  if (kind === 'bookmarkStack') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="3" d="M37 25h42c7 0 12 5 12 12v58L58 78 25 95V37c0-7 5-12 12-12Z" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.54" d="M44 43h30M44 56h22" />
        <path {...baseProps} strokeWidth="2.4" opacity="0.32" d="M31 101c18 8 42 8 59-1" />
      </svg>
    );
  }

  if (kind === 'tinyPencil') {
    return (
      <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
        <path {...baseProps} strokeWidth="4" d="M28 83 75 36l19 19-47 47-22 4 3-23Z" />
        <path {...baseProps} strokeWidth="2.6" opacity="0.55" d="M67 44 86 63 M34 87l15 15" />
        <path {...baseProps} strokeWidth="2.2" opacity="0.34" d="M21 28c14-8 27-8 39 0" />
      </svg>
    );
  }

  return (
    <svg className="study-doodle-sketch" viewBox="0 0 120 120" aria-hidden="true">
      <path {...baseProps} strokeWidth="3.2" d="M25 34 C35 27 50 28 61 36 C70 29 86 27 96 34 L96 88 C84 82 71 82 61 91 C49 82 37 82 25 88 Z" />
      <path {...baseProps} strokeWidth="2.2" opacity="0.58" d="M61 36 L61 91 M35 45 C43 42 50 43 55 48 M35 58 C44 55 51 57 56 62 M68 47 C75 43 84 43 90 47 M68 61 C75 58 83 58 90 62" />
      <path {...baseProps} strokeWidth="2.2" opacity="0.38" d="M22 98 C38 105 51 105 63 98 C77 105 91 104 102 96" />
    </svg>
  );
}

export default function StudyDoodleField({ className = '' }) {
  return (
    <div className={`study-doodle-field ${className}`.trim()} aria-hidden="true">
      {doodles.map(({ accent, delay, duration, kind, rotate, size, x, y }) => (
        <span
          className="study-doodle"
          data-sketch={kind}
          key={`${kind}-${x}-${y}`}
          style={{
            '--doodle-accent': accent,
            '--doodle-delay': delay,
            '--doodle-duration': duration,
            '--doodle-rotate': rotate,
            '--doodle-size': size,
            '--doodle-x': x,
            '--doodle-y': y,
          }}
        >
          <Sketch kind={kind} />
        </span>
      ))}
    </div>
  );
}
