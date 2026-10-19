import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {ArrowLeft,GitBranch,Lock} from 'lucide-react';
import {Shell} from '@/components/shell';
import {configured,supabase} from '@/lib/supabase/server';
import type {Release} from '@/lib/domain/readiness';
export default async function ReleasePage({params}:{params:Promise<{id:string}>}){
    if(!configured())redirect('/releases');
    const db=await supabase();const {data:{user}}=await db.auth.getUser();
    if(!user)redirect('/login');
    const {id}=await params;
    const {data,error}=await db.from('releases').select('*,release_checks(*)').eq('id',id).single();
    if(error||!data)notFound();const release=data as Release;
    return <Shell email={user.email}><Link className="back-link" href="/releases"><ArrowLeft size={15}/> All releases</Link><div className="page-heading"><div><span className="eyebrow">RELEASE DETAILS</span><h1>{release.title}</h1><div className="version"><GitBranch size={15}/>{release.target_version}<span>Revision {release.revision}</span><span className="badge">{release.lifecycle==='shipped'?'Shipped':'Preparing'}</span></div></div></div><div className="panel readiness-panel"><h2>Versioned and private.</h2><p>This release belongs to your account. Its target version is {release.target_version}.</p><small><Lock size={13}/> Created {new Date(release.created_at).toLocaleString()}</small></div><section className="release-section"><div className="section-heading"><div><h2>Verification checks <span className="count">{release.release_checks.length}</span></h2><p>Checks and results are associated with the release revision.</p></div></div>{release.release_checks.length?release.release_checks.map(check=><article key={check.id} className="check-card panel"><header><div><h3>{check.name}</h3><span className="check-meta">{check.required?'Required':'Optional'}</span></div><span className={`badge ${check.result}`}>{check.result}</span></header>{check.evidence_text&&<p>{check.evidence_text}</p>}</article>):<div className="panel empty-checks"><h3>No checks yet.</h3><p>Your release is ready for its verification workflow.</p></div>}</section></Shell>;
}
