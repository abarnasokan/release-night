from sdk import require_config, http, result

# Example api_path: /api/health. Choose a real endpoint on your deployed app.
with http(require_config('api_path')) as response:
    assert response.status == 200, f'API returned HTTP {response.status}'
result('passed', 'The configured critical API endpoint returned HTTP 200.')
