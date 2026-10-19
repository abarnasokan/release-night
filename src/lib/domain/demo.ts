import templates from '../test-templates.json';
import type { Check,Release } from './readiness';
import type { Environment } from './pipeline';
import { canDeploy,latestDeployment,deploymentReady,type Deployment,type TestRun } from './verification';
export type DemoReport={source:'simulated';expected:string;steps:string[];observations:string[];limitations:string[]};
export type DemoRun=TestRun & {source:'simulated';report:DemoReport};
export type DemoState={format:1;release:Release;deployments:Deployment[];runs:DemoRun[]};
export function demoStorageKey(ownerId:string,releaseId:string){return `release-night:demo:v1:${ownerId}:${releaseId}`;}
export function initialDemo(release:Release):DemoState {
    const checks:Check[]=templates.map(t=>({id:`demo-${t.key}`,name:t.name,template_key:t.key,script:t.script,enabled:true,required:true,result:'pending',verified_revision:null,evidence_text:'',evidence_url:null,verified_at:null,updated_at:release.created_at}));
    return {format:1,release:{...release,lifecycle:'preparing',shipped_at:null,suite_revision:1,release_checks:checks},deployments:[],runs:[]};
}
export function registerDemoDeployment(state:DemoState,environment:Environment,id:string,now:string):DemoState {
    if(!canDeploy(state.release,environment,state.deployments,state.runs))throw Error('Pass the preceding environment’s suite first.');
    const previous=environment==='staging'?'dev':environment==='prod'?'staging':null;
    const deployment:Deployment={id,release_id:state.release.id,revision:state.release.revision,environment,deployment_ref:`${state.release.target_version}-${environment}`,base_url:`https://${environment}.demo.example`,config:{demo:true},predecessor_id:previous?latestDeployment(state.deployments,state.release,previous)?.id||null:null,deployed_at:now};
    return {...state,deployments:[deployment,...state.deployments]};
}
export function simulateDemoRuns(state:DemoState,environment:Environment,id:()=>string,now:string,checkId?:string):DemoState {
    if(state.release.lifecycle==='shipped')throw Error('This release is finished. Reset the workspace to start again.');
    const deployment=latestDeployment(state.deployments,state.release,environment);
    if(!deployment)throw Error('Deploy to this environment first.');
    if(!deploymentReady(deployment))throw Error('Wait for the Vercel deployment to be ready before running tests.');
    const checks=state.release.release_checks.filter(c=>c.enabled!==false&&(!checkId||c.id===checkId));
    if(!checks.length)throw Error('Enable at least one test.');
    const runs:DemoRun[]=checks.map(c=>({id:id(),release_id:state.release.id,deployment_id:deployment.id,check_id:c.id,suite_revision:state.release.suite_revision??1,check_name:c.name,script_snapshot:c.script||'',status:'passed',source:'simulated',summary:'Simulated pass for demonstration. No Python or browser test was executed.',logs:'[DEMO] Generated a passing sample result.\n[DEMO] No code was executed and no deployment or telemetry endpoint was contacted.',created_at:now,completed_at:now,report:{source:'simulated',expected:c.name,steps:[`Select ${environment} deployment ${deployment.deployment_ref}.`,`Demonstrate the check: ${c.name}.`],observations:c.template_key==='default-08'?['Simulated fixture: 13 samples across 3600 seconds after demo deployment; maximum CPU 42%, maximum memory 61%, no five-minute gaps.']:c.template_key==='default-09'?['Simulated fixture: 14 active users, error rate 0.001, all assigned to this demo build.']:c.template_key==='default-10'?['Simulated fixture: 120 requests and 14 active sessions on the new build; zero requests or sessions on the old build.']:[`Sample outcome: ${c.name} passed in this demo scenario.`],limitations:['All observations are simulated; the script was not executed.','No real CPU, memory, active-user, routing, or deployment data was collected.']}}));
    return {...state,runs:[...runs,...state.runs]};
}
export function saveDemoCheck(state:DemoState,check:Check):DemoState {
    if(state.release.lifecycle==='shipped')throw Error('Shipped releases are read-only. Reset the workspace to edit.');
    return {...state,release:{...state.release,suite_revision:(state.release.suite_revision??1)+1,release_checks:state.release.release_checks.map(c=>c.id===check.id?check:c)}};
}
