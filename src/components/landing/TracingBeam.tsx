import type { ReactNode } from 'react';

type TracingBeamProps = {
  children: ReactNode;
};

export default function TracingBeam({ children }: TracingBeamProps) {
  return (
    <div className="tl-tracing-shell">
      <div className="tl-tracing-beam" aria-hidden="true">
        <span />
      </div>
      <div className="tl-tracing-content">{children}</div>
    </div>
  );
}
