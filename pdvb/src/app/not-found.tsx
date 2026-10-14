import Link from 'next/link';
export default function NotFound() {
  return <div className="rounded-xl bg-mist p-10 text-center"><h1 className="text-2xl font-bold">We could not find that page</h1><p className="mt-1 text-ink/70">The link may be old or incorrect.</p><Link href="/" className="btn-primary mt-4">Back to home</Link></div>;
}
