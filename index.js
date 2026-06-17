const core = require('@actions/core');
const github = require('@actions/github');

const RISK_LEVELS = {
  low: 1,
  medium: 2,
  high: 3
};

const RISK_RULES = [
  {
    id: 'billing-pricing',
    title: 'Billing / Pricing / Subscription',
    level: 'high',
    filePatterns: [
      /billing/i,
      /pricing/i,
      /checkout/i,
      /subscription/i,
      /stripe/i,
      /paddle/i,
      /invoice/i,
      /payment/i,
      /plans?/i
    ],
    diffKeywords: [
      'price',
      'pricing',
      'discount',
      'amount',
      'currency',
      'plan',
      'subscription',
      'checkout',
      'payment',
      'invoice',
      'trial'
    ],
    checks: [
      'Verify monthly vs annual price calculation.',
      'Verify checkout redirects to the correct plan.',
      'Verify free/trial plan edge cases.',
      'Verify upgrade/downgrade behavior.',
      'Verify failed payment/provider error handling.'
    ]
  },
  {
    id: 'auth-access-control',
    title: 'Auth / Permissions / Access Control',
    level: 'high',
    filePatterns: [
      /auth/i,
      /middleware/i,
      /permission/i,
      /permissions/i,
      /roles?/i,
      /rbac/i,
      /session/i,
      /token/i,
      /login/i,
      /signup/i,
      /oauth/i
    ],
    diffKeywords: [
      'role',
      'permission',
      'isadmin',
      'isauthorized',
      'token',
      'session',
      'login',
      'oauth',
      'jwt',
      'middleware'
    ],
    checks: [
      'Verify unauthorized users cannot access protected routes.',
      'Verify users with the wrong role are denied.',
      'Verify expired session/token behavior.',
      'Verify UI permissions match API permissions.',
      'Verify direct API calls cannot bypass UI restrictions.'
    ]
  },
  {
    id: 'critical-user-flow',
    title: 'Critical User Flow / UI Flow',
    level: 'medium',
    filePatterns: [
      /onboarding/i,
      /cart/i,
      /checkout/i,
      /forms?/i,
      /wizard/i,
      /dashboard/i,
      /settings/i,
      /profile/i,
      /invite/i,
      /workspace/i
    ],
    diffKeywords: [
      'submit',
      'form',
      'validate',
      'validation',
      'redirect',
      'loading',
      'error',
      'empty',
      'disabled',
      'toast'
    ],
    checks: [
      'Verify the happy path.',
      'Verify validation errors.',
      'Verify refresh/back button behavior.',
      'Verify failed API response behavior.',
      'Verify loading, empty, and error states.'
    ]
  },
  {
    id: 'api-backend',
    title: 'API / Backend Logic',
    level: 'medium',
    filePatterns: [
      /api/i,
      /routes?/i,
      /controllers?/i,
      /services?/i,
      /server/i,
      /backend/i,
      /webhook/i
    ],
    diffKeywords: [
      'handler',
      'request',
      'response',
      'status',
      'webhook',
      'retry',
      'idempotent',
      'validate',
      'schema'
    ],
    checks: [
      'Verify success response.',
      'Verify validation error response.',
      'Verify auth is required where needed.',
      'Verify permission boundaries.',
      'Verify retry/idempotency behavior for webhooks.'
    ]
  },
  {
    id: 'tests-ci',
    title: 'Tests / CI',
    level: 'medium',
    matchDiffKeywords: false,
    filePatterns: [
      /(^|\/)__tests__(\/|$)/i,
      /(^|\/)tests?(\/|$)/i,
      /(^|\/)specs?(\/|$)/i,
      /\.(test|spec)\.[jt]sx?$/i,
      /playwright/i,
      /cypress/i,
      /e2e/i,
      /\.github\/workflows/i,
      /(^|\/)ci(\/|$)/i,
      /ci\.ya?ml$/i
    ],
    diffKeywords: [
      'test',
      'spec',
      'playwright',
      'cypress',
      'retry',
      'trace',
      'screenshot',
      'coverage'
    ],
    checks: [
      'Verify affected flows have test coverage.',
      'Verify CI runs relevant tests.',
      'Verify flaky retry policy is reasonable.',
      'Verify screenshots/traces are collected on failure.'
    ]
  },
  {
    id: 'config-env-deploy',
    title: 'Config / Environment / Deploy',
    level: 'medium',
    filePatterns: [
      /env/i,
      /config/i,
      /feature-?flags?/i,
      /vercel/i,
      /docker/i,
      /kubernetes/i,
      /deploy/i,
      /package\.json/i,
      /package-lock\.json/i
    ],
    diffKeywords: [
      'env',
      'config',
      'feature',
      'flag',
      'secret',
      'deploy',
      'docker',
      'dependency',
      'version'
    ],
    checks: [
      'Verify environment-specific behavior.',
      'Verify missing config fallback.',
      'Verify staging vs production values.',
      'Verify feature flag default state.',
      'Verify dependency/version changes do not break CI.'
    ]
  }
];

function normalizeRiskLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (['low', 'medium', 'high'].includes(normalized)) {
    return normalized;
  }

  return 'low';
}

function riskWeight(level) {
  if (level === 'high') return 5;
  if (level === 'medium') return 3;
  return 1;
}

function getOverallRisk(score) {
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

function isTestFile(filename) {
  return [
    /(^|\/)__tests__(\/|$)/i,
    /(^|\/)tests?(\/|$)/i,
    /(^|\/)specs?(\/|$)/i,
    /\.(test|spec)\.[jt]sx?$/i,
    /playwright/i,
    /cypress/i,
    /e2e/i,
    /\.github\/workflows/i,
    /(^|\/)ci(\/|$)/i,
    /ci\.ya?ml$/i
  ].some((pattern) => pattern.test(filename));
}

function isProductionFile(filename) {
  return !isTestFile(filename) &&
    !/README/i.test(filename) &&
    !/\.md$/i.test(filename) &&
    !/LICENSE/i.test(filename);
}

function includesKeyword(text, keyword) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

const IGNORED_FILE_PATTERNS = [
  /^dist\//i,
  /^build\//i,
  /^coverage\//i,
  /^node_modules\//i,
  /^\.next\//i,
  /^out\//i,
  /\.min\.js$/i
];

function isIgnoredFile(filename) {
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

function analyzeFiles(files) {
  const scannableFiles = files.filter((file) => !isIgnoredFile(file.filename));

  const findings = [];
  const changedTestFiles = scannableFiles.filter((file) => isTestFile(file.filename));
  const changedProductionFiles = scannableFiles.filter((file) => isProductionFile(file.filename));
  
  for (const rule of RISK_RULES) {
    const matchedFiles = [];

    for (const file of scannableFiles) {
      const filename = file.filename || '';
      const patch = file.patch || '';
      const fileMatched = rule.filePatterns.some((pattern) => pattern.test(filename));
      const diffMatched =
        rule.matchDiffKeywords !== false &&
        rule.diffKeywords.some((keyword) => includesKeyword(patch, keyword));

      if (fileMatched || diffMatched) {
        matchedFiles.push({
          filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          reason: fileMatched ? 'path' : 'diff'
        });
      }
    }

    if (matchedFiles.length > 0) {
      findings.push({
        ...rule,
        matchedFiles
      });
    }
  }

  let score = 0;

  for (const finding of findings) {
    score += riskWeight(finding.level);
  }

  const hasHighOrMediumBusinessRisk = findings.some(
    (finding) =>
      finding.id !== 'tests-ci' &&
      ['high', 'medium'].includes(finding.level)
  );

  const noTestsChanged = changedTestFiles.length === 0;

  if (hasHighOrMediumBusinessRisk && noTestsChanged) {
    score += 3;
  }

  if (files.length > 20) {
    score += 2;
  }

  if (changedProductionFiles.length > 0 && noTestsChanged) {
    score += 2;
  }

  return {
    findings,
    score,
    overallRisk: getOverallRisk(score),
    changedTestFiles,
    changedProductionFiles,
    noTestsChanged,
    largePr: files.length > 20
  };
}

function shouldShowFinding(finding, minRisk, includeLowRisk) {
  if (includeLowRisk) return true;

  return RISK_LEVELS[finding.level] >= RISK_LEVELS[minRisk];
}

function riskEmoji(level) {
  if (level === 'high') return '🔴';
  if (level === 'medium') return '🟡';
  return '⚪';
}

function renderSummary({ owner, repo, pullNumber, files, analysis, visibleFindings, freeAuditUrl }) {
  const riskLabel = analysis.overallRisk.toUpperCase();
  const changedFilesCount = files.length;

  let markdown = '';

  markdown += '# QA Boutique PR Risk Scanner\n\n';
  markdown += `## Overall risk: ${riskEmoji(analysis.overallRisk)} ${riskLabel}\n\n`;
  markdown += `**Risk score:** ${analysis.score}\n\n`;
  markdown += `**Repository:** \`${owner}/${repo}\`\n\n`;
  markdown += `**Pull request:** #${pullNumber}\n\n`;
  markdown += `**Changed files:** ${changedFilesCount}\n\n`;

  if (analysis.findings.length === 0) {
    markdown += 'No specific risk areas were detected from changed file paths or diff keywords.\n\n';
    markdown += 'This does not mean the PR is risk-free. It only means the rule-based scanner did not detect known high-risk areas.\n\n';
  } else {
    markdown += '## Detected risk areas\n\n';

    for (const finding of visibleFindings) {
      markdown += `### ${riskEmoji(finding.level)} ${finding.level.toUpperCase()} — ${finding.title}\n\n`;

      markdown += '**Matched files:**\n\n';
      for (const file of finding.matchedFiles.slice(0, 10)) {
        markdown += `- \`${file.filename}\` — ${file.status}, +${file.additions}/-${file.deletions}, matched by ${file.reason}\n`;
      }

      if (finding.matchedFiles.length > 10) {
        markdown += `- ...and ${finding.matchedFiles.length - 10} more file(s)\n`;
      }

      markdown += '\n**Suggested QA checks:**\n\n';

      for (const check of finding.checks) {
        markdown += `- ${check}\n`;
      }

      markdown += '\n';
    }
  }

  markdown += '## Test coverage signal\n\n';

  if (analysis.changedTestFiles.length > 0) {
    markdown += '✅ Test-related files were changed in this PR.\n\n';
    markdown += 'Changed test files:\n\n';

    for (const file of analysis.changedTestFiles.slice(0, 10)) {
      markdown += `- \`${file.filename}\`\n`;
    }

    if (analysis.changedTestFiles.length > 10) {
      markdown += `- ...and ${analysis.changedTestFiles.length - 10} more test file(s)\n`;
    }

    markdown += '\n';
  } else if (analysis.changedProductionFiles.length > 0) {
    markdown += '⚠️ No changed test files were detected.\n\n';
    markdown += 'Consider adding or updating tests for the affected areas, especially if this PR changes business logic, auth, billing, checkout, or critical user flows.\n\n';
  } else {
    markdown += 'No production files were detected in this PR.\n\n';
  }

  if (analysis.largePr) {
    markdown += '## PR size signal\n\n';
    markdown += '⚠️ This PR changes more than 20 files. Large PRs are harder to review and usually deserve a more focused QA checklist.\n\n';
  }

  markdown += '---\n\n';
  markdown += '## Want a deeper AI QA review?\n\n';
  markdown += 'This free action is rule-based and does not send your code anywhere.\n\n';
  markdown += `For a deeper AI-powered PR audit with actionable bug risks and Playwright test suggestions, try QA Boutique Free PR Audit:\n\n`;
  markdown += `${freeAuditUrl}\n`;

  return markdown;
}

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const minRisk = normalizeRiskLevel(core.getInput('min-risk') || 'low');
    const includeLowRisk = core.getInput('include-low-risk') === 'true';
    const failOnHighRisk = core.getInput('fail-on-high-risk') === 'true';
    const freeAuditUrl = core.getInput('free-audit-url') || 'https://qaboutique.com/#free-pr-audit';

    const context = github.context;
    const pullRequest = context.payload.pull_request;

    if (!pullRequest) {
      const message = 'QA Boutique PR Risk Scanner only runs on pull_request events. No pull request context was found.';
      core.warning(message);

      await core.summary
        .addHeading('QA Boutique PR Risk Scanner')
        .addRaw(`${message}\n`)
        .write();

      core.setOutput('overall-risk', 'low');
      core.setOutput('risk-score', '0');
      core.setOutput('risk-areas', '');

      return;
    }

    const octokit = github.getOctokit(token);
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pullNumber = pullRequest.number;

    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100
    });

    const analysis = analyzeFiles(files);
    const visibleFindings = analysis.findings.filter((finding) =>
      shouldShowFinding(finding, minRisk, includeLowRisk)
    );

    const markdown = renderSummary({
      owner,
      repo,
      pullNumber,
      files,
      analysis,
      visibleFindings,
      freeAuditUrl
    });

    await core.summary.addRaw(markdown).write();

    core.setOutput('overall-risk', analysis.overallRisk);
    core.setOutput('risk-score', String(analysis.score));
    core.setOutput('risk-areas', analysis.findings.map((finding) => finding.id).join(','));

    if (analysis.overallRisk === 'high') {
      core.warning(`High PR risk detected. Risk score: ${analysis.score}`);
    }

    if (failOnHighRisk && analysis.overallRisk === 'high') {
      core.setFailed(`High PR risk detected. Risk score: ${analysis.score}`);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();