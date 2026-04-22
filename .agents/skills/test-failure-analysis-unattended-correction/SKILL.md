---
name: test-failure-analysis-unattended-correction
description: >-
  Use when a Playwright E2E test fails and you have a trace archive to investigate.
  Optionally accepts a GitHub Actions pipeline link for additional CI context.
  Runs non-interactively.
allowed-tools:
  # GitHub CLI — CI investigation, PR/issue/gist creation
  - Bash(gh run:*)
  - Bash(gh api:*)
  - Bash(gh pr:*)
  - Bash(gh issue:*)
  - Bash(gh gist:*)
  - Bash(gh label:*)
  # Project verification — read-only checks from package.json
  - Bash(pnpm lint:check)
  - Bash(pnpm format:check)
  - Bash(pnpm typecheck*)
  - Bash(pnpm svelte:check)
  # Git — read-only inspection
  - Bash(git status*)
  - Bash(git diff*)
  - Bash(git log*)
  - Bash(git remote*)
  - Bash(git branch*)
  # Git — branch and commit operations
  - Bash(git checkout*)
  - Bash(git add *)
  - Bash(git commit -m *)
  - Bash(git push -u origin *)
  # Artifact extraction
  - Bash(unzip:*)
  - Bash(mkdir -p *)
  # YAML validation
  - 'Bash(python3 -c "import yaml:*)'
  # Web search for upstream context
  - WebSearch
---

# Test Failure Analysis & Unattended Correction

## Overview

Orchestration meta-skill: dispatches parallel analysis agents against trace artifacts (and optionally CI logs), correlates findings, then proposes and implements fixes if the failure is test-side. Runs end-to-end without user interaction.

## When NOT to Use

- No trace file AND no GitHub Actions pipeline link (need at least one)
- Unit test failures (this is E2E/Playwright focused)

## Prerequisites

- **At least one of:**
  - Playwright trace archive — may be a nested zip (artifacts zip containing a `trace.zip` inside). Extract outer zip first, then locate the inner trace zip.
  - GitHub Actions pipeline link — enables CI log analysis. Sufficient on its own when tests never executed (e.g., infrastructure/setup failures).
- `gh` CLI installed and authenticated
- **Upstream targeting:** PRs and issues MUST be opened against the upstream repository (organizations `github.com/containers` or `github.com/podman-desktop`). Use `git remote -v` to identify the upstream remote. Do NOT open PRs or issues in user fork repositories.

## Tooling

- **Use dedicated tools over Bash equivalents:** prefer `Grep` over `bash grep/rg`, `Read` over `bash cat/head/tail`, `Glob` over `bash find/ls`. Reserve Bash for operations that require shell features (piping, unzip, git, gh).
- **Package manager:** this project uses **pnpm** (not npm/npx). Always use `pnpm` to run scripts. Available scripts are defined in the root `package.json` — read it to discover the correct commands.
- **Artifact handling:** CI artifacts expire (typically 90 days). When `gh run download` returns "no valid artifacts found", fall back to `gh api repos/{owner}/{repo}/actions/runs/{run_id}/logs` to download raw job logs as a zip.

## Configuration

