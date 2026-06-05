'use client';

import { useMemo, useState } from 'react';

const artifacts = [
  {
    key: 'book',
    title: 'Attendance book',
    caption: 'Roster page opened',
    cells: [
      '............',
      '..iiiiii....',
      '.ipppppii...',
      '.ipppppivi..',
      '.ipppppivi..',
      '.ipppppivi..',
      '.ipppppivi..',
      '..iiiiiiii..',
      '...i....i...',
      '............',
    ],
  },
  {
    key: 'pencil',
    title: 'Grade pencil',
    caption: 'Assessment mark drafted',
    cells: [
      '............',
      '.....gg.....',
      '....gyg.....',
      '...gyyg.....',
      '..gyyygk....',
      '.gyyyygkk...',
      '..gyygkk....',
      '...ggkk.....',
      '....kk......',
      '............',
    ],
  },
  {
    key: 'route',
    title: 'Route block',
    caption: 'Transport status checked',
    cells: [
      '............',
      '..ttttttt...',
      '.tiiiiit...',
      '.titttit...',
      '.tiiitit...',
      '.titttit...',
      '.tiiiiit...',
      '..ttttttt...',
      '...g..g.....',
      '............',
    ],
  },
];

const toneByCell = {
  g: 'gold',
  i: 'ink',
  k: 'graphite',
  p: 'paper',
  t: 'teal',
  v: 'violet',
  y: 'yellow',
};

export default function PixelCampusArtifact() {
  const [index, setIndex] = useState(0);
  const [touches, setTouches] = useState(0);
  const artifact = artifacts[index];
  const cells = useMemo(() => artifact.cells.join('').split(''), [artifact]);

  const advanceArtifact = () => {
    setIndex((current) => (current + 1) % artifacts.length);
    setTouches((current) => current + 1);
  };

  return (
    <button
      aria-label={`Activate pixel campus artifact. Current artifact: ${artifact.title}`}
      className="pixel-artifact-button"
      onClick={advanceArtifact}
      type="button"
    >
      <span className="pixel-artifact-meta">
        <strong>{artifact.title}</strong>
        <span aria-live="polite">{artifact.caption}</span>
      </span>
      <span
        aria-hidden="true"
        className="pixel-artifact-grid"
        data-artifact={artifact.key}
        key={`${artifact.key}-${touches}`}
      >
        {cells.map((cell, cellIndex) => (
          <span
            data-tone={toneByCell[cell] || 'empty'}
            key={`${artifact.key}-${cellIndex}`}
          />
        ))}
      </span>
      <span className="pixel-artifact-action">Switch object</span>
    </button>
  );
}
