'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { publicApiUrl } from '../lib/api';

function sendEvent(event) {
  try {
    const endpoint = publicApiUrl('analytics/events');
    const body = JSON.stringify(event);
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.(endpoint, blob)) return;
    void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    // Analytics must never block navigation or page rendering.
  }
}

export default function AnalyticsTracker({ type = 'page_view', propertyId }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin') || pathname.startsWith('/api') || pathname.startsWith('/uploads')) return;
    sendEvent({ type, path: pathname, ...(propertyId ? { propertyId } : {}) });
  }, [pathname, propertyId, type]);

  return null;
}
