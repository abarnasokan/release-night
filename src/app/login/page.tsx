import Link from 'next/link';
import { Moon, Check } from 'lucide-react';
import { AuthForm } from '@/components/forms';
import { configured } from '@/lib/supabase/server';
export default async function Login({ searchParams }: {
    searchParams: Promise<{
        error?: string;
    }>;
}) { const { error } = await searchParams; return <main className="login-page"><section className="login-story"><Link className="brand" href="/"><span className="brand-icon"><Moon size={21}/></span>release night<span className="brand-dot">.</span></Link><div><span className="eyebrow">KNOW WHAT’S LEFT. SHIP WHAT’S READY.</span><h1>A calmer night.<br />A clearer release.</h1><p>One place for your checks, your evidence,<br />and the decision to ship.</p><div className="story-check"><Check size={16}/> Every blocker has a name.</div><div className="story-check"><Check size={16}/> Every result belongs to a version.</div><div className="story-check"><Check size={16}/> Every shipped release keeps its record.</div></div><small>MADE FOR INDEPENDENT DEVELOPERS & SMALL TEAMS</small></section><section className="login-form"><div className="login-card"><span className="eyebrow">YOUR NEXT RELEASE STARTS HERE</span><h2>Welcome to your workspace.</h2><p>A few checks away from a confident decision.</p><AuthForm setup={!configured()} error={error}/></div></section></main>; }
