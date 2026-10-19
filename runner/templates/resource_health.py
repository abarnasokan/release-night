from datetime import datetime, timezone
from sdk import CONTEXT, CONFIG, DEPLOYMENT_REF, json_endpoint, timestamp, result, require_config

require_config('metrics_url')
deployed = timestamp(CONTEXT['deployed_at'])
now = datetime.now(timezone.utc)
# This window begins after deployment, not one hour before it.
if (now - deployed).total_seconds() < 3600:
    result('observing', 'Waiting for one complete hour of post-deployment CPU/memory metrics. The worker will check again.')
data = json_endpoint('metrics_url')
assert data['deployment_ref'] == DEPLOYMENT_REF, 'Metrics belong to a different deployment'
samples = sorted(data.get('samples', []), key=lambda s: timestamp(s['timestamp']))
if len(samples) < 13:
    result('inconclusive', 'Need at least 13 timestamped CPU/memory samples covering the last hour.')
times = [timestamp(s['timestamp']) for s in samples]
assert times[0] >= deployed, 'Metrics include a previous deployment window'
if (times[-1] - times[0]).total_seconds() < 3600:
    result('inconclusive', 'Metrics do not cover a full hour after deployment.')
assert 0 <= (now - times[-1]).total_seconds() <= 120, 'Metrics are stale or in the future'
assert all(0 < (b-a).total_seconds() <= 300 for a,b in zip(times,times[1:])), 'Metrics contain missing or duplicate intervals'
assert (now - times[0]).total_seconds() <= 3900, 'Metrics do not describe the latest hour'
for sample in samples:
    assert 0 <= sample['cpu_percent'] <= CONFIG.get('max_cpu_percent', 80), 'CPU crossed the threshold'
    assert 0 <= sample['memory_percent'] <= CONFIG.get('max_memory_percent', 85), 'Memory crossed the threshold'
result('passed', 'CPU and memory stayed within configured limits for a complete post-deployment hour.')