| Variable | Default | Description                                                                                                                                                                |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOCAL`  | `false` | When `true`: skip draft PR creation, gist upload, and issue filing. Commit changes locally only. The user can test modifications directly and create a branch/PR manually. |

Set variables by including them when invoking the skill (e.g., `LOCAL=true`).

## Conventions

- **DATETIME** format throughout this skill: `YY-MM-DD_HH_mm_ss`. Derive the timestamp from the CI run time or the artifacts zip file metadata — not from when the skill executes.
- Trace zips from CI artifacts are typically nested (e.g., `results.zip` → `traces/trace.zip`). The inner `trace.zip` is `npx playwright show-trace` compatible.
- The outer artifacts zip also contains additional parseable files that agents should utilize for more accurate analysis:
  - `output.log` — full console output from the test run
  - `junit-*.xml` / `json-results.json` — structured test results (pass/fail/skip per test, durations, error messages)
  - `html-results/index.html` — rendered HTML test report
  - `**/error-context.md` — Playwright error context for failed tests
  - `scripts/tmp_stdout_*.txt` / `tmp_stderr_*.txt` — setup script output and errors
  - `*.log` files (e.g., `podman-machine-init.log`) — environment setup logs
  - `videos/` — test execution recordings (`.webm`)
- Artifacts can originate from CI or local runs. When no GH link is provided, note in the report that CI-side factors could not be ruled out.

## Sub-Agents

| Sub-Agent       | Skill                                                       | Input                                                                  | When                                             |
| --------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Trace Analyzer  | `playwright-trace-analysis`                                 | Inner trace zip + all supplementary files (see Conventions) → temp dir | Immediately                                      |
| CI Investigator | `investigate-gh-run`                                        | GH Actions pipeline link                                               | Parallel with #1 (only if link provided)         |
| Code Corrector  | brainstorming → writing-plans → subagent-driven-development | Analysis report                                                        | Only if failure is test-logic or pipeline-config |

## Execution Flow

1. Extract the artifacts zip into a temp folder. Locate the inner trace zip (typically under `traces/`). Dispatch Trace Analyzer immediately. If GH Actions link provided, dispatch CI Investigator in parallel.
2. Correlate findings from agent(s) to identify potential issues. If only trace data is available, note in the report that CI-side factors (runner resources, environment config) could not be ruled out.
3. Write analysis report → `docs/superpowers/analysis/DATETIME_analysis_report.md`
4. Write short and concise summary → `docs/superpowers/analysis/DATETIME_summary.md`
5. Decision point:

```dot
digraph correction_decision {
  "Findings correlated" -> "Failure cause?";
  "Failure cause?" -> "Dispatch Code Corrector" [label="test logic / pipeline config"];
  "Failure cause?" -> "Report only, end execution" [label="infra / external / flaky env"];
}
```

**If "Report only":** No further agent action. Reports remain as local files (do NOT commit them to git). _Future: send `DATETIME_summary.md` to Slack channel for visibility (CI instability notification)._ End execution here.

**If "Dispatch Code Corrector":** Continue with the following steps:

6. Code Corrector implements corrections (see Code Corrector Agent Instructions below).
7. Final verification:
   - Code review (superpowers:requesting-code-review) — high-confidence review of all changes
   - Run `pnpm typecheck` — no type errors introduced
   - Run `pnpm svelte:check` — no Svelte component errors introduced
   - Run `pnpm lint:check` — no lint errors introduced
   - Run `pnpm format:check` — no formatting violations introduced
   - **If any check fails:** launch a code-review sub-agent to diagnose, fix the issues, then re-run the failed checks. Max 3 fix-verify cycles. If still failing after 3 cycles, revert all code changes and follow the **Abort & Escalate** procedure (see below).
8. **If `LOCAL=true`:** commit changes locally only. Do not create a PR, gist, or issue. End execution — the user will test and create a branch/PR manually.
   **If `LOCAL=false` (default):** Create a **draft** PR via `gh pr create --draft`. Draft PRs prevent CI from firing on unattended changes — a human must review and mark ready before CI runs. Commits must be semantic — run `git log` to match the repository's commit message style. **Keep commit messages to a single subject line** (no body) — detailed context belongs in the PR description, not duplicated in the commit. **IMPORTANT:** Check for a PR template at `.github/PULL_REQUEST_TEMPLATE.md` (use `gh api repos/{owner}/{repo}/contents/.github/PULL_REQUEST_TEMPLATE.md` to fetch it). The PR body MUST follow the repository's PR template structure. Only code/pipeline changes are committed — reports are local-only files.
9. Create a **public** gist containing both files: `gh gist create --public docs/superpowers/analysis/DATETIME_summary.md docs/superpowers/analysis/DATETIME_analysis_report.md` — include the gist link in the PR body (under the analysis/reference section of the PR template). Do NOT post a separate PR comment — all context belongs in the PR description.
10. _Future: send `DATETIME_summary.md` to Slack channel (for internal CI integration)._

## Code Corrector Agent Instructions

When dispatched, this agent operates **fully non-interactively — no user interaction under any circumstances**.

**Max recursion depth: 3.** If after 3 iterations of spec review the code-review sub-agent still finds issues, proceed with the best version available and document remaining concerns in the analysis report.

1. Brainstorm corrections from the analysis report (superpowers:brainstorming — no user approval).
2. If uncertain at any point, spawn a `code-review` sub-agent to discuss the concern. Provide it with: the specific question, the relevant analysis report section, and the affected source files. The sub-agent acts as a peer reviewer — use its recommendation or pick the best suggestion. **Never surface questions to the user.**
3. Write spec → `docs/superpowers/specs/DATETIME_*.md` (superpowers:writing-plans).
4. Review spec (superpowers:requesting-code-review) — max 3 review iterations.
5. Write plan → `docs/superpowers/plans/DATETIME_*.md` (superpowers:writing-plans).
6. Execute plan (superpowers:subagent-driven-development).

**Note on test validation:** Re-running E2E tests is not feasible from this skill's execution environment. Instead, focus on high-confidence fixes validated through deep code review, compilation, lint, and format checks (Final verification step of Execution Flow).

## Abort & Escalate Procedure

When the skill cannot resolve issues after exhausting fix-verify cycles (step 7) or encounters an unrecoverable error:

1. Revert all code changes.
2. **If `LOCAL=true`:** document failures in the analysis report. End execution.
   **If `LOCAL=false` (default):**
3. Create a **public** gist with the analysis report, summary, and failure documentation: `gh gist create --public docs/superpowers/analysis/DATETIME_summary.md docs/superpowers/analysis/DATETIME_analysis_report.md`
4. Open a GitHub issue using the repository's bug report template (`.github/ISSUE_TEMPLATE/bug_report.yml`). Use `gh issue create` with appropriate labels — check available labels via `gh label list` and pick what fits (e.g., `area/tests`, `kind/bug`, `qe/test-case`). Include the gist link and a concise description of the failure and what was attempted.
5. Do not create a PR. End execution.
