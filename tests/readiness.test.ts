import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readiness, effectiveState, type Check } from '../src/lib/domain/readiness';
const check = (overrides: Partial<Check> = {}): Check => ({ id: 'a', name: 'Migration', required: true, result: 'passed', verified_revision: 1, evidence_text: 'Verified', evidence_url: null, verified_at: null, updated_at: '2026-01-01', ...overrides });
test('requires at least one required check', () => { assert.equal(readiness([], 1).ready, false); assert.equal(readiness([check({ required: false })], 1).ready, false); });
test('pending and failed required results name the blocker', () => { for (const result of ['pending', 'failed'] as const) {
    const r = readiness([check({ result })], 1);
    assert.equal(r.ready, false);
    assert.match(r.blockers[0], /Migration/);
} });
test('current required passes permit optional pending, failed and stale warnings', () => { const r = readiness([check(), check({ name: 'Notes', required: false, result: 'pending' }), check({ name: 'Extras', required: false, result: 'failed' }), check({ name: 'Docs', required: false, verified_revision: 0 })], 1); assert.equal(r.ready, true); assert.equal(r.warnings.length, 3); });
test('old revision passes cannot ship', () => { assert.equal(effectiveState(check(), 2), 'stale'); assert.equal(readiness([check()], 2).ready, false); });
test('changing version back cannot revive older results', () => { assert.equal(readiness([check()], 3).ready, false); assert.equal(readiness([check({ verified_revision: 3 })], 3).ready, true); });
test('optional to required immediately blocks on a failed result', () => { const c = check({ required: false, result: 'failed' }); assert.equal(readiness([check(), c], 1).ready, true); assert.equal(readiness([check(), { ...c, required: true }], 1).ready, false); });
test('disabled required failures and optional warnings are excluded', () => {
    const r = readiness([check(), check({ name: 'Disabled failure', enabled: false, result: 'failed' }), check({ name: 'Disabled warning', enabled: false, required: false, result: 'pending' })], 1);
    assert.equal(r.ready, true);
    assert.equal(r.total, 1);
    assert.deepEqual(r.warnings, []);
});
test('disabling every required check does not allow shipping', () => {
    assert.equal(readiness([check({ enabled: false })], 1).ready, false);
});
test('enabled checks with stale results still block and old snapshots remain supported', () => {
    assert.equal(readiness([check({ enabled: true, verified_revision: 0 })], 1).ready, false);
    assert.equal(readiness([check()], 1).ready, true);
});
