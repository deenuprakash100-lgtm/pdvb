import { getSettings } from '@/lib/settings';

export const metadata = { title: 'About us' };

export default async function About() {
  const s = await getSettings();
  return (
    <div className="max-w-prose space-y-3">
      <h1 className="text-3xl font-bold">About {s.businessName}</h1>
      <p>{s.businessName} brings food, groceries, vegetables, chicken and meat from local businesses to homes in {s.serviceArea}.</p>
      <p>Edit this page text in <code>src/app/about/page.tsx</code> to describe your business.</p>
    </div>
  );
}
