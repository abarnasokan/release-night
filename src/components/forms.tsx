'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, ArrowRight, LoaderCircle, Sparkles } from 'lucide-react';
export async function mutate(body: object) { const r = await fetch('/api/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok)
    throw Error(data.error || 'Unable to save. Retry.'); return data; }
export function CreateRelease({ disabled = false }: {
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const router = useRouter();
    async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError(''); try {
        const { id } = await mutate({ action: 'create', title: f.get('title'), version: f.get('version'), ai: false });
        router.push(`/releases/${id}`);
        router.refresh();
        setOpen(false);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <><button className="button primary" disabled={disabled} onClick={() => setOpen(true)}><Plus size={16}/> Create release</button>{open && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><button className="close icon-button" aria-label="Close" onClick={() => setOpen(false)}><X /></button><span className="eyebrow">A FRESH START</span><h2 id="create-title">Prepare your next release.</h2><p>Give this release a name and a version. Your workspace starts with 10 editable Python test templates.</p><form onSubmit={submit}><label>Release name<input autoFocus name="title" required maxLength={120} placeholder="Checkout improvements"/></label><label>Target version<input name="version" required maxLength={80} placeholder="v1.2.0-rc1"/></label>{error && <p className="error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <Plus size={16}/>} Create release</button></form></section></div>}</>;
}
export function AuthForm({ setup, error: initialError }: {
    setup: boolean;
    error?: string;
}) { const [signup, setSignup] = useState(false), [error, setError] = useState(initialError || ''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false); const router = useRouter(); return <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setBusy(true); setError(''); setMessage(''); try {
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: signup ? 'signup' : 'login', email: f.get('email'), password: f.get('password') }) });
    const d = await r.json();
    if (!r.ok)
        throw Error(d.error);
    if (d.confirmation)
        setMessage('Check your email to confirm your account, then sign in.');
    else {
        router.push('/releases');
        router.refresh();
    }
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><label>Email address<input autoComplete="email" name="email" type="email" required placeholder="you@example.com"/></label><label>Password<input autoComplete={signup ? 'new-password' : 'current-password'} name="password" type="password" minLength={8} maxLength={128} required placeholder="At least 8 characters"/></label>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}{setup && <p className="error">Connect Supabase in .env.local to enable authentication.</p>}<button className="button primary full" disabled={busy || setup}>{busy ? <LoaderCircle className="spin" size={16}/> : <ArrowRight size={16}/>} {signup ? 'Create account' : 'Sign in'}</button><button className="text-button auth-switch" type="button" onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Already have an account? Sign in' : 'New here? Create an account'}</button><div className="auth-foot"><Sparkles size={14}/> A clear path from “almost” to shipped.</div></form>; }
