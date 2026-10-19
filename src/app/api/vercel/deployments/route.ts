import {NextRequest,NextResponse} from 'next/server';
import {configured,supabase} from '@/lib/supabase/server';
import {deployAccess,deploySettings,deployRequest,DeployError,vercelClient} from '@/lib/vercel-deploy';
export const maxDuration=60;
// A POC allowance per warm instance; provider account quotas still apply.
const starts=new Map<string,{time:number;day:number;count:number}>();
export async function POST(request:NextRequest){
    if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Invalid request origin.'},{status:403});
    if(!configured())return NextResponse.json({error:'Configure Supabase first.'},{status:503});
    const settings=deploySettings();
    if(!settings)return NextResponse.json({error:'Configure the Vercel deployment token, target project ID, and allowed operator emails on the server.'},{status:503});
    try{
        const db=await supabase();const {data:{user}}=await db.auth.getUser();
        if(!user)return NextResponse.json({error:'Sign in to deploy.'},{status:401});
        if(!deployAccess(user.email,!!user.email_confirmed_at,settings))return NextResponse.json({error:'Your account is not an allowed deployment operator.'},{status:403});
        const raw=await request.text();if(raw.length>8000)return NextResponse.json({error:'Request too large.'},{status:413});
        let body:unknown;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request JSON.'},{status:400});}
        const parsed=deployRequest.safeParse(body);if(!parsed.success)return NextResponse.json({error:'Invalid deployment request.'},{status:400});
        const input=parsed.data;
        const {data:release}=await db.from('releases').select('id').eq('id',input.release_id).single();
        if(!release)return NextResponse.json({error:'Release not found.'},{status:404});
        const identity={release_id:input.release_id,revision:input.revision,suite_revision:input.suite_revision,owner_id:user.id};
        const client=vercelClient(settings);
        if(input.action==='status')return NextResponse.json(await client.status(input.deployment_id,identity));
        const now=Date.now(),day=Math.floor(now/86400000),prior=starts.get(user.id);
        if(prior&&(now-prior.time<15000||(prior.day===day&&prior.count>=24)))return NextResponse.json({error:'Wait 15 seconds between deployments. The allowance is 24 deployments per operator per server instance per day.'},{status:429});
        // Reserve before the provider request so double clicks and failed attempts consume allowance.
        if(starts.size>=1000)for(const [id,value] of starts)if(value.day!==day)starts.delete(id);
        if(starts.size>=1000&&!prior)return NextResponse.json({error:'Deployment service is busy. Try again later.'},{status:429});
        starts.set(user.id,{time:now,day,count:prior?.day===day?prior.count+1:1});
        return NextResponse.json(await client.start(input.environment,identity,input.predecessor_id));
    }catch(error){
        if(error instanceof DeployError)return NextResponse.json({error:error.message},{status:error.status});
        return NextResponse.json({error:'Could not reach the deployment provider. Check Vercel before retrying: a build may already have started.'},{status:502});
    }
}
