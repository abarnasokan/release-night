from datetime import datetime, timezone
from sdk import CONTEXT, DEPLOYMENT_REF, json_endpoint, timestamp, result

# The adapter must aggregate real request/session deployment identities.
# A successful homepage request alone does not establish session migration.
data = json_endpoint('routing_url')
assert data['deployment_ref'] == DEPLOYMENT_REF, 'Routing metrics refer to another deployment'
start, end = timestamp(data['window_start']), timestamp(data['window_end'])
assert start >= timestamp(CONTEXT['deployed_at']) and end > start, 'Routing window predates this deployment'
assert 0 <= (datetime.now(timezone.utc) - end).total_seconds() <= 120, 'Routing metrics are stale'
if data['requests_new'] == 0 or data['active_sessions_new'] == 0:
    result('inconclusive', 'Need observed requests and active sessions reaching the new deployment.')
assert data['requests_new'] > 0 and data['active_sessions_new'] > 0, 'Invalid request/session counts'
assert data['requests_old'] == 0, 'Requests still reach the previous deployment'
assert data['active_sessions_old'] == 0, 'Active sessions still reach the previous deployment'
result('passed', 'All requests and active sessions in the reported window reached the new deployment.')
