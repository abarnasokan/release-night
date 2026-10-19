from datetime import datetime, timezone
from sdk import CONTEXT, CONFIG, DEPLOYMENT_REF, json_endpoint, timestamp, result

# Adapter endpoint contract is documented in runner/README.md.
data = json_endpoint('active_users_url')
assert data['deployment_ref'] == DEPLOYMENT_REF, 'Activity belongs to another deployment'
start, end = timestamp(data['window_start']), timestamp(data['window_end'])
assert start >= timestamp(CONTEXT['deployed_at']) and end > start, 'Activity is not from this deployment window'
assert 0 <= (datetime.now(timezone.utc) - end).total_seconds() <= 120, 'Activity metrics are stale'
if data['active_users'] == 0:
    result('inconclusive', 'No active users observed; live-user health cannot be established.')
assert data['active_users'] > 0, 'Invalid active-user count'
assert 0 <= data['error_rate'] <= CONFIG.get('max_error_rate', 0.01), 'Live-user error rate is above the threshold'
result('passed', f"Observed {data['active_users']} active users with error rate within the configured threshold.")
