import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialDemo,registerDemoDeployment,simulateDemoRuns,saveDemoCheck,demoStorageKey} from '../src/lib/domain/demo';
import {canDeploy,latestDeployment,verification} from '../src/lib/domain/verification';
import type {Release} from '../src/lib/domain/readiness';
const release={id:'bb50fb98-1be1-4026-8505-39ba022d87a1',title:'Demo',target_version:'v1',revision:1,lifecycle:'preparing',suite_revision:99,release_checks:[],created_at:'2026-10-18',ai_review_enabled:false,shipped_at:null} as Release;
let next=0;const id=()=>`demo-${++next}`;
const time=(n:number)=>`2026-10-18T12:00:${String(n).padStart(2,'0')}Z`;
test('demo seeds ten editable scripts and scopes browser storage by owner and release',()=>{
    const demo=initialDemo(release);assert.equal(demo.release.release_checks.length,10);assert.ok(demo.release.release_checks.every(c=>c.script));
    assert.notEqual(demoStorageKey('a','r'),demoStorageKey('b','r'));
    assert.equal(release.suite_revision,99,'Real release is unchanged');
});
test('simulated passes unlock sequential demo environments without a worker or real result',()=>{
    let state=initialDemo(release);
    assert.throws(()=>registerDemoDeployment(state,'staging',id(),time(0)),/preceding/);
    state=registerDemoDeployment(state,'dev',id(),time(1));
    state=simulateDemoRuns(state,'dev',id,time(2));
    assert.equal(state.runs.length,10);assert.ok(state.runs.every(r=>r.source==='simulated'&&r.report.source==='simulated'&&r.summary.includes('Simulated')));
    assert.equal(canDeploy(state.release,'staging',state.deployments,state.runs),true);
    assert.equal(canDeploy(state.release,'prod',state.deployments,state.runs),false);
    state=registerDemoDeployment(state,'staging',id(),time(3));
    assert.equal(verification(state.release,latestDeployment(state.deployments,state.release,'staging'),state.runs).ready,false);
    state=simulateDemoRuns(state,'staging',id,time(4));
    assert.equal(canDeploy(state.release,'prod',state.deployments,state.runs),true);
});
test('script changes and redeployments invalidate demo passes',()=>{
    let state=registerDemoDeployment(initialDemo(release),'dev',id(),time(1));state=simulateDemoRuns(state,'dev',id,time(2));
    assert.equal(canDeploy(state.release,'staging',state.deployments,state.runs),true);
    const changed=saveDemoCheck(state,{...state.release.release_checks[0],script:'# changed'});
    assert.equal(canDeploy(changed.release,'staging',changed.deployments,changed.runs),false);
    const redeployed=registerDemoDeployment(state,'dev',id(),time(3));
    assert.equal(canDeploy(redeployed.release,'staging',redeployed.deployments,redeployed.runs),false);
});
