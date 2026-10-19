import { notFound, redirect } from 'next/navigation';
import { Shell } from '@/components/shell';
import {deployAccess,deploySettings} from '@/lib/vercel-deploy';
import { DemoWorkspace } from '@/components/demo-workspace';
import { configured, supabase } from '@/lib/supabase/server';
import type { Release } from '@/lib/domain/readiness';
export default async function ReleasePage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{tab?:string}>}) {
    if (!configured()) redirect('/releases');
    const db=await supabase();
    const {data:{user}}=await db.auth.getUser();
    if (!user) redirect('/login');
    const {id}=await params;
    const {data,error}=await db.from('releases').select('*').eq('id',id).single();
    if(error||!data)notFound();
    const query=await searchParams;
    const settings=deploySettings();
    const deploymentAccess=deployAccess(user.email,!!user.email_confirmed_at,settings);
    return <Shell email={user.email}><DemoWorkspace deploymentAccess={deploymentAccess} deploymentConfigured={!!settings} release={{...data,release_checks:[]} as Release} ownerId={user.id} initialTab={query.tab==='release'?'release':'checks'}/></Shell>;
}
