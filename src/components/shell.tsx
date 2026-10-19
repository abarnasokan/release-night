'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, Layers, ArrowUpRight, LogOut, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
export function Shell({ children, email, setup = false }: {
    children: React.ReactNode;
    email?: string;
    setup?: boolean;
}) {
    const path = usePathname(), router = useRouter();
    const [error, setError] = useState('');
    async function logout() { try {
        const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
        if (!r.ok)
            throw Error('Could not sign out. Retry.');
        router.push('/login');
        router.refresh();
    }
    catch (e) {
        setError((e as Error).message);
    } }
    return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/releases"><span className="brand-icon"><Moon size={20}/></span>release night<span className="brand-dot">.</span></Link><div className="workspace-label">YOUR WORKSPACE</div><Link className={`nav-item ${path.startsWith('/releases') ? 'active' : ''}`} href="/releases"><Layers size={17}/> Releases <span className="nav-arrow">↗</span></Link><div className="side-note"><ShieldCheck size={22}/><strong>A little certainty.<br />Before the big moment.</strong><p>Verify the details. Keep the evidence. Make the call.</p></div><div className="account"><span className="avatar">{email?.[0]?.toUpperCase() || 'R'}</span><div><strong>{email?.split('@')[0] || 'Your workspace'}</strong><small>{setup ? 'Setup mode' : 'Personal account'}</small></div>{email && <button className="icon-button" aria-label="Sign out" onClick={logout}><LogOut size={16}/></button>}</div>{error && <p role="alert" className="error">{error}</p>}</aside><main className="main"><div className="topbar"><span>Workspace <span className="slash">/</span> Releases</span><span className="topbar-note"><i /> All the details, accounted for <ArrowUpRight size={13}/></span>{email && <button className="mobile-logout text-button" onClick={logout}><LogOut size={13}/> Sign out</button>}</div>{setup && <div className="setup-banner">Setup required · Connect Supabase in <code>.env.local</code> and apply the migration to enable accounts and saved releases. <Link href="/login">Account setup →</Link></div>}<div className="page-content">{children}</div><footer>MADE FOR THE MOMENT BEFORE YOU SHIP.<span>Release Night <Moon size={12}/></span></footer></main></div>;
}
