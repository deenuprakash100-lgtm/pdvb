import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { resolveWhatsAppConfig } from '@/lib/notify';
import { addZone, saveSettingsAction } from '../actions';
import { SETTING_FIELDS } from './fields';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ searchParams }: { searchParams: { saved?: string; error?: string } }) {
  await requireRole(['ADMIN']);
  const [s, zones] = await Promise.all([getSettings(), db.deliveryZone.findMany({ orderBy: { pincode: 'asc' } })]);
  const wa = resolveWhatsAppConfig(s);
  const groups = Array.from(new Set(SETTING_FIELDS.map((f) => f.group)));
  const val = (k: string) => (s as unknown as Record<string, unknown>)[k];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      {searchParams.saved && <p role="status" className="rounded-lg bg-leaf/10 p-3 text-sm text-leaf">Saved.</p>}
      {searchParams.error === 'pin' && <p role="alert" className="rounded-lg bg-chili/10 p-3 text-sm text-chili">Enter a 6-digit PIN code.</p>}
      <p className={`rounded-lg p-3 text-sm ${wa.mode === 'live' ? 'bg-leaf/10' : 'bg-saffron/20'}`}>WhatsApp order alerts: <strong>{wa.mode === 'live' ? 'LIVE (messages are sent through the WhatsApp Business API)' : `DEMO (nothing is sent): ${wa.reason}`}</strong></p>
      <form action={saveSettingsAction} className="space-y-6">
        {groups.map((g) => (
          <fieldset key={g} className="grid gap-3 rounded-xl border border-ink/10 bg-white p-4 sm:grid-cols-2"><legend className="px-1 font-display font-bold">{g}</legend>
            {SETTING_FIELDS.filter((f) => f.group === g).map((f) => {
              const v = val(f.key);
              return f.type === 'checkbox' ? (
                <label key={f.key} className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name={f.key} defaultChecked={!!v} className="mt-1" /><span>{f.label}{f.help && <span className="block text-xs text-ink/60">{f.help}</span>}</span></label>
              ) : (
                <div key={f.key}><label className="label" htmlFor={f.key}>{f.label}</label>
                  <input id={f.key} name={f.key} className="input" type={f.type === 'text' ? 'text' : 'number'} step={f.type === 'rupees' ? '0.01' : '1'} defaultValue={f.type === 'rupees' ? (v === null || v === undefined ? '' : Number(v) / 100) : String(v ?? '')} />
                  {f.help && <p className="mt-1 text-xs text-ink/60">{f.help}</p>}</div>);
            })}
          </fieldset>))}
        <button className="btn-primary">Save settings</button>
      </form>
      <section className="rounded-xl border border-ink/10 bg-white p-4"><h2 className="mb-2 font-display text-lg font-bold">Serviceable PIN codes</h2>
        <p className="mb-2 flex flex-wrap gap-2 text-sm">{zones.map((z) => <span key={z.id} className="rounded bg-mist px-2 py-1">{z.pincode}</span>)}</p>
        <form action={addZone} className="flex gap-2"><input name="pincode" placeholder="6-digit PIN" inputMode="numeric" className="input max-w-[10rem]" aria-label="PIN code" /><button className="btn-ghost">Add PIN code</button></form></section>
    </div>
  );
}
