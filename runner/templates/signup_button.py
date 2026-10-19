import re
from sdk import BASE_URL, CONFIG, browser_page, result

with browser_page() as page:
    page.goto(BASE_URL, wait_until='domcontentloaded')
    # Set signup_selector when your app uses a different label or control.
    control = page.locator(CONFIG['signup_selector']) if CONFIG.get('signup_selector') else page.get_by_role('button', name=re.compile(r'sign up|create account|get started', re.I))
    control.first.click()
    # A click alone is not a pass: assert that the signup form appears.
    page.locator(CONFIG.get('signup_form_selector', 'input[type="email"]')).wait_for(state='visible')
result('passed', 'The signup control opens a form with the expected input.')
