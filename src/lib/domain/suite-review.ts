import type {DemoState,DemoRun} from './demo';
import type {Environment} from './pipeline';
import {latestDeployment,latestRun} from './verification';
export function suiteReviewInput(state:DemoState,environment:Environment){
    const deployment=latestDeployment(state.deployments,state.release,environment);
    if(!deployment)throw Error('Deploy to this environment and run tests before requesting a review.');
    const tests=state.release.release_checks.map(check=>{
        const run=latestRun(state.runs,deployment.id,check.id,state.release.suite_revision??1) as DemoRun|undefined;
        const script=run?.script_snapshot??check.script??'';
        const report=run?.report;
        return {check_id:check.id,name:check.name,enabled:check.enabled!==false,required:check.required,status:check.enabled===false?'disabled' as const:run?.status??'not_run' as const,script_excerpt:script.slice(0,2000),script_truncated:script.length>2000,run_id:run?.id??null,report:report?{source:report.source,expected:report.expected.slice(0,500),steps:report.steps.slice(0,6).map(s=>s.slice(0,500)),observations:report.observations.slice(0,6).map(s=>s.slice(0,1000)),limitations:report.limitations.slice(0,4).map(s=>s.slice(0,500))}:null};
    });
    if(!tests.some(test=>test.enabled&&test.run_id))throw Error('Run at least one enabled test before requesting a suite review.');
    return {release_id:state.release.id,environment,deployment_ref:deployment.deployment_ref,suite_revision:state.release.suite_revision??1,tests};
}
export function suiteReviewKey(state:DemoState,environment:Environment){
    const deployment=latestDeployment(state.deployments,state.release,environment);
    return JSON.stringify([environment,deployment?.id??null,state.release.revision,state.release.suite_revision,state.release.release_checks.map(check=>[check.id,latestRun(state.runs,deployment?.id??'',check.id,state.release.suite_revision??1)?.id??null])]);
}
