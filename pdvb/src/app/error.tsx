'use client';
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div className="rounded-xl bg-chili/10 p-10 text-center"><h1 className="text-2xl font-bold">Something went wrong</h1><p className="mt-1">Please try again. If it keeps happening, contact us.</p><button onClick={reset} className="btn-primary mt-4">Try again</button></div>;
}
