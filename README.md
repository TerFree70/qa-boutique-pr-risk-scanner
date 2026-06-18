# QA Boutique PR Risk Scanner

A free read-only GitHub Action that detects risky pull request areas and suggests QA checks before merge.

It is designed for SaaS, web apps, and product teams that want lightweight PR risk awareness without sending code to an external service.

## What it does

QA Boutique PR Risk Scanner analyzes changed files in a pull request and highlights risk areas such as:

* Billing, pricing, checkout, subscriptions
* Auth, permissions, roles, sessions
* Critical UI and user flows
* API and backend logic
* Config, environment, deployment changes
* Test coverage signals

It then writes a Markdown report to the GitHub Actions job summary.

## Example output

```text
Overall risk: HIGH

Detected risk areas:

HIGH — Billing / Pricing / Subscription
Suggested checks:
- Verify monthly vs annual price calculation
- Verify checkout redirects to the correct plan
- Verify free/trial plan edge cases
- Verify upgrade/downgrade behavior
- Verify failed payment/provider error handling

Test coverage signal:
No changed test files were detected.
```

## Why use it?

Many production issues are not caused by syntax errors. They happen when a pull request touches business-critical logic and the team forgets to check the right edge cases.

This action helps reviewers notice risky areas earlier.

Examples:

* Pricing logic changed, but no pricing regression tests changed
* Checkout flow changed, but no failed payment scenario was checked
* Auth middleware changed, but role-based access was not verified
* API route changed, but validation and error states were not covered

## Security and privacy

This action is intentionally simple and safe by default.

* No AI is used inside this free action
* No code is sent to QA Boutique
* No external API calls are made
* No write access is required
* The action only reads pull request metadata and changed files through GitHub Actions

For deeper AI-powered PR analysis, you can use QA Boutique Free PR Audit separately.

## Usage

Create a workflow file:

```yaml
name: PR Risk Scan

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: read

jobs:
  pr-risk-scan:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run QA Boutique PR Risk Scanner
        uses: TerFree70/qa-boutique-pr-risk-scanner@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input               | Required | Default                                 | Description                                            |
| ------------------- | -------: | --------------------------------------- | ------------------------------------------------------ |
| `github-token`      |      Yes | —                                       | GitHub token used to read pull request files           |
| `min-risk`          |       No | `low`                                   | Minimum risk level to show: `low`, `medium`, or `high` |
| `include-low-risk`  |       No | `false`                                 | Show low-risk findings in the summary                  |
| `fail-on-high-risk` |       No | `false`                                 | Fail the workflow if high risk is detected             |
| `free-audit-url`    |       No | `https://qaboutique.com/#free-pr-audit` | Link to a deeper QA Boutique PR audit                  |

## Outputs

| Output         | Description                                       |
| -------------- | ------------------------------------------------- |
| `overall-risk` | Overall PR risk level: `low`, `medium`, or `high` |
| `risk-score`   | Numeric risk score                                |
| `risk-areas`   | Comma-separated list of detected risk areas       |

## Example with stricter settings

```yaml
- name: Run QA Boutique PR Risk Scanner
  uses: TerFree70/qa-boutique-pr-risk-scanner@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    min-risk: medium
    include-low-risk: "false"
    fail-on-high-risk: "true"
```

## How risk is detected

This action uses rule-based analysis.

It checks changed file paths and diff keywords for high-risk areas. For example:

* `pricing`, `billing`, `checkout`, `stripe`, `paddle` → Billing / Pricing / Subscription risk
* `auth`, `roles`, `permissions`, `session`, `token` → Auth / Access Control risk
* `api`, `routes`, `webhook`, `services` → API / Backend Logic risk
* `onboarding`, `forms`, `dashboard`, `settings` → Critical User Flow risk

It also warns when production files are changed without test-related files.

## Limitations

This action does not perform deep semantic code review.

It will not guarantee that a PR is safe or unsafe. It is a lightweight PR risk checklist generator.

For deeper AI-powered analysis of actual PR logic, use QA Boutique.

## Deeper AI PR audit

Want a deeper AI QA review of your PR?

Try QA Boutique Free PR Audit:

https://qaboutique.com/#free-pr-audit

## License

MIT
