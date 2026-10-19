from sdk import browser_page, steps, result

# Configure core_steps for your app's primary workflow, including outcome assertions.
with browser_page() as page:
    steps(page, 'core_steps')
result('passed', 'The primary user workflow completed and its outcome assertions passed.')
