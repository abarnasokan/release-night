import Link from 'next/link';
import {redirect} from 'next/navigation';
import {ArrowUpRight,GitBranch} from 'lucide-react';
import {Shell} from '@/components/shell';
import {CreateRelease} from '@/components/forms';
import {configured,supabase} from '@/lib/supabase/server';
import type {Release} from '@/lib/domain/readiness';
export default async function Releases(){
    const setup=!configured();let releases:Release[]=[],email:string|undefined,error='';
    if(!setup){
        const db=await supabase();const {data:{user}}=await db.auth.getUser();
        if(!user)redirect('/login');email=user.email;
        const result=await db.from('releases').select('*').order('created_at',{ascending:false}).limit(50);
        releases=(result.data||[]) as Release[];error=result.error?.message||'';
    }
    return <Shell email={email} setup={setup}><div className="page-heading"><div><span className="eyebrow">YOUR RELEASE WORKSPACE</span><h1>Your releases<span className="heading-dot">.</span></h1><p>Keep a clear record of the version you are preparing.</p></div><CreateRelease disabled={setup}/></div>{error&&<p role="alert" className="error panel">Could not load releases: {error}</p>}{releases.length?<div className="release-grid">{releases.map(release=><Link key={release.id} className="release-card" href={`/releases/${release.id}`}><div className="card-top"><span className={`badge ${release.lifecycle==='shipped'?'shipped':'preparing'}`}>{release.lifecycle==='shipped'?'Shipped':'Preparing'}</span><ArrowUpRight size={18}/></div><h3>{release.title}</h3><div className="version"><GitBranch size={15}/>{release.target_version}<span>Revision {release.revision}</span></div><div className="card-bottom"><span>Created {new Date(release.created_at).toLocaleDateString()}</span><span>View release →</span></div></Link>)}</div>:<div className="empty-state"><span className="empty-icon"><GitBranch size={26}/></span><h2>Your next release belongs here.</h2><p>Create a release and give it a target version.</p><CreateRelease disabled={setup}/></div>}</Shell>;
}
