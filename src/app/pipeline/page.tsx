import {redirect} from 'next/navigation';
import {Shell} from '@/components/shell';
import {DemoDashboard} from '@/components/demo-workspace';
import {configured,supabase} from '@/lib/supabase/server';
import type {Release} from '@/lib/domain/readiness';
export default async function Page(){
    if(!configured())return <Shell setup><p className="error panel">Connect Supabase to create an account and save releases.</p></Shell>;
    const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/login');
    const {data,error}=await db.from('releases').select('*').order('created_at',{ascending:false}).limit(50);
    return <Shell email={user.email}>{error&&<p role="alert" className="error panel">{error.message}</p>}<DemoDashboard releases={(data||[]).map(r=>({...r,release_checks:[]})) as Release[]} ownerId={user.id} pipeline={true}/></Shell>;
}
