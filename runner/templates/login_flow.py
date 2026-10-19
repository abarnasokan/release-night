from sdk import browser_page, steps, result

# login_steps should sign in, assert the account view, sign out, and assert logout.
# Use {"action":"fill","selector":"...","secret":"TEST_PASSWORD"} for passwords.
with browser_page() as page:
    steps(page, 'login_steps')
result('passed', 'The configured login/logout workflow and assertions passed.')
