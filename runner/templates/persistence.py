from sdk import browser_page, steps, result

# persistence_steps must create/save data, reload or start a new session,
# then assert the saved value is still present. Use disposable synthetic records.
with browser_page() as page:
    steps(page, 'persistence_steps')
result('passed', 'The configured persistence workflow and assertions passed.')
