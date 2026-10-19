export type Result = 'pending' | 'passed' | 'failed';
export type Check = {
    id: string;
    name: string;
    required: boolean;
    enabled?: boolean;
    script?: string;
    template_key?: string | null;
    result: Result;
    verified_revision: number | null;
    evidence_text: string;
    evidence_url: string | null;
    verified_at: string | null;
    updated_at: string;
};
export type Release = {
    id: string;
    title: string;
    target_version: string;
    revision: number;
    suite_revision?: number;
    lifecycle: 'preparing' | 'shipped';
    ai_review_enabled: boolean;
    created_at: string;
    shipped_at: string | null;
    release_checks: Check[];
};
export function effectiveState(check: Pick<Check, 'result' | 'verified_revision'>, revision: number) {
    return check.result !== 'pending' && check.verified_revision !== revision ? 'stale' : check.result;
}
export function readiness(checks: Pick<Check, 'name' | 'required' | 'result' | 'verified_revision' | 'enabled'>[], revision: number) {
    checks = checks.filter(c => c.enabled !== false);
    const required = checks.filter(c => c.required);
    const blockers = required.filter(c => effectiveState(c, revision) !== 'passed').map(c => `${c.name}: ${effectiveState(c, revision)}`);
    if (!required.length)
        blockers.push('Add at least one required check');
    const warnings = checks.filter(c => !c.required && effectiveState(c, revision) !== 'passed').map(c => `${c.name}: ${effectiveState(c, revision)}`);
    return { ready: blockers.length === 0, blockers, warnings, passed: required.filter(c => effectiveState(c, revision) === 'passed').length, total: required.length };
}
