'use client';

import { useEffect, useState } from 'react';
import { FileDown, Info } from 'lucide-react';

const apkFileName = (apkHref) => {
  if (!apkHref) return '';
  return apkHref.split('/').filter(Boolean).pop() || '';
};

export default function RoleInstallButton({ accent, active = true, apkHref, apkRole, label }) {
  const [apkState, setApkState] = useState({
    available: Boolean(apkHref),
    fileName: apkFileName(apkHref),
    href: apkHref,
    loading: false,
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!active || !apkRole || !apkHref) {
      setApkState({
        available: Boolean(apkHref),
        fileName: apkFileName(apkHref),
        href: apkHref,
        loading: false,
      });
      return () => {
        cancelled = true;
      };
    }

    setApkState((current) => ({ ...current, loading: true }));

    fetch(`/api/apk-status?role=${encodeURIComponent(apkRole)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.json().then((status) => ({ ok: response.ok, status })))
      .then(({ ok, status }) => {
        if (cancelled) return;
        const published = ok && status?.available && status?.href;
        setApkState({
          available: Boolean(published),
          fileName: status?.fileName || apkFileName(apkHref),
          href: status?.href || apkHref,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setApkState({
          available: Boolean(apkHref),
          fileName: apkFileName(apkHref),
          href: apkHref,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [active, apkHref, apkRole]);

  const handleApkDownload = (event) => {
    setNotice('');

    if (!apkHref || apkState.available === false) {
      event.preventDefault();
      setNotice(`${label} Android app is not published yet.`);
      return;
    }

    setNotice(`${label} Android app download is starting.`);
  };

  const disabled = apkState.available === false || !apkState.href;

  return (
    <div className="role-choice-install-wrap">
      <a
        aria-disabled={disabled}
        className={`role-choice-install role-choice-apk${disabled ? ' is-disabled' : ''}`}
        download={apkState.fileName || undefined}
        href={apkState.href || '#'}
        onClick={handleApkDownload}
        rel="noopener"
        style={{ '--role-accent': accent }}
        tabIndex={active ? 0 : -1}
      >
        <FileDown size={16} aria-hidden="true" />
        {apkState.loading ? 'Checking app' : 'Download Android app'}
      </a>
      {notice ? (
        <div className="role-choice-install-notice">
          <Info size={15} aria-hidden="true" />
          <span>{notice}</span>
        </div>
      ) : null}
    </div>
  );
}
