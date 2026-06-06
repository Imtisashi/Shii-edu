'use client';

import { LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AnimatedSignInLink({ className = 'landing-login', href = '/roles' }) {
  const router = useRouter();

  const handleClick = (event) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        router.push(href);
      });
      return;
    }

    router.push(href);
  };

  return (
    <a className={className} href={href} onClick={handleClick}>
      <LockKeyhole size={16} aria-hidden="true" />
      Login
    </a>
  );
}
