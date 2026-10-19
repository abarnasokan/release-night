import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canDeploy,deploymentVerified,latestRun,verification,type Deployment,type TestRun} from '../src/lib/domain/verification';
import type {Release} from '../src/lib/domain/readiness';
const release:Release={id:'r',title:'App',target_version:'v1',revision:1,suite_revision:10,lifecycle:'preparing',ai_review_enabled:false,created_at:'2026-10-18',shipped_at:null,release_checks:[{id:'c',name:'E2E',required:true,enabled:true,result:'passed',verified_revision:1,evidence_text:'Legacy manual pass',evidence_url:null,verified_at:null,updated_at:'2026-10-18',script:'assert True'}]};
const deploy=(environment:Deployment['environment'],id:string=environment,predecessor_id:string|null=null):Deployment=>({id,release_id:'r',revision:1,environment,deployment_ref:'commit-123',base_url:'https://app.example.com',config:{},predecessor_id,deployed_at:'2026-10-18T12:00:00Z'});
const run=(deployment_id:string,status:TestRun['status']='passed',overrides:Partial<TestRun>={}):TestRun=>({id:'run-'+deployment_id,release_id:'r',deployment_id,check_id:'c',suite_revision:10,check_name:'E2E',script_snapshot:'assert True',status,summary:'Checked',logs:'',created_at:'2026-10-18T12:00:01Z',completed_at:null,...overrides});
test('Dev can be deployed before tests; manual passes never unlock Staging',()=>{
    assert.equal(canDeploy(release,'dev',[],[]),true);
    assert.equal(canDeploy(release,'staging',[deploy('dev')],[]),false);
    assert.equal(verification(release,deploy('dev'),[]).passed,0);
});
test('Dev runs unlock Staging; Staging has independent runs before Production unlocks',()=>{
    const ds=[deploy('dev'),deploy('staging','staging','dev')];
    assert.equal(canDeploy(release,'staging',ds,[run('dev')]),true);
    assert.equal(canDeploy(release,'prod',ds,[run('dev')]),false);
    assert.equal(canDeploy(release,'prod',ds,[run('dev'),run('staging')]),true);
    assert.equal(deploymentVerified(release,deploy('prod','prod','staging'),[...ds,deploy('prod','prod','staging')],[run('dev'),run('staging')]),false);
});
test('new deployment results and older suite/version passes cannot be reused',()=>{
    const dev=deploy('dev','new-dev');
    assert.equal(verification(release,dev,[run('old-dev')]).ready,false);
    assert.equal(verification({...release,suite_revision:11},dev,[run('new-dev')]).ready,false);
    assert.equal(canDeploy({...release,revision:2},'staging',[dev],[run('new-dev')]),false);
});
test('a later failed, queued, observing, or inconclusive run overrides an older pass',()=>{
    for(const status of ['failed','queued','running','observing','inconclusive','error'] as const){
        const runs=[run('dev'),run('dev',status,{id:'new',created_at:'2026-10-18T12:00:02Z'})];
        assert.equal(latestRun(runs,'dev','c',10)?.status,status);
        assert.equal(verification(release,deploy('dev'),runs).ready,false);
    }
});
test('an upstream redeployment invalidates an older downstream chain',()=>{
    const ds=[deploy('dev'),deploy('dev','new-dev'),deploy('staging','staging','dev')];
    ds[1].deployed_at='2026-10-18T12:10:00Z';
    const runs=[run('dev'),run('new-dev'),run('staging')];
    assert.equal(canDeploy(release,'prod',ds,runs),false);
    assert.equal(canDeploy(release,'prod',[...ds.filter(d=>d.id!=='staging'),deploy('staging','new-staging','new-dev')],[...runs,run('new-staging')]),true);
});
test('optional/disabled failures do not block, but no required tests cannot promote',()=>{
    const optional={...release.release_checks[0],id:'optional',required:false};
    const disabled={...release.release_checks[0],id:'disabled',enabled:false};
    assert.equal(verification({...release,release_checks:[...release.release_checks,optional,disabled]},deploy('dev'),[run('dev')]).ready,true);
    assert.equal(verification({...release,release_checks:[optional,disabled]},deploy('dev'),[]).ready,false);
});
test('shipped releases cannot register more deployments',()=>{
    assert.equal(canDeploy({...release,lifecycle:'shipped'},'dev',[],[]),false);
});
