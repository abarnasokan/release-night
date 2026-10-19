import {NextRequest,NextResponse} from 'next/server';
import {configured,supabase} from '@/lib/supabase/server';
import {demoJudgeInput,demoJudgeSchema,demoJudgePayload,scoreJudgment} from '@/lib/demo-judge';
export const maxDuration=40;
// Best-effort demo throttling per warm instance. Provider quotas still apply.
const usage=new Map<string,{last:number;count:number;day:number}>();
let globalDay=0,globalCount=0;
export async function POST(request:NextRequest){
    if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Invalid request origin'},{status:403});
    if(!configured())return NextResponse.json({error:'Sign in to request an AI judgment.'},{status:503});
    if(Number(request.headers.get('content-length')||0)>240000)return NextResponse.json({error:'The report is too large.'},{status:413});
    try{
        const raw=await request.text();if(raw.length>240000)return NextResponse.json({error:'The report is too large.'},{status:413});
        let body:unknown;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid report JSON.'},{status:400});}
        const parsed=demoJudgeInput.safeParse(body);if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});
        const db=await supabase();const {data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:'Sign in again to use the AI judge.'},{status:401});
        const {data:release}=await db.from('releases').select('id').eq('id',parsed.data.release_id).single();if(!release)return NextResponse.json({error:'Release not found.'},{status:404});
        if(!process.env.GROQ_API_KEY)return NextResponse.json({error:'Add GROQ_API_KEY on the server to enable the AI judge. Test results are still available.'},{status:503});
        const now=Date.now(),day=Math.floor(now/86400000),previous=usage.get(user.id);
        if(globalDay!==day){usage.clear();globalDay=day;globalCount=0;}
        if((previous&&now-previous.last<20000)||(previous?.day===day&&previous.count>=20)||globalCount>=100)return NextResponse.json({error:'AI judge allowance reached. Wait at least 20 seconds between requests; the allowance is 20 per user and 100 per server instance per day.'},{status:429});
        if(usage.size>=10000)return NextResponse.json({error:'The judge is busy. Try again later.'},{status:429});
        usage.set(user.id,{last:now,count:previous?.day===day?previous.count+1:1,day});globalCount++;
        const model=process.env.GROQ_MODEL||'openai/gpt-oss-20b';
        const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify(demoJudgePayload(parsed.data,model))});
        if(!response.ok)return NextResponse.json({error:'The AI provider could not complete this judgment. Your test results are unchanged.'},{status:502});
        const data=await response.json();const content=data.choices?.[0]?.message?.content;if(!content||data.choices?.[0]?.message?.refusal)return NextResponse.json({error:'The provider did not return a judgment.'},{status:502});
        const judgment=scoreJudgment(demoJudgeSchema.parse(JSON.parse(content)));
        return NextResponse.json({judgment,model,source:'llm',report_source:'simulated',advisory:true,reviewed_at:new Date().toISOString()});
    }catch{return NextResponse.json({error:'The AI judge timed out or returned an invalid response. Your test results are unchanged.'},{status:502});}
}
