import type { Check, Release } from './readiness';
import { ENVIRONMENTS, type Environment } from './pipeline';
export type Deployment = {
    id: string; release_id: string; revision: number; environment: Environment;
    deployment_ref: string; base_url: string; config: Record<string, unknown>;
    predecessor_id: string | null; deployed_at: string;
};
export type TestRun = {
    id: string; release_id: string; deployment_id: string; check_id: string;
    suite_revision: number; check_name: string; script_snapshot: string;
    status: 'queued' | 'running' | 'observing' | 'passed' | 'failed' | 'inconclusive' | 'error';
    summary: string; logs: string; created_at: string; completed_at: string | null;
};
export function latestDeployment(deployments: Deployment[], release: Pick<Release, 'id' | 'revision'>, environment: Environment) {
    return deployments.filter(d => d.release_id === release.id && d.revision === release.revision && d.environment === environment)
        .sort((a,b) => b.deployed_at.localeCompare(a.deployed_at) || b.id.localeCompare(a.id))[0];
}
export function latestRun(runs: TestRun[], deploymentId: string, checkId: string, suiteRevision: number) {
    return runs.filter(r => r.deployment_id === deploymentId && r.check_id === checkId && r.suite_revision === suiteRevision)
        .sort((a,b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0];
}
export function verification(release: Pick<Release, 'id' | 'revision' | 'suite_revision' | 'release_checks'>, deployment: Deployment | undefined, runs: TestRun[]) {
    const checks = release.release_checks.filter(c => c.enabled !== false && c.required);
    const blockers = checks.filter(c => !deployment || latestRun(runs, deployment.id, c.id, release.suite_revision ?? 1)?.status !== 'passed').map(c => c.name);
    if (!checks.length) blockers.push('Enable at least one required test');
    if (!deployment) blockers.unshift('Register a deployment before running tests');
    return { ready: blockers.length === 0, blockers, passed: deployment ? checks.filter(c => latestRun(runs, deployment.id, c.id, release.suite_revision ?? 1)?.status === 'passed').length : 0, total: checks.length };
}
export function deploymentVerified(release: Release, deployment: Deployment | undefined, deployments: Deployment[], runs: TestRun[]): boolean {
    if (!deployment || latestDeployment(deployments, release, deployment.environment)?.id !== deployment.id || !verification(release, deployment, runs).ready) return false;
    const index = ENVIRONMENTS.findIndex(e => e.id === deployment.environment);
    if (index === 0) return true;
    const previous = latestDeployment(deployments, release, ENVIRONMENTS[index-1].id);
    return !!previous && deployment.predecessor_id === previous.id && deploymentVerified(release, previous, deployments, runs);
}
export function canDeploy(release: Release, environment: Environment, deployments: Deployment[], runs: TestRun[]) {
    if (release.lifecycle === 'shipped') return false;
    const index = ENVIRONMENTS.findIndex(e => e.id === environment);
    return index === 0 || deploymentVerified(release, latestDeployment(deployments, release, ENVIRONMENTS[index-1].id), deployments, runs);
}
export function checkHasScript(check: Check) { return !!check.script?.trim(); }
