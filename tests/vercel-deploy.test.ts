import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deployAccess,deploySettings,deployRequest,deploymentMetadata,matchesDeployment,publicJob,vercelClient,type DeploySettings} from '../src/lib/vercel-deploy';
import {initialDemo,simulateDemoRuns} from '../src/lib/domain/demo';
import {canDeploy,verification} from '../src/lib/domain/verification';
import type {Release} from '../src/lib/domain/readiness';
const settings:DeploySettings={token:'server-secret',projectId:'prj_simple',teamId:'team_poc',repository:'abarnasokan/simple-app',emails:['operator@example.com']};
const identity={release_id:'bb50fb98-1be1-4026-8505-39ba022d87a1',revision:1,suite_revision:1,owner_id:'owner'};
const sha='a'.repeat(40);
const project={id:'prj_simple',name:'simple-app',link:{type:'github',repoId:123,org:'abarnasokan',repo:'simple-app',productionBranch:'main'}};
const provider=(environment:'dev'|'staging'|'prod'='dev',overrides:Record<string,unknown>={})=>({id:'dpl_prior',projectId:'prj_simple',readyState:'READY',url:'simple-test.vercel.app',createdAt:1000,meta:deploymentMetadata(identity,environment),gitSource:{sha,repoId:123},...overrides});
function transport(responses:unknown[]){const calls:{url:URL;init:RequestInit|undefined}[]=[];return {calls,fetch:(async(url,init)=>{calls.push({url:new URL(String(url)),init});return Response.json(responses.shift());}) as typeof fetch};}
test('deployment credentials remain required and only confirmed allowed operators may deploy',()=>{
    assert.equal(deploySettings({}),null);
    assert.equal(deployAccess('operator@example.com',true,settings),true);
    assert.equal(deployAccess('OPERATOR@example.com',true,settings),true);
    assert.equal(deployAccess('operator@example.com',false,settings),false);
    assert.equal(deployAccess('visitor@example.com',true,settings),false);
    assert.equal(deployAccess(undefined,true,settings),false);
});
test('the API accepts only fixed environment requests and deployment identities',()=>{
    const body={...identity,action:'start',environment:'dev',predecessor_id:null};const {owner_id,...input}=body;
    assert.equal(deployRequest.safeParse(input).success,true);
    assert.equal(deployRequest.safeParse({...input,project:'prj_other'}).success,false);
    assert.equal(deployRequest.safeParse({...input,environment:'arbitrary'}).success,false);
    assert.equal(deployRequest.safeParse({...input,predecessor_id:'https://evil.example'}).success,false);
});
test('Dev deploys the linked GitHub dev branch into the one configured project',async()=>{
    const mock=transport([project,provider('dev',{id:'dpl_new',readyState:'QUEUED'})]);
    const job=await vercelClient(settings,mock.fetch).start('dev',identity,null);
    const body=JSON.parse(String(mock.calls[1].init?.body));
    assert.equal(body.project,'prj_simple');assert.equal(body.gitSource.ref,'dev');assert.equal(body.gitSource.repoId,'123');
    assert.equal('target' in body,false);assert.equal(body.meta.releaseNightRelease,identity.release_id);
    assert.equal(mock.calls[1].url.searchParams.get('teamId'),'team_poc');
    assert.equal(job.state,'QUEUED');assert.equal(JSON.stringify(job).includes('server-secret'),false);
});
test('Staging and Production pin the preceding deployment commit while changing branch and target',async()=>{
    for(const environment of ['staging','prod'] as const){
        const mock=transport([project,provider(environment==='staging'?'dev':'staging'),provider(environment,{id:'dpl_next',readyState:'BUILDING'})]);
        await vercelClient(settings,mock.fetch).start(environment,identity,'dpl_prior');
        const body=JSON.parse(String(mock.calls[2].init?.body));
        assert.equal(body.project,'prj_simple');assert.equal(body.gitSource.sha,sha);
        assert.equal(body.gitSource.ref,environment==='prod'?'main':'staging');
        assert.equal(body.target,environment==='prod'?'production':undefined);
    }
});
test('missing, failed, wrong-stage, foreign and unresolved predecessors never start a build',async()=>{
    for(const previous of [provider('dev',{readyState:'ERROR'}),provider('staging'),provider('dev',{projectId:'foreign'}),provider('dev',{meta:{...deploymentMetadata(identity,'dev'),releaseNightOwner:'someone-else'}}),provider('dev',{gitSource:{}})]){
        const mock=transport([project,previous]);
        await assert.rejects(()=>vercelClient(settings,mock.fetch).start('staging',identity,'dpl_prior'));
        assert.equal(mock.calls.length,2);
    }
    const mock=transport([project]);await assert.rejects(()=>vercelClient(settings,mock.fetch).start('prod',identity,null));assert.equal(mock.calls.length,1);
});
test('foreign repository and foreign status records are rejected',async()=>{
    const mock=transport([{...project,link:{...project.link,repo:'release-night'}}]);
    await assert.rejects(()=>vercelClient(settings,mock.fetch).start('dev',identity,null),/GitHub repository/);
    const foreign=transport([project,provider('dev',{meta:{...deploymentMetadata(identity,'dev'),releaseNightRelease:'other'}})]);
    await assert.rejects(()=>vercelClient(settings,foreign.fetch).status('dpl_prior',identity),/does not belong/);
    assert.equal(matchesDeployment(provider(),identity,'another-project'),false);
});
test('provider state and alias readiness remain distinct from successful deployment',()=>{
    assert.equal(publicJob(provider('prod',{aliasAssigned:false}),'simple-app').state,'BUILDING');
    assert.equal(publicJob(provider('prod',{aliasError:{code:'failed'}}),'simple-app').state,'ERROR');
    assert.throws(()=>publicJob(provider('dev',{url:'evil.example'}),'simple-app'));
});
test('suite edits permit source promotion after new tests without inventing a new source deployment',async()=>{
    const current={...identity,suite_revision:2};const mock=transport([project,provider('dev'),provider('staging',{meta:deploymentMetadata(current,'staging')})]);
    await vercelClient(settings,mock.fetch).start('staging',current,'dpl_prior');
    assert.equal(JSON.parse(String(mock.calls[2].init?.body)).gitSource.sha,sha);
});
test('queued or failed real builds cannot run tests or unlock staging, even with old passing runs',()=>{
    const release={...identity,id:identity.release_id,title:'App',target_version:'1.0.0',lifecycle:'preparing',ai_review_enabled:false,created_at:'2026-10-18',shipped_at:null,release_checks:[]} as Release;
    let state=initialDemo(release);
    state.deployments=[{id:'dpl_build',release_id:release.id,revision:1,environment:'dev',deployment_ref:'abc',base_url:'https://simple-test.vercel.app',predecessor_id:null,deployed_at:'2026-10-18',config:{provider:'vercel',status:'QUEUED'}}];
    assert.throws(()=>simulateDemoRuns(state,'dev',()=>crypto.randomUUID(),'2026-10-18'),/ready/);
    state.deployments[0].config.status='READY';state=simulateDemoRuns(state,'dev',()=>crypto.randomUUID(),'2026-10-18');
    assert.equal(canDeploy(state.release,'staging',state.deployments,state.runs),true);
    for(const status of ['BUILDING','ERROR','CANCELED']){state.deployments[0].config.status=status;assert.equal(verification(state.release,state.deployments[0],state.runs).ready,false);assert.equal(canDeploy(state.release,'staging',state.deployments,state.runs),false);}
});
