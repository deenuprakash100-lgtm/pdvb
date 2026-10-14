'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** While an online payment is still being confirmed, refresh the server data a few times. */
export function StatusPoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const t = setInterval(() => { router.refresh(); if (++n >= 15) clearInterval(t); }, 4000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}
