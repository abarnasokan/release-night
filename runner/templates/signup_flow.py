from sdk import browser_page, steps, result

# Configure signup_steps using a disposable test account. Never use a real user.
# Include a final expect_visible, expect_text, or expect_url assertion.
with browser_page() as page:
    steps(page, 'signup_steps')
result('passed', 'The configured signup workflow completed and its assertions passed.')
