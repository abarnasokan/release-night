from sdk import http, result

with http('/') as response:
    assert response.status == 200, f'Homepage returned HTTP {response.status}'
    assert response.read(1024), 'Homepage is empty'
result('passed', 'The deployed homepage responds with HTTP 200 and a non-empty body.')
