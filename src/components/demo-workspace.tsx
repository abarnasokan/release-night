'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Check as CheckIcon,Code,GitBranch,LoaderCircle,Play,Plus,Rocket,RotateCcw,Sparkles} from 'lucide-react';
import type {Check,Release} from '@/lib/domain/readiness';
import {ENVIRONMENTS,type Environment} from '@/lib/domain/pipeline';
import {canDeploy,deploymentReady,deploymentVerified,latestDeployment,latestRun,verification} from '@/lib/domain/verification';
import {demoStorageKey,initialDemo,saveDemoCheck,simulateDemoRuns,type DemoState,type DemoRun} from '@/lib/domain/demo';
import {suiteReviewInput,suiteReviewKey} from '@/lib/domain/suite-review';
import type {DemoJudgment} from '@/lib/demo-judge';
import type {VercelJob} from '@/lib/vercel-deploy';
import {postJson} from '@/lib/client-api';
import {CreateRelease} from './forms';

type Judgment={judgment:DemoJudgment;model:string;source:'llm';report_source:'simulated';reviewed_at:string};
type StoredDemo=DemoState&{judgments?:Record<string,unknown>;suiteJudgments?:Record<string,Judgment>};
function readDemo(key:string,seed:DemoState):StoredDemo {
    try{const raw=localStorage.getItem(key);if(raw){const value=JSON.parse(raw);if(value.format===1&&value.release?.id===seed.release.id&&Array.isArray(value.release.release_checks)&&Array.isArray(value.deployments)&&Array.isArray(value.runs))return value;}}catch{/* A corrupt or unavailable browser store starts a clean demo. */}
    return seed;
}
export function DemoBanner(){return <p className="execution-notice" role="note">Python checks return sample passing results; scripts are not executed.</p>;}
export function DemoWorkspace({release,ownerId,initialTab='checks',deploymentAccess=false,deploymentConfigured=false}:{release:Release;ownerId:string;initialTab?:'checks'|'release';deploymentAccess?:boolean;deploymentConfigured?:boolean}){
    const seed=initialDemo(release),storage=demoStorageKey(ownerId,release.id);
    const [state,setState]=useState<StoredDemo>(seed),[loaded,setLoaded]=useState(false),[storageError,setStorageError]=useState(false);
    const [tab,setTab]=useState(initialTab),[environment,setEnvironment]=useState<Environment>('dev'),[busy,setBusy]=useState(false),[judging,setJudging]=useState<string|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
    const [newName,setNewName]=useState(''),[version,setVersion]=useState(release.target_version),[dirtyChecks,setDirtyChecks]=useState<Set<string>>(new Set()),[editorEpoch,setEditorEpoch]=useState(0);
    useEffect(()=>{const saved=readDemo(storage,initialDemo(release));saved.deployments=saved.deployments.filter(d=>d.config?.provider==='vercel');saved.runs=saved.runs.filter(r=>saved.deployments.some(d=>d.id===r.deployment_id));setState(saved);setVersion(saved.release.target_version);setLoaded(true);},[storage]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(()=>{if(!loaded)return;try{localStorage.setItem(storage,JSON.stringify(state));setStorageError(false);}catch{setStorageError(true);}},[state,storage,loaded]);
    const locked=state.release.lifecycle==='shipped';
    const deployment=latestDeployment(state.deployments,state.release,environment);
    const result=verification(state.release,deployment,state.runs);
    const prod=latestDeployment(state.deployments,state.release,'prod');
    const finishable=deploymentVerified(state.release,prod,state.deployments,state.runs);
    const [starting,setStarting]=useState<Environment|null>(null),[pollRetry,setPollRetry]=useState(0),[pollPaused,setPollPaused]=useState(false);
    const pending=state.deployments.find(d=>d.revision===state.release.revision&&d.config?.provider==='vercel'&&!['READY','ERROR','CANCELED'].includes(String(d.config.status)));
    const deploying=!!starting||!!pending;
    function updateJob(job:VercelJob){setState(previous=>({...previous,deployments:previous.deployments.map(d=>d.id===job.id?{...d,base_url:job.url,deployment_ref:job.commit?.slice(0,8)||job.id,config:{...d.config,status:job.state,commit:job.commit,project:job.project}}:d)}));}
    useEffect(()=>{
        if(!loaded||!pending||!deploymentAccess)return;
        let canceled=false;let timer:ReturnType<typeof setTimeout>;const deadline=Date.now()+600000;
        setPollPaused(false);
        async function poll(){
            try{
                const job=await postJson('/api/vercel/deployments',{action:'status',release_id:state.release.id,revision:pending!.revision,suite_revision:Number(pending!.config.suite_revision),deployment_id:pending!.id}) as VercelJob;
                if(canceled)return;updateJob(job);
                if(job.state==='READY'){setMessage(`${job.environment.toUpperCase()} deployment is ready. You can run its tests.`);return;}
                if(['ERROR','CANCELED'].includes(job.state)){setError(`The ${job.environment} deployment ${job.state==='ERROR'?'failed':'was canceled'}. Check its build logs in Vercel, then redeploy.`);return;}
                if(Date.now()>deadline){setPollPaused(true);setError('The build is still pending. Check Vercel or refresh its status here.');return;}
                timer=setTimeout(()=>void poll(),4000);
            }catch(e){if(!canceled){setPollPaused(true);setError((e as Error).message);}}
        }
        void poll();return ()=>{canceled=true;clearTimeout(timer);};
    },[loaded,pending?.id,pollRetry,deploymentAccess]); // eslint-disable-line react-hooks/exhaustive-deps
    async function deploy(env:Environment){
        if(starting||pending)return;setStarting(env);setError('');setMessage('');
        try{
            if(!canDeploy(state.release,env,state.deployments,state.runs))throw Error('Pass the preceding environment’s required tests first.');
            const previous=env==='staging'?'dev':env==='prod'?'staging':null;
            const predecessor=previous?latestDeployment(state.deployments,state.release,previous):undefined;
            const job=await postJson('/api/vercel/deployments',{action:'start',release_id:state.release.id,revision:state.release.revision,suite_revision:state.release.suite_revision??1,environment:env,predecessor_id:predecessor?.id??null}) as VercelJob;
            setState(current=>({...current,deployments:[{id:job.id,release_id:current.release.id,revision:current.release.revision,environment:env,deployment_ref:job.commit?.slice(0,8)||job.id,base_url:job.url,predecessor_id:predecessor?.id??null,deployed_at:job.created_at,config:{provider:'vercel',status:job.state,commit:job.commit,project:job.project,suite_revision:current.release.suite_revision??1}},...current.deployments]}));
            setEnvironment(env);setMessage(`Vercel deployment ${job.id} ${job.state==='READY'?'is ready.':'has started.'}`);
        }catch(e){setError((e as Error).message);}finally{setStarting(null);}
    }
    async function simulate(checkId?:string){if(deploying)return;setBusy(true);setError('');setMessage('');await new Promise(resolve=>setTimeout(resolve,500));try{const simulated=simulateDemoRuns(state,environment,()=>crypto.randomUUID(),new Date().toISOString(),checkId);setState(previous=>({...simulated,judgments:previous.judgments,suiteJudgments:previous.suiteJudgments}));setMessage('All selected tests passed. You can review their reports with the AI judge.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
    const reviewKey=suiteReviewKey(state,environment);
    const suiteJudgment=dirtyChecks.size===0?state.suiteJudgments?.[reviewKey]:undefined;
    const enabledTests=state.release.release_checks.filter(c=>c.enabled!==false);
    const completedTests=enabledTests.filter(c=>deployment&&latestRun(state.runs,deployment.id,c.id,state.release.suite_revision??1)?.status==='passed').length;
    const hasResults=enabledTests.some(c=>deployment&&latestRun(state.runs,deployment.id,c.id,state.release.suite_revision??1));
    async function judgeSuite(){
        setJudging(reviewKey);setError('');
        try{
            const input=suiteReviewInput(state,environment);
            const response=await postJson('/api/demo/judge',input) as Judgment;
            setState(previous=>({...previous,suiteJudgments:{...previous.suiteJudgments,[reviewKey]:response}}));
        }catch(e){setError((e as Error).message);}finally{setJudging(null);}
    }
    return <><Link className="back-link" href="/releases"><ArrowLeft size={15}/> All releases</Link><DemoBanner/>
        <div className="page-heading"><div><span className="eyebrow">DEPLOY · TEST · REVIEW</span><h1>{state.release.title}</h1><div className="version"><GitBranch size={15}/>{state.release.target_version}<span>Revision {state.release.revision} · Suite {state.release.suite_revision}</span><span className="badge">{locked?'Shipped':'Preparing'}</span></div></div><button className="button secondary" disabled={!loaded||busy||deploying||!!judging} onClick={()=>{setState(initialDemo(release));setDirtyChecks(new Set());setEditorEpoch(x=>x+1);setVersion(release.target_version);setMessage('Workspace reset.');setError('');}}><RotateCcw size={15}/> Reset workspace</button></div>
        {storageError&&<p role="alert" className="error panel">Browser storage is unavailable or full. Progress may be lost on refresh.</p>}
        <p className="pipeline-hint">Deploys the simple-app GitHub source to one Vercel project across Dev, Staging, and Production. Progress, scripts, and AI reviews are saved in this browser.</p>
        {!deploymentConfigured&&<p className="error panel">Connect Vercel on the server to enable deployment buttons. Set the deployment token, target project ID, and allowed operator emails.</p>}
        {deploymentConfigured&&!deploymentAccess&&<p className="pipeline-hint">Deployments are restricted to configured operators with confirmed email addresses.</p>}
        {pending&&<div className="panel deployment-progress" role="status"><LoaderCircle size={18} className="spin"/><span>{pending.environment.toUpperCase()} · {String(pending.config.status)} · {pending.id}</span>{pollPaused&&<button className="button secondary" onClick={()=>{setError('');setPollRetry(x=>x+1);}}>Refresh deployment status</button>}</div>}
        {error&&<p role="alert" className="error panel">{error}</p>}{message&&<p role="status" className="success panel">{message}</p>}
        <div className="workspace-tabs" role="tablist" aria-label="Release workspace"><button role="tab" id="demo-checks-tab" aria-selected={tab==='checks'} aria-controls="demo-checks" onClick={()=>setTab('checks')}><Code size={16}/> Tests & AI judge</button><button role="tab" id="demo-release-tab" aria-selected={tab==='release'} aria-controls="demo-release" onClick={()=>setTab('release')}><Rocket size={16}/> Release</button></div>
        <div id="demo-release" role="tabpanel" aria-labelledby="demo-release-tab" hidden={tab!=='release'}><div className="section-heading"><div><h2>Release pipeline</h2><p>Passing tests unlock the next environment.</p></div></div><div className="environment-flow">{ENVIRONMENTS.map((env,index)=>{
            const d=latestDeployment(state.deployments,state.release,env.id),v=verification(state.release,d,state.runs),passed=deploymentVerified(state.release,d,state.deployments,state.runs),available=canDeploy(state.release,env.id,state.deployments,state.runs);
            return <article key={env.id} className={`environment-card ${passed?'recorded':available?'available':'locked'}`}><div className="environment-top"><span className="environment-number">0{index+1}</span><span className={`badge ${passed?'passed':'pending'}`}>{passed?'Passed':d?(d.config.status==='READY'?'Ready for tests':String(d.config.status)):available?'Ready to deploy':'Locked'}</span></div><div className="environment-symbol">{passed?<CheckIcon size={24}/>:<Rocket size={24}/>}</div><h3>{env.label}</h3><p>{index?`Pass ${ENVIRONMENTS[index-1].label}'s tests to unlock this stage.`:'Start here, then run the suite before promoting to Staging.'}</p>{d&&<><strong className="environment-release">{d.deployment_ref.replace(/^demo-/,'')}</strong><small>{v.passed}/{v.total} required tests passed</small><a className="text-button" href={d.base_url} target="_blank" rel="noopener noreferrer">Open deployed app ↗</a><button className="button secondary full" onClick={()=>{setEnvironment(env.id);setTab('checks');}}>View tests & judge</button></>}<button className="button primary full" disabled={!loaded||!available||busy||deploying||!deploymentAccess||dirtyChecks.size>0} onClick={()=>void deploy(env.id)}>{starting===env.id?'Starting…':pending?.environment===env.id?'Deploying…':d?'Redeploy':'Deploy'}</button></article>;
        })}</div><div className="panel final-ship"><div><h3>Finish this release</h3><p>Available when Production’s suite passes.</p></div><button className="button primary" disabled={!finishable||locked||busy||deploying||dirtyChecks.size>0} onClick={()=>{setState(previous=>({...previous,release:{...previous.release,lifecycle:'shipped',shipped_at:new Date().toISOString()}}));setMessage('Release marked shipped.');}}>Mark release shipped</button></div>
            {!locked&&<form className="demo-version panel" onSubmit={e=>{e.preventDefault();if(version.trim()===state.release.target_version)return;setState(previous=>({...previous,release:{...previous.release,target_version:version.trim(),revision:previous.release.revision+1}}));setMessage('New revision created. Start again in Dev.');}}><label>Try another release version<input disabled={deploying} value={version} onChange={e=>setVersion(e.target.value)} required maxLength={80}/></label><button className="button secondary" disabled={busy||deploying||!loaded||dirtyChecks.size>0}>Change version</button></form>}
            <div className="panel promotion-history"><h3>Deployment history</h3>{state.deployments.length?<ol>{state.deployments.map(d=><li key={d.id}><span className="history-dot"/><div><strong>{d.environment} · {d.deployment_ref.replace(/^demo-/,'')}</strong><p>Revision {d.revision} · {new Date(d.deployed_at).toLocaleString()}</p></div></li>)}</ol>:<p>No deployments yet.</p>}</div>
        </div>
        <div id="demo-checks" role="tabpanel" aria-labelledby="demo-checks-tab" hidden={tab!=='checks'}><div className="environment-picker">{ENVIRONMENTS.map(env=><button key={env.id} className={`button ${environment===env.id?'primary':'secondary'}`} onClick={()=>setEnvironment(env.id)}>{env.label}</button>)}</div><div className="test-target panel"><div><strong>{deployment?`${environment} · ${deployment.deployment_ref.replace(/^demo-/,'')}`:'Deploy to an environment first'}</strong><p>{deployment&&!deploymentReady(deployment)?`Vercel status: ${String(deployment.config.status)}`:deployment?`${result.passed}/${result.total} required tests passed`:'Open Release and deploy to Development.'}</p></div><div className="test-toolbar"><button className="button secondary" onClick={()=>setTab('release')}>View pipeline</button><button className="button primary" disabled={!loaded||!deploymentReady(deployment)||busy||deploying||locked||dirtyChecks.size>0||!state.release.release_checks.some(c=>c.enabled!==false)} onClick={()=>void simulate()}>{busy?<LoaderCircle size={15} className="spin"/>:<Play size={15}/>} {busy?'Running…':'Run suite'}</button><button className="button primary" disabled={!loaded||!hasResults||busy||deploying||!!judging||dirtyChecks.size>0} onClick={()=>void judgeSuite()}>{judging?<LoaderCircle size={15} className="spin"/>:<Sparkles size={15}/>} {judging?'Reviewing suite…':'LLM as judge'}</button></div></div>
            {dirtyChecks.size>0&&<p className="pipeline-hint">Save or discard test edits before running tests or deploying.</p>}{result.total===0&&<p className="pipeline-hint">Enable at least one required test to unlock the next environment.</p>}
            <div className="panel suite-assessment"><div className="section-heading"><div><h2>Overall assessment</h2><p>{completedTests} of {enabledTests.length} enabled tests have passing results in {ENVIRONMENTS.find(e=>e.id===environment)?.label}. The judge includes missing results in its review.</p></div>{suiteJudgment&&<div className="overall-score" aria-label={`Overall score ${suiteJudgment.judgment.overallScore} out of 100`}><strong>{suiteJudgment.judgment.overallScore}</strong><span>/ 100</span></div>}</div>{suiteJudgment?<SuiteAssessment judgment={suiteJudgment}/>:<p className="pipeline-hint">Run tests, then request one review of the entire suite for this environment. You’ll receive an overall score, strengths, gaps, and next steps.</p>}<small>Review is advisory. Clicking the judge button sends all saved test results and script excerpts to Groq. Keep secrets out of scripts.</small></div>
            {state.release.release_checks.map(check=>{
                const run=deployment?latestRun(state.runs,deployment.id,check.id,state.release.suite_revision??1) as DemoRun|undefined:undefined;
                return <DemoCheck key={`${editorEpoch}-${check.id}`} check={check} locked={locked||!loaded||busy||deploying} run={run} canRun={deploymentReady(deployment)&&!deploying} onRun={()=>void simulate(check.id)} onSave={next=>setState(previous=>saveDemoCheck(previous,next))} onDirty={dirty=>setDirtyChecks(previous=>{const next=new Set(previous);if(dirty)next.add(check.id);else next.delete(check.id);return next;})}/>;
            })}
            {!locked&&<form className="panel demo-add" onSubmit={e=>{e.preventDefault();const name=newName.trim();if(!name)return;const check:Check={id:crypto.randomUUID(),name,script:'from sdk import result\n\n# Add your application-specific test here.\nresult("inconclusive", "Implement the real test before enabling worker mode.")\n',enabled:true,required:true,result:'pending',verified_revision:null,evidence_text:'',evidence_url:null,verified_at:null,updated_at:new Date().toISOString()};setState(previous=>({...previous,release:{...previous.release,suite_revision:(previous.release.suite_revision??1)+1,release_checks:[...previous.release.release_checks,check]}}));setNewName('');}}><label>Add a custom test<input value={newName} onChange={e=>setNewName(e.target.value)} required maxLength={160} placeholder="What should the user be able to do?"/></label><button className="button secondary" disabled={!loaded||busy||deploying||state.release.release_checks.length>=50}><Plus size={15}/> Add test</button></form>}
        </div>
    </>;
}
function DemoCheck({check,locked,run,canRun,onRun,onSave,onDirty}:{check:Check;locked:boolean;run?:DemoRun;canRun:boolean;onRun:()=>void;onSave:(check:Check)=>void;onDirty:(dirty:boolean)=>void}){
    const [draft,setDraft]=useState(check),[expanded,setExpanded]=useState(false);
    const dirty=draft.script!==check.script||draft.name!==check.name||draft.enabled!==check.enabled||draft.required!==check.required;
    useEffect(()=>{onDirty(dirty);},[dirty]); // eslint-disable-line react-hooks/exhaustive-deps
    return <article className={`check-card panel ${check.enabled===false?'check-disabled':''}`}><header><Code size={19}/><div><h3>{check.name}</h3><small>Python test</small></div><span className={`badge ${run&&!dirty?'passed':'pending'}`}>{dirty?'Unsaved':check.enabled===false?'Disabled':run?'Passed':'Not run'}</span></header><div className="check-enable-row"><label className="checkbox"><input type="checkbox" checked={draft.enabled!==false} disabled={locked} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>Enabled</label><label className="checkbox"><input type="checkbox" checked={draft.required} disabled={locked} onChange={e=>setDraft({...draft,required:e.target.checked})}/>Required to promote</label></div><button className="text-button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'Hide Python script':'Edit Python script'}</button><div hidden={!expanded}><label>Test name<input value={draft.name} required maxLength={160} disabled={locked} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Python script<textarea className="script-editor" rows={12} maxLength={30000} spellCheck={false} value={draft.script||''} disabled={locked} onChange={e=>setDraft({...draft,script:e.target.value})}/></label></div><div className="check-actions">{!locked&&<><button className="button secondary" disabled={!dirty||!draft.name.trim()||!draft.script?.trim()} onClick={()=>onSave(draft)}>Save test</button>{dirty&&<button className="text-button" onClick={()=>setDraft(check)}>Discard edits</button>}<button className="button secondary" disabled={!canRun||dirty||check.enabled===false} onClick={onRun}><Play size={15}/> Run test</button></>}</div>
        {run&&<div className="run-output"><strong>Passed</strong><p>Check completed successfully.</p><details><summary>View test report</summary><pre>{JSON.stringify(run.report,null,2)}</pre></details><details><summary>Script snapshot supplied to the judge</summary><pre>{run.script_snapshot}</pre></details></div>}

    </article>;
}
function SuiteAssessment({judgment}:{judgment:Judgment}){
    const result=judgment.judgment;
    const categories=[['Coverage',result.scores.coverage,30],['Assertions',result.scores.assertions,25],['Result quality',result.scores.resultQuality,25],['Operational coverage',result.scores.operationalCoverage,20]] as const;
    return <div className="suite-review-body"><p>{result.summary}</p><div className="score-breakdown">{categories.map(([name,score,max])=><div key={name}><span>{name}</span><strong>{score} / {max}</strong></div>)}</div>{[['Strengths',result.strengths],['Gaps',result.gaps],['Next steps',result.nextSteps]].map(([name,items])=>(items as string[]).length>0&&<div className="suite-findings" key={name as string}><h3>{name as string}</h3><ul>{(items as string[]).map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}<small>{judgment.model} · {new Date(judgment.reviewed_at).toLocaleString()} · Current deployment and suite</small></div>;
}
export function DemoDashboard({releases,ownerId,pipeline=false}:{releases:Release[];ownerId:string;pipeline?:boolean}){
    const [states,setStates]=useState<StoredDemo[]>([]);
    useEffect(()=>{setStates(releases.map(release=>(()=>{const saved=readDemo(demoStorageKey(ownerId,release.id),initialDemo(release));return {...saved,deployments:saved.deployments.filter(d=>d.config?.provider==='vercel')};})()));},[releases,ownerId]);
    return <><DemoBanner/><div className="page-heading"><div><span className="eyebrow">DEPLOY · TEST · PROMOTE</span><h1>{pipeline?'Release pipeline':'Your releases'}<span className="heading-dot">.</span></h1><p>Manage environment releases, test suites, and AI reviews.</p></div><CreateRelease/></div>{!releases.length?<div className="empty-state"><h2>Create your first release.</h2><p>Start with 10 editable tests and three environments.</p></div>:pipeline?<div className="pipeline-table-wrap"><table className="pipeline-table"><thead><tr><th>Release</th>{ENVIRONMENTS.map(env=><th key={env.id}>{env.label}</th>)}</tr></thead><tbody>{states.map(state=><tr key={state.release.id}><th><Link href={`/releases/${state.release.id}?tab=release`}>{state.release.title}</Link><span>{state.release.target_version}</span></th>{ENVIRONMENTS.map(env=>{const d=latestDeployment(state.deployments,state.release,env.id),passed=deploymentVerified(state.release,d,state.deployments,state.runs),available=canDeploy(state.release,env.id,state.deployments,state.runs);return <td key={env.id}><Link className={`pipeline-cell ${passed?'recorded':available?'available':'locked'}`} href={`/releases/${state.release.id}?tab=release`}>{passed?'Passed':d?(deploymentReady(d)?'Run tests':String(d.config.status)):available?'Ready to deploy':'Locked'}</Link></td>;})}</tr>)}</tbody></table></div>:<div className="release-grid">{releases.map(release=>{const state=states.find(s=>s.release.id===release.id);return <Link className="release-card" key={release.id} href={`/releases/${release.id}`}><div className="card-top"><span className="badge">{state?.release.lifecycle==='shipped'?'Shipped':'Preparing'}</span><Rocket size={18}/></div><h3>{release.title}</h3><div className="version">{state?.release.target_version||release.target_version}</div><p className="pipeline-hint">{state?.release.release_checks.length||10} editable Python tests</p><span className="text-button">Open release →</span></Link>;})}</div>}</>;
}
