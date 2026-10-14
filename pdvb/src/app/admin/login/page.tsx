import { loginAction } from '../actions';

export const metadata = { title: 'Admin login' };

export default function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <form action={loginAction} className="mx-auto max-w-sm space-y-3 rounded-xl border border-ink/10 bg-white p-6">
      <h1 className="text-2xl font-bold">Admin login</h1>
      {searchParams.error === 'invalid' && <p role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">Email or password is incorrect.</p>}
      {searchParams.error === 'rate' && <p role="alert" className="rounded-lg bg-chili/10 p-2 text-sm text-chili">Too many attempts. Try again in 15 minutes.</p>}
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="username" className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
      <button className="btn-primary w-full">Sign in</button>
    </form>
  );
}
