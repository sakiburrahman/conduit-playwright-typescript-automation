# Playwright TypeScript Test Automation Framework

[![CI/CD](https://github.com/sakiburrahman/conduit-playwright-typescript-automation/actions/workflows/ci.yml/badge.svg)](https://github.com/sakiburrahman/conduit-playwright-typescript-automation/actions/workflows/ci.yml)

E2E and API automation for the web application, built with Playwright and TypeScript.

## Quick Start

Bootstrap the project, then run the full API + E2E suite:

```bash
./setup.sh
# or: npm run setup

./all-test-run.sh
# or: npm run test:all:headed:parallel

# or:

npm run precommit:check
```

| Script                                                                            | Purpose                                                                                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `setup.sh` / `npm run setup`                                                      | Install deps, Playwright browsers, `.env`, Husky hooks, sqlite3                                                      |
| `./all-test-run.sh` / `npm run test:all:run` / `npm run test:all:headed:parallel` | Full suite: API + articles/tags (Chrome headed, 8 workers), then settings (1 worker); merge reports and open locally |

> **Expected failure (by design):** `CONDUIT-TC-0019` — _Verify that invalid profile picture URL should not be accepted_ — uses Playwright `test.fail()` so the assertion still documents the product defect (invalid URL accepted → `/profile`), while the **suite / CI job can stay green**. Reports still show the case as an expected failure. If TC-0019 unexpectedly **passes**, CI fails — see [Known Gaps or Limitations](#known-gaps-or-limitations).
>
> **Intentional skip (by design):** `CONDUIT-TC-0020` — _Verify that an invalid email address can not be accepted and the user can not update settings_ — is **`test.skip`’d** so Playwright HTML / Allure / Ortoni **include a Skipped row** in the consolidated report. Re-enable the test when validating invalid-email rejection on the web application.

## Prerequisites

| Requirement  | Details                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**  | **18+** required · **24** recommended (matches local / CI)                                                                        |
| **npm**      | **9+** (current verified: **11.7**)                                                                                               |
| **Git**      | Clone, hooks (`husky` / `prepare`)                                                                                                |
| **OS**       | macOS, Linux, or Windows (bash / Git Bash for `./setup.sh` and `./all-test-run.sh`)                                               |
| **Browsers** | Installed by `./setup.sh` (Chromium by default; Chrome used headed locally). Use `./setup.sh --browsers-all` for Firefox + WebKit |
| **Network**  | Access to the web application UI + API (`conduit.bondaracademy.com` / `conduit-api.bondaracademy.com`)                            |

### Optional

| Tool                          | Why                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| **Java (JRE 8+)**             | Required by Allure CLI to generate/open the Allure HTML report                        |
| **Google Chrome**             | Headed Chrome channel (`channel: "chrome"`); Playwright Chromium is used for headless |
| **Build tools for `sqlite3`** | Needed if Ortoni native bindings fail (`npm run rebuild:sqlite3`)                     |

Verify locally:

```bash
node -v    # v24.9.0 (18+ required; 24 recommended)
npm -v     # 11.7.0 (9+ required)
git --version   # 2.48.1+
```

Then bootstrap with `./setup.sh` (see [Installation](#installation)).

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Assignment Scope](#assignment-scope)
- [Framework Overview](#framework-overview)
- [Architecture](#architecture)
- [Implementation Strategy](#implementation-strategy)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Create the `.env` file](#create-the-env-file)
  - [Runtime Parameters](#runtime-parameters)
- [Running Tests](#running-tests)
  - [Serial vs parallel execution](#serial-vs-parallel-execution)
  - [Note: `DYNAMIC_USER` on suite scripts](#note-dynamic_user-on-suite-scripts)
- [Test Tags](#test-tags)
- [Test Coverage](#test-coverage)
- [Reports and Traceability](#reports-and-traceability)
- [Project Structure](#project-structure)
- [GitHub Actions CI/CD](#github-actions-cicd)
- [Troubleshooting](#troubleshooting)
- [Responsible Use of AI](#responsible-use-of-ai)
- [Submission Instructions](#submission-instructions)
- [Known Gaps or Limitations](#known-gaps-or-limitations)

## Assignment Scope

Required positive scenarios:

1. **Create New Article** — UI create, Article Details + Global Feed validation
2. **Edit Article** — API create as precondition, UI edit and validation
3. **Delete Article** — API create as precondition, UI delete and absence validation
4. **Filter Articles by Tag** — unique tag filtering in the feed
5. **Update User Settings** — reversible profile updates (one worker)

Negative coverage includes blank required fields, duplicate title, spaces-only username, invalid image/email values, empty tag filter, and non-author Edit/Delete controls.

## Framework Overview

| Capability        | Details                                             |
| ----------------- | --------------------------------------------------- |
| Application       | The web application                                 |
| UI URL            | `https://conduit.bondaracademy.com`                 |
| API URL           | `https://conduit-api.bondaracademy.com`             |
| Language          | TypeScript                                          |
| Test runner       | Playwright Test                                     |
| Architecture      | Page Locators, Page Actions, fixtures, API helpers  |
| Environments      | `DEV`, `QA`, `UAT`                                  |
| Authentication    | Generated or configured run-level user              |
| Session reuse     | Playwright storage state + JWT bootstrap            |
| Default execution | Parallel (`PARALLEL` default `true`, **8 workers**) |
| Single execution  | `PARALLEL=false` with one worker                    |
| Browsers          | Chrome (headed)/Chromium, Firefox, WebKit           |
| Test data         | Faker (`@faker-js/faker`)                           |
| Reports           | Playwright HTML, Allure, Ortoni + timestamp history |
| CI/CD             | GitHub Actions                                      |

## Architecture

### Layered design

```
┌─────────────────────────────────────────────────────────────────┐
│  npm scripts / setup.sh / all-test-run.sh                       │
│  (Chrome|Firefox · headed|headless · serial|parallel · workers) │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  playwright.config.ts                                            │
│  Projects: user-setup → (api | e2e)                              │
│  Reporters: line, HTML, Allure, Ortoni, custom my-reporter       │
└───────────────────────────────┬─────────────────────────────────┘
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
┌──────────────────────┐                  ┌──────────────────────┐
│  tests/api-tests     │                  │  tests/e2e-tests     │
│  APIRequestContext   │                  │  Page + storageState │
└──────────┬───────────┘                  └──────────┬───────────┘
           │                                         │
           ▼                                         ▼
┌──────────────────────┐                  ┌──────────────────────┐
│  src/utils/          │                  │  pageActions →       │
│  api-helper.ts       │                  │  pageLocators        │
└──────────────────────┘                  └──────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  fixtures (generatedUser, authToken, page actions)               │
│  global-setup → auth.json + generated-user.json                  │
│  global-teardown → Allure + history/<RUN_ID>/ + open latest (standalone) │
│  Multi-phase: teardown skips finalize; all-test-run.sh merges once       │
└─────────────────────────────────────────────────────────────────┘
```

### Runtime flow

1. **`user-setup`** (`src/common/global-setup.ts`): prepare report dirs, register or load user (`DYNAMIC_USER`), validate identity, write `playwright/.auth/auth.json`.
2. **`api` / `e2e`**: depend only on `user-setup`. E2E injects storage state; fixtures refresh JWT for API calls on UI pages when needed.
3. **Teardown** (`src/common/global-teardown.ts`): for **standalone** runs, generate Allure, archive under `test-results/history/<RUN_ID>/{playwright,allure,ortoni}-report/`, and open reports locally. For **multi-phase** (`./all-test-run.sh` / `MULTI_PHASE_RUN=true`), teardown skips finalize — the shell script merges once after all phases.

### Module map

| Path                                                                            | Responsibility                                                              |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `setup.sh` / `npm run setup`                                                    | One-shot install: deps, browsers, `.env`, husky, sqlite3                    |
| `all-test-run.sh` / `npm run test:all:run` / `npm run test:all:headed:parallel` | Full API+E2E (Chrome headed, 8 workers; settings @ 1); merge + open reports |
| `src/pageLocators/`                                                             | Semantic UI locators only                                                   |
| `src/pageActions/`                                                              | Business actions + assertions                                               |
| `src/common/fixtures/customFixtures.ts`                                         | `generatedUser`, `authToken`, page-action fixtures                          |
| `src/common/global-setup.ts`                                                    | Auth bootstrap + report prepare                                             |
| `src/common/global-teardown.ts`                                                 | Standalone Allure / history / open; skipped on multi-phase                  |
| `src/config/environment/`                                                       | `.env`, `envConfig` (ENV / PARALLEL / WORKERS / HEADLESS)                   |
| `src/config/browser/`                                                           | Desktop Chrome/Firefox/Safari (+ headed Chrome channel)                     |
| `src/config/defaultConfig/`                                                     | Timeouts, runtime defaults, `merge-reports.config.ts`                       |
| `src/utils/api-helper.ts`                                                       | Auth / Articles API helpers + JWT browser state                             |
| `src/utils/data-generator.ts`                                                   | Faker users/articles/tags                                                   |
| `src/utils/reports-helper.ts`                                                   | Paths, reporters, clean / merge / archive / open                            |
| `tests/api-tests/`                                                              | Create-article API (`CONDUIT-TC-0001`–`0003`)                               |
| `tests/e2e-tests/articles/`                                                     | Create / edit / delete / filter (`0004`–`0015`)                             |
| `tests/e2e-tests/settings/`                                                     | Settings suite (`0016`–`0020`, `@E2ESettings`)                              |
| `playwright/.auth/`                                                             | Runtime auth (gitignored)                                                   |
| `test-results/`                                                                 | Latest reports + `history/` + artifacts                                     |

Playwright projects: **`user-setup` → `api` | `e2e`** (API and E2E each depend on `user-setup` only). Parallel default **8 workers** for `./all-test-run.sh`. `maxFailures: 0` keeps the suite running after a fail/skip so remaining tests still execute.

## Implementation Strategy

### Hybrid UI and API Testing

The framework uses a hybrid UI and API testing strategy. UI automation validates user workflows, navigation, visible feedback, redirects, and displayed application state. API utilities support authentication, deterministic test setup, persistence validation, authorization checks, and cleanup. This approach improves speed, reliability, isolation, and maintainability without bypassing the business workflow under test.

### Scenario Implementation Logic

#### Create Article (`CONDUIT-TC-0004`)

1. Generate unique article data with Faker.
2. Create the article through the New Article UI.
3. Validate redirect to Article Details.
4. Validate title, body, tags, and author on Article Details.
5. Open Global Feed and locate the card by unique title.
6. Validate title, description, tags, and author on the feed card.
7. Delete the article during cleanup (UI).

The Global Feed card does not display the full article body. The body is validated on the Article Details page.

#### Edit Article (`CONDUIT-TC-0009`)

1. Create an article through the **API** as a precondition.
2. Open the article through the UI.
3. Edit title, description, body, and tags through the UI.
4. Validate updated data on Article Details and Global Feed.
5. Verify backend persistence with `GET` article by slug.
6. Delete the article via API during cleanup.

#### Delete Article (`CONDUIT-TC-0012`)

1. Create an article through the **API** as a precondition.
2. Open and delete the article through the UI.
3. Wait for feed load after delete.
4. Validate absence from the author profile.
5. Confirm absence through the API (`404` / `422`).

#### Filter Articles by Tag (`CONDUIT-TC-0014` / `0015`)

1. Generate unique tags and create matching/unrelated articles through the UI.
2. Select the tag in the UI and validate the active tag / URL.
3. Assert matching card tags; treat unrelated cards according to the web application UI behavior.
4. For an unused tag, open `/?tag=` and assert empty state or no matching tag on visible cards.
5. Clean up created articles after the positive case.

#### Update User Settings (`CONDUIT-TC-0016`–`0020`)

1. Capture baseline identity from the generated user.
2. Update password (old login fails, new succeeds) or username through Settings UI.
3. For username updates, validate the Profile page heading and navbar username.
4. Restore original settings.
5. Settings tests run with **one worker** because they mutate shared user state.
6. **`CONDUIT-TC-0019` (invalid profile picture URL)** — **expected to fail** via `test.fail()`. The web application still accepts the invalid URL; the test documents that defect. Suite/CI remain green while the failure is expected; unexpected **pass** fails CI.
7. **`CONDUIT-TC-0020` (invalid email)** — **intentionally SKIPPED** (`test.skip`) so consolidated reports include a **Skipped** result. Re-enable when validating invalid-email rejection — see [Known Gaps or Limitations](#known-gaps-or-limitations).

### QA-Driven Assertions

Assertions cover element visibility, button/input state, form values, active feed/navigation, redirect URLs, article title/description/body/tags/author, user settings, validation messages, API status codes and fields, persistence after reload, deleted-resource behavior, and absence of stale data.

Prefer Playwright auto-retrying assertions:

```ts
await expect(locator).toBeVisible();
await expect(locator).toHaveText(expectedText);
await expect(locator).toHaveValue(expectedValue);
await expect(page).toHaveURL(expectedUrl);
```

### Authentication and Session Reuse

#### Note: `DYNAMIC_USER=true` vs `DYNAMIC_USER=false`

| Flag                              | When                                | What happens                                                                                                                                          |
| --------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`DYNAMIC_USER=true`** (default) | All `test:all:*` / `test:dev:chrome | firefox:*`/`./all-test-run.sh` scripts — **serial or parallel**, **headed or headless**                                                               | **Every run signs up a new user** (Faker + API register). No `*_EMAIL` / `*_USERNAME` / `*_PASSWORD` needed in `.env`. |
| **`DYNAMIC_USER=false`**          | Manual override only                | Login with fixed credentials from `.env`. You must sign up that account in the UI first and set `DEV_*` / `QA_*` / `UAT_*` email, username, password. |

`package.json` hard-codes `DYNAMIC_USER=true` on every full-suite and Chrome/Firefox suite script. Headed vs headless and serial vs parallel do **not** change auth — a new user is still created each time.

After signup, setup saves Playwright storage state; E2E tests inject a fresh JWT per test (`createAuthenticatedBrowserState`).

Runtime files (gitignored):

```text
playwright/.auth/
├── auth.json
├── env-marker.txt
└── generated-user.json
```

Authentication files are ignored by Git. Passwords and tokens must not be printed. Authentication files must not be uploaded as CI artifacts.

### Dynamic Test Data

Faker generates username, email, password, article title/description/body/tags, and settings values. Timestamps and random suffixes reduce parallel collisions.

Overrides are supported:

```ts
generateRandomArticle({ title: "" });
generateRandomArticle({ title: "Custom title" });
```

### Test Isolation and Cleanup

- Each article test owns its data; titles and tags are unique.
- Tests do not depend on execution order.
- Edit/Delete track API-created resources and clean them up (tolerating already-deleted resources).
- Settings tests restore original values where required.
- Cleanup failures must not hide the original assertion failure.

### Locator and Synchronization Strategy

Preferred locator order: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → scoped stable CSS.

Uses Playwright auto-waiting, URL waits, and state-based checks. No `waitForTimeout`. CI retries (`retries: 2`) do not replace fixing flaky design. Failures retain screenshot, video, and trace.

## Installation

```bash
git clone https://github.com/sakiburrahman/conduit-playwright-typescript-automation.git
cd conduit-playwright-typescript-automation

# Recommended one-shot bootstrap
./setup.sh
# or: npm run setup
# Full browser set (Chromium + Firefox + WebKit):
# ./setup.sh --browsers-all

# Manual equivalent
npm install
npx playwright install --with-deps chromium firefox
cp src/config/environment/.env.example src/config/environment/.env
npm run prepare
npm run rebuild:sqlite3   # if Ortoni / sqlite3 bindings fail
```

Before committing, run:

```bash
npm run prepare
npm run format
npm run lint
# or: npm run precommit:check
```

## Configuration

### Create the `.env` file

Base URLs live in `src/config/environment/.env` (gitignored). Create it from the example:

```bash
./setup.sh
# or: cp src/config/environment/.env.example src/config/environment/.env
```

Default shape (**URLs only** — enough for `DYNAMIC_USER=true`):

```env
DEV_BASEURL=https://conduit.bondaracademy.com
DEV_API_BASE_URL=https://conduit-api.bondaracademy.com

QA_BASEURL=https://conduit.bondaracademy.com
QA_API_BASE_URL=https://conduit-api.bondaracademy.com

UAT_BASEURL=https://conduit.bondaracademy.com
UAT_API_BASE_URL=https://conduit-api.bondaracademy.com
```

| Keys                                    | Required?                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------- |
| `*_BASEURL` / `*_API_BASE_URL`          | **Yes**                                                                   |
| `*_EMAIL` / `*_USERNAME` / `*_PASSWORD` | **No** when `DYNAMIC_USER=true` (default). Only for `DYNAMIC_USER=false`. |

#### Dynamic user vs fixed credentials

| Mode                     | What you do                                                 | What the framework does                                     |
| ------------------------ | ----------------------------------------------------------- | ----------------------------------------------------------- |
| **`DYNAMIC_USER=true`**  | Keep `.env` URLs only                                       | **New signup every run** (parallel/serial, headed/headless) |
| **`DYNAMIC_USER=false`** | Uncomment/fill credentials in `.env` after manual UI signup | Login with that fixed account                               |

```env
# Only if DYNAMIC_USER=false:
DEV_EMAIL=my-dev-user@example.com
DEV_USERNAME=MyDevUser
DEV_PASSWORD=MySecurePassword
```

Do not commit `.env`. Only `.env.example` belongs in git.

Optional email after a full suite / CI merge (see [GitHub Actions CI/CD](#github-actions-cicd)):

```env
SEND_EMAIL_TO_USER=true
SEND_EMAIL_TO_USER_EMAIL=you@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@example.com
SMTP_PASS=your-app-password
SMTP_FROM=you@example.com
```

### Runtime Parameters

Defaults in `src/config/defaultConfig/testConfig.ts` (`runtimeDefaults`):

| Setting           | Default | Env            |
| ----------------- | ------- | -------------- |
| `dynamicUser`     | `true`  | `DYNAMIC_USER` |
| `headless`        | `false` | `HEADLESS`     |
| `parallel`        | `true`  | `PARALLEL`     |
| `parallelWorkers` | `8`     | `WORKERS`      |

| Variable       | Purpose                                                   |
| -------------- | --------------------------------------------------------- |
| `ENVIRONMENT`  | `DEV` / `QA` / `UAT`                                      |
| `TEST_TYPE`    | `e2e` / `api`                                             |
| `BROWSER`      | `DesktopChrome`, `DesktopFirefox`, `DesktopSafari`, …     |
| `PARALLEL`     | `true` = parallel workers; `false` = serial (1 worker)    |
| `WORKERS`      | Worker count when `PARALLEL=true` (default **8**)         |
| `HEADLESS`     | `true` / `false` (independent of parallel mode)           |
| `DYNAMIC_USER` | `true` = new signup each run; `false` = fixed `.env` user |

### Security and Gitignore

Do not commit `.env`, `playwright/.auth/`, `test-data/create-user.json`, or `test-data/created-article.json`.

## Running Tests

By default, browser suites target **Google Chrome**. After a **standalone** run, teardown generates Allure, archives under `test-results/history/<RUN_ID>/{playwright,allure,ortoni}-report/`, and opens Playwright HTML + Allure + Ortoni locally (skip with `OPEN_REPORTS=false` or on CI). Multi-phase suites (`./all-test-run.sh`) merge once after all phases — see [Reports and Traceability](#reports-and-traceability).

### Serial vs parallel execution

Execution mode is controlled by `PARALLEL` and `WORKERS` (via npm script names or env), resolved in `envConfig.resolveExecutionConfig()` and applied in `playwright.config.ts`.

| Mode         | How it works                                               | Auth (`DYNAMIC_USER`)                                                                |
| ------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Parallel** | `PARALLEL=true` → `fullyParallel: true`, `workers` ≤ **8** | Default scripts: **new signup** (`DYNAMIC_USER=true`); use `*:fixed` for `.env` user |
| **Serial**   | `PARALLEL=false` → `workers: 1`                            | Same auth options as parallel                                                        |

#### Note: `DYNAMIC_USER` on suite scripts

Most full-suite / Chrome / Firefox runners set `DYNAMIC_USER=true` (new signup every run). Use `test:all:{dev|qa|uat}:headed:parallel:fixed` when you need `DYNAMIC_USER=false` with credentials from `.env`.

| Script                                      | Env | Headless | Parallel | Workers | Dynamic user                              |
| ------------------------------------------- | --- | -------- | -------- | ------- | ----------------------------------------- |
| `test:all:run` / `test:all:headed:parallel` | DEV | no       | yes      | 8       | **true** (new signup)                     |
| `test:all:dev:headed:parallel:fixed`        | DEV | no       | yes      | 8       | **false** (`DEV_*` credentials)           |
| `test:all:qa:headed:parallel:fixed`         | QA  | no       | yes      | 8       | **false** (`QA_*` credentials)            |
| `test:all:uat:headed:parallel:fixed`        | UAT | no       | yes      | 8       | **false** (`UAT_*` credentials)           |
| `test:all:headed:parallel:fixed`            | DEV | no       | yes      | 8       | alias → `test:all:dev:…:fixed`            |
| `test:all:headed:serial`                    | DEV | no       | no       | 1       | **true**                                  |
| `test:all:headless:parallel`                | DEV | yes      | yes      | 8       | **true**                                  |
| `test:all:headless:serial`                  | DEV | yes      | no       | 1       | **true**                                  |
| `test:all:firefox:headed:parallel`          | DEV | no       | yes      | 8       | **true**                                  |
| `test:all:firefox:headed:serial`            | DEV | no       | no       | 1       | **true**                                  |
| `test:all:firefox:headless:parallel`        | DEV | yes      | yes      | 8       | **true**                                  |
| `test:all:firefox:headless:serial`          | DEV | yes      | no       | 1       | **true**                                  |
| `test:dev:chrome:headed:parallel`           | DEV | no       | yes      | 8       | **true**                                  |
| `test:dev:chrome:headed:serial`             | DEV | no       | no       | 1       | **true**                                  |
| `test:dev:chrome:headless:parallel`         | DEV | yes      | yes      | 8       | **true**                                  |
| `test:dev:chrome:headless:serial`           | DEV | yes      | no       | 1       | **true**                                  |
| `test:dev:firefox:headed:parallel`          | DEV | no       | yes      | 8       | **true**                                  |
| `test:dev:firefox:headed:serial`            | DEV | no       | no       | 1       | **true**                                  |
| `test:dev:firefox:headless:parallel`        | DEV | yes      | yes      | 8       | **true**                                  |
| `test:dev:firefox:headless:serial`          | DEV | yes      | no       | 1       | **true**                                  |
| `./all-test-run.sh` (bare)                  | DEV | no       | yes      | 8       | **true** (via `test:all:headed:parallel`) |

To run the full suite headed + parallel with a **fixed** `.env` account:

```bash
# DEV — requires DEV_EMAIL / DEV_USERNAME / DEV_PASSWORD
npm run test:all:dev:headed:parallel:fixed

# QA — requires QA_EMAIL / QA_USERNAME / QA_PASSWORD
npm run test:all:qa:headed:parallel:fixed

# UAT — requires UAT_EMAIL / UAT_USERNAME / UAT_PASSWORD
npm run test:all:uat:headed:parallel:fixed
```

**Rules:**

- Script names encode the mode: `*:serial` → `PARALLEL=false`; `*:parallel` → `PARALLEL=true` with **`WORKERS=8`** (hard cap **8**).
- Each E2E test gets a **fresh BrowserContext + Page**; only run-level `storageState` is reused, plus a per-test JWT inject.
- Settings always run with **1** worker after the parallel phases (shared run-level user mutations).
- `HEADLESS` does not change worker count or auth mode.
- Boolean env values must be the strings `true` / `false`.
- Override workers: `WORKERS=5 ./all-test-run.sh` (still capped at 8).

**Examples:**

```bash
# Full suite — DYNAMIC_USER=true in package.json (except *:fixed)
npm run test:all:headed:serial
npm run test:all:headed:parallel
npm run test:all:headless:serial
npm run test:all:headless:parallel
npm run test:dev:chrome:headed:parallel

# Full suite headed + parallel with fixed .env user
npm run test:all:dev:headed:parallel:fixed
npm run test:all:qa:headed:parallel:fixed
npm run test:all:uat:headed:parallel:fixed

# API or article/tag E2E only (settings excluded on purpose)
npm run test:dev:api:serial
npm run test:dev:e2e:chrome:headed:serial
npm run test:dev:e2e:chrome:headed:parallel

# Override workers for a full parallel suite
WORKERS=8 npm run test:all:headed:parallel
```

**Settings exception:** `@E2ESettings` specs mutate the shared run-level user. Always run them with one worker (`PARALLEL=false` / `--workers=1`), for example:

```bash
npm run test:dev:e2e:chrome:settings
```

`test:all:*` and `test:dev:chrome:*` / `test:dev:firefox:*` call `all-test-run.sh`: API + article/tag E2E (parallel or serial per script), then settings alone with `1` worker. Do not use a single `playwright test` with `--grep-invert=@E2ESettings` if you expect the full suite.

### Shell helpers

```bash
./setup.sh
./all-test-run.sh
npm run setup
npm run test:all:run
npm run test:all:headed:parallel
npm run precommit:check
```

### Chrome Test Commands

```bash
npm run test:all:headed:serial
npm run test:all:headed:parallel
npm run test:all:headless:serial
npm run test:all:headless:parallel
```

### Firefox Test Commands

```bash
npm run test:all:firefox:headed:serial
npm run test:all:firefox:headed:parallel
npm run test:all:firefox:headless:serial
npm run test:all:firefox:headless:parallel
```

### Run a Single Test File

Use an E2E-only or API-only script (not `test:all:*` / `test:dev:chrome:*`, which run the full multi-phase suite). Append the file path after `--`.

**Chrome articles/tags:**

```bash
npm run test:dev:e2e:chrome:headed:parallel -- tests/e2e-tests/articles/test-e2e-filter-articles-by-tag.spec.ts
```

**Firefox articles/tags:**

```bash
npx cross-env ENVIRONMENT=DEV DYNAMIC_USER=true BROWSER=DesktopFirefox HEADLESS=false PARALLEL=false \
  npx playwright test --project=e2e --grep-invert=@E2ESettings \
  tests/e2e-tests/articles/test-e2e-filter-articles-by-tag.spec.ts
```

### Settings Tests

Settings specs mutate the shared auth user; prefer one worker:

```bash
npm run test:settings
npm run test:dev:e2e:chrome:settings:headless
npm run test:dev:e2e:chrome:settings:ui
```

`CONDUIT-TC-0019` (invalid profile picture URL) is **expected to fail** on the current web application. `CONDUIT-TC-0020` (invalid email) is **intentionally skipped** so reports show Skipped — see [Known Gaps or Limitations](#known-gaps-or-limitations).

### API-Only / UI Mode / Debug

```bash
npm run test:dev:api
npm run test:dev:api:parallel
npm run test:dev:api:serial
npm run test:ui
npm run test:debug
```

### Environment-Specific Execution

```bash
npm run test:qa:e2e:chrome
npm run test:qa:api
npm run test:uat:e2e:chrome
npm run test:uat:api
```

### Run by Test ID or Tag

```bash
npx playwright test --grep="CONDUIT-TC-0004" --project=e2e
npx playwright test --grep="@CreateArticle" --project=e2e
npx playwright test --grep="@E2ESettings" --project=e2e --workers=1
```

## Test Tags

From `src/common/enums/testTags.ts`:

| Tag                                                  | Purpose               |
| ---------------------------------------------------- | --------------------- |
| `@E2EPositiveTest` / `@E2ENegativeTest`              | E2E outcome           |
| `@E2ERegressionTest`                                 | Regression marker     |
| `@APIPositiveTest` / `@APINegativeTest`              | API outcome           |
| `@E2EArticleTest`                                    | Article feature       |
| `@E2EFilterByTag`                                    | Tag filter            |
| `@E2ESettings`                                       | Settings (one worker) |
| `@CreateArticle` / `@EditArticle` / `@DeleteArticle` | Scenario filters      |

Parallel vs single-worker execution is controlled with `PARALLEL` / `WORKERS`, not tags.

```bash
npx playwright test --grep="@E2EPositiveTest" --project=e2e
npx playwright test --grep="@E2ENegativeTest" --project=e2e
npx playwright test --grep="@APIPositiveTest" --project=api
npx playwright test --grep="@APINegativeTest" --project=api
npx playwright test --grep="@CreateArticle" --project=e2e
npx playwright test --grep="@EditArticle" --project=e2e
npx playwright test --grep="@DeleteArticle" --project=e2e
npx playwright test --grep="@E2ESettings" --project=e2e --workers=1
```

## Test Coverage

### Coverage Matrix

| Feature         | Positive                   | Negative                                                                                                      | UI  | API                         |
| --------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- | --- | --------------------------- |
| Create Article  | Valid UI creation          | Blank title/description/body; duplicate title                                                                 | Yes | Create API suite            |
| Edit Article    | UI edit after API setup    | Blank title; non-author controls hidden                                                                       | Yes | Setup, persistence, cleanup |
| Delete Article  | UI delete after API setup  | Non-author controls hidden                                                                                    | Yes | Setup, absence, cleanup     |
| Filter by Tag   | Matching unique tag        | Unused tag / no matches                                                                                       | Yes | —                           |
| Update Settings | Reversible username update | Spaces-only username; invalid image (**TC-0019 expected fail**); invalid email (**TC-0020 intentional skip**) | Yes | Identity via setup user     |

### API Tests

| ID              | Title                                                                           | Type                        |
| --------------- | ------------------------------------------------------------------------------- | --------------------------- |
| CONDUIT-TC-0001 | Verify that an authenticated user can create a new article with a valid payload | Positive `@APIPositiveTest` |
| CONDUIT-TC-0002 | Verify that article creation is rejected when the request is unauthorized       | Negative `@APINegativeTest` |
| CONDUIT-TC-0003 | Verify that article creation is rejected when the token is invalid              | Negative `@APINegativeTest` |

### E2E Article Tests

| ID              | Title                                                                                                                        | Type                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| CONDUIT-TC-0004 | Verify that an authenticated user can create an article and validate its details in the Global Feed and Article Details page | Positive `@CreateArticle`  |
| CONDUIT-TC-0005 | Verify that article creation is rejected when the title is blank                                                             | Negative `@CreateArticle`  |
| CONDUIT-TC-0006 | Verify that article creation is rejected when the description is blank                                                       | Negative `@CreateArticle`  |
| CONDUIT-TC-0007 | Verify that article creation is rejected when the body is blank                                                              | Negative `@CreateArticle`  |
| CONDUIT-TC-0008 | Verify that article creation is rejected when the title is a duplicate                                                       | Negative `@CreateArticle`  |
| CONDUIT-TC-0009 | Verify that an authenticated user can edit an article and validate the updated details in the Global Feed                    | Positive `@EditArticle`    |
| CONDUIT-TC-0010 | Verify that article editing is rejected when the title is blank                                                              | Negative `@EditArticle`    |
| CONDUIT-TC-0011 | Verify that Edit and Delete article buttons are hidden for non-authors                                                       | Negative `@EditArticle`    |
| CONDUIT-TC-0012 | Verify that an authenticated user can delete an article                                                                      | Positive `@DeleteArticle`  |
| CONDUIT-TC-0013 | Verify that Edit and Delete article buttons are hidden for non-authors                                                       | Negative `@DeleteArticle`  |
| CONDUIT-TC-0014 | Verify that the feed filters to matching tagged articles only                                                                | Positive `@E2EFilterByTag` |
| CONDUIT-TC-0015 | Verify that no articles are shown for a tag with zero matches                                                                | Negative `@E2EFilterByTag` |

### E2E Settings Tests

| ID              | Title                                                                                                 | Type                    | Expected result                 |
| --------------- | ----------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------- |
| CONDUIT-TC-0016 | Verify that a user can update existing password                                                       | Positive `@E2ESettings` | Pass                            |
| CONDUIT-TC-0017 | Verify that a user can update existing username                                                       | Positive `@E2ESettings` | Pass                            |
| CONDUIT-TC-0018 | Verify that Update Settings does not update the username when the username field contains only spaces | Negative `@E2ESettings` | Pass                            |
| CONDUIT-TC-0019 | Verify that invalid profile picture URL should not be accepted                                        | Negative `@E2ESettings` | **Expected fail (`test.fail`)** |
| CONDUIT-TC-0020 | Verify that an invalid email address can not be accepted and the user can not update settings         | Negative `@E2ESettings` | **SKIP (intentional)**          |

### CONDUIT-TC-0019 — expected failure (intentional)

| Item                        | Detail                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------- |
| **Marked with**             | Playwright `test.fail(...)` + annotation `expected-fail`                            |
| **Why the assertion fails** | The web application accepts an invalid profile image URL and leaves Settings        |
| **Suite / CI**              | Stays green while the failure is expected; **unexpected pass** fails the job        |
| **Reports**                 | Still show the case as failed/expected-failed so the product defect remains visible |

Do not remove `test.fail` just to “clean” the report. If the web application starts rejecting invalid URLs, remove `test.fail` and keep the assertions.

### CONDUIT-TC-0020 — intentional skip (report visibility)

| Item                  | Detail                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**             | Verify that an invalid email address can not be accepted and the user can not update settings                                                                  |
| **Status in suite**   | `test.skip` with annotation `intentional-skip`                                                                                                                 |
| **Why it is skipped** | Kept skipped **on purpose** so consolidated Playwright HTML / Allure / Ortoni reports **include a Skipped case** (proves skipped tests are merged and visible) |
| **Report outcome**    | **Skipped** = correct / expected for this suite configuration                                                                                                  |
| **How to re-enable**  | Change `test.skip(` back to `test(` in `tests/e2e-tests/settings/test-e2e-update-user-settings.spec.ts` when validating invalid-email rejection on the app     |

Skipped tests appear in reports but do **not** fail the shell exit code unless Playwright itself exits non-zero.

## Reports and Traceability

Configured reporters: Playwright HTML, Allure, Ortoni (skipped when `sqlite3` bindings are unavailable).

On failure: screenshot, video, and trace are retained (`only-on-failure` / `retain-on-failure`) and attached to the failed test in **Playwright HTML**, **Allure**, and **Ortoni**.

### Why multi-phase reporting works this way

Settings tests (`@E2ESettings`) mutate the **same generated user** (password / username), so they cannot run safely in the same parallel pool as article tests. `./all-test-run.sh` therefore uses **three Playwright processes**:

| Phase | Scope                                            | Workers                   | Tests (approx.) |
| ----- | ------------------------------------------------ | ------------------------- | --------------- |
| 1     | API (`--project=api`)                            | up to 8                   | 3               |
| 2     | Articles/tags E2E (`--grep-invert=@E2ESettings`) | up to 8 · `fullyParallel` | 12              |
| 3     | Settings E2E                                     | **1** · serial            | 5               |

Total: **20** tests. Each process would otherwise wipe shared report folders, so the runner:

1. Cleans shared outputs **once** at the start (`npm run reports:prepare`)
2. Writes **phase-scoped raw** outputs (Playwright blob ZIP + Allure results)
3. **Merges after all phases** (`npm run reports:merge`) → one Playwright HTML + one Allure + one Ortoni (with meta: `API & E2E` / `all-tests`)
4. Archives under **one** `test-results/history/<RUN_ID>/` folder
5. Opens each final report **once** locally (`CI=true` skips open)

Failed phases do not skip later phases or report merge.

### Directory layout

```
test-results/
├── raw/
│   ├── playwright-blob/{api,e2e-articles,e2e-settings}/
│   └── allure/{api,e2e-articles,e2e-settings}/
├── playwright-report/          # final merged HTML
├── allure-result/              # consolidated raw Allure
├── allure-report/              # final Allure HTML
├── ortoni-report/              # final Ortoni HTML (from blob merge + meta)
├── artifacts/
└── history/<RUN_ID>/
    ├── playwright-report/
    ├── allure-report/
    └── ortoni-report/
```

**Playwright merge:** `npx playwright merge-reports --config src/config/defaultConfig/merge-reports.config.ts <blob-staging>`
**Allure merge:** copy phase `raw/allure/*` into `allure-result/` (no silent overwrite) → `allure generate` once  
**Ortoni merge:** `ortoni-report merge-report` when `ortoni-shard-*.json` exist; otherwise Ortoni is generated during blob merge (Ortoni’s CLI only merges Playwright **shards**, not separate processes). Merged Ortoni includes **Meta Information** (Project, Environment, Browser, Parallel, Workers, Dynamic User, Report Phase, Author).

### After every local multi-phase run

```
Latest Allure:          test-results/allure-report/
Latest Ortoni:          test-results/ortoni-report/
Latest Playwright HTML: test-results/playwright-report/
History:                test-results/history/<RUN_ID>/
```

Exit code is **non-zero** if any test phase or required report step failed; skipped tests alone are not a shell failure unless Playwright exits non-zero.

Stop leftover report viewers:

```bash
# Playwright HTML (default 9323)
kill "$(cat logs/playwright-report-server.pid 2>/dev/null)" 2>/dev/null || true
lsof -ti :9323 | xargs kill 2>/dev/null || true

# Allure / Ortoni launchers written by all-test-run.sh
kill "$(cat logs/allure-launcher.pid 2>/dev/null)" 2>/dev/null || true
kill "$(cat logs/ortoni-launcher.pid 2>/dev/null)" 2>/dev/null || true
```

If opening the Playwright report fails with `EADDRINUSE` on port **9323**, use `npm run open:playwright-report` (stops the stale viewer or picks a free port).

**CI** generates and uploads the same merged reports but never opens browsers (`CI=true`).

```bash
npm run test:all:run
CI=true HEADLESS=true ./all-test-run.sh

npm run reports:prepare
npm run reports:merge
npm run reports:archive
npm run reports:email
npm run reports:open

npm run open:playwright-report
npm run open:allure-report
npm run open:ortoni-report
npm run clean:reports
npm run clean:history
npm run rebuild:sqlite3
```

`clean:reports` clears latest working folders (including `raw/`). Use `clean:history` to delete `test-results/history/`. History keeps the latest **10** complete `RUN_ID` folders. Use `npm run reports:email` (or a full suite with `SEND_EMAIL_TO_USER=true`) to email the combined reports.

Do not upload `.env` or `playwright/.auth/*` as artifacts.

## Project Structure

```
├── setup.sh / all-test-run.sh
├── .github/workflows/           # ci.yml · pre-merge-check.yml · auto-merge.yml
├── src/
│   ├── common/                  # fixtures, global-setup/teardown, tags
│   ├── config/
│   │   ├── browser/
│   │   ├── defaultConfig/       # timeouts, runtime defaults, merge-reports.config.ts
│   │   └── environment/
│   ├── pageActions/
│   ├── pageLocators/
│   └── utils/                   # api helpers, data-generator, reports-helper, email-report-helper
├── tests/
│   ├── api-tests/
│   └── e2e-tests/
│       ├── articles/
│       └── settings/
├── playwright/.auth/            # runtime (gitignored)
├── test-results/                # latest reports + history/ + artifacts
├── playwright.config.ts
├── package.json
└── README.md
```

Article/user TypeScript models live in `src/utils/article-helper.ts` and `src/utils/user-helper.ts` (no separate `src/models/` folder).

## GitHub Actions CI/CD

CI targets the web application (`conduit.bondaracademy.com` / `conduit-api.bondaracademy.com`). The badge at the top of this README links to the main workflow.

### Workflow files

| File                                                                               | Purpose                                                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)                           | Lint → API → E2E articles → E2E settings → merge + email reports → summarize (always succeeds) |
| [`.github/workflows/pre-merge-check.yml`](./.github/workflows/pre-merge-check.yml) | PR smoke: lint / typecheck / format / API                                                      |
| [`.github/workflows/auto-merge.yml`](./.github/workflows/auto-merge.yml)           | Auto-merge same-repo PRs when CI succeeds                                                      |

**Triggers:** push and pull request to `main` / `master` (auto-merge listens for successful CI `workflow_run`).

### What the main CI pipeline does

1. **Lint Code** — `npm run lint`, `typecheck`, `format:check` (Node 24, `npm ci`)
2. **Run API Tests** — phase `api`; uploads raw blob / Allure / Ortoni artifacts (`continue-on-error`)
3. **Run E2E Article + Tag Tests** — phase `e2e-articles` (headless parallel; `continue-on-error`)
4. **Run E2E Settings Tests** — phase `e2e-settings` (`--workers=1`; `continue-on-error`)
5. **Merge Reports** (`if: always()`) — `npm run reports:merge`; uploads combined Playwright / Allure / Ortoni reports
6. **Email reports** (`if: always()`) — writes `.env` from secret `ENV_FILE`, then emails when `SEND_EMAIL_TO_USER=true`
7. **Summarize Run** — prints pass/fail/skip job outcomes; **does not fail the workflow**

Test outcomes (pass, fail, or skip) are recorded in reports and email. The CI workflow itself stays **successful** so merge + email always complete.

Reports are never opened in CI. Per-phase raw artifacts use unique names (`playwright-blob-*`, `allure-results-*`, `ortoni-results-*`); finals use `*-report-combined`.

### Configure repository secrets (`.env` in GitHub)

Go to **Settings → Secrets and variables → Actions**.

#### Required for email + CI config: `ENV_FILE`

Store the **full contents** of your local `src/config/environment/.env` as a single repository secret named **`ENV_FILE`**.

1. Copy your local `.env` (URLs, optional fixed-user creds, and email/SMTP block).
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `ENV_FILE`
4. Value: paste the entire `.env` file

CI jobs write that secret to `src/config/environment/.env` at runtime (never committed). Email uses `SEND_EMAIL_TO_USER` / `SEND_EMAIL_TO_USER_EMAIL` / `SMTP_*` from that file.

Example keys inside `ENV_FILE`:

```env
DEV_BASEURL=https://conduit.bondaracademy.com
DEV_API_BASE_URL=https://conduit-api.bondaracademy.com
SEND_EMAIL_TO_USER=true
SEND_EMAIL_TO_USER_EMAIL=you@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=you@gmail.com
```

#### Optional URL overrides (if `ENV_FILE` is unset)

| Name               | Purpose              | Default if unset                        |
| ------------------ | -------------------- | --------------------------------------- |
| `DEV_BASEURL`      | Conduit UI base URL  | `https://conduit.bondaracademy.com`     |
| `DEV_API_BASE_URL` | Conduit API base URL | `https://conduit-api.bondaracademy.com` |

Local full suite uses `src/config/environment/.env` the same way (`npm run reports:email` / `all-test-run.sh`).

#### Secrets (optional / as needed)

| Name                                          | Purpose                                                         |
| --------------------------------------------- | --------------------------------------------------------------- |
| `ENV_FILE`                                    | Full `.env` contents for CI (preferred — includes email + SMTP) |
| `DEV_EMAIL` / `DEV_USERNAME` / `DEV_PASSWORD` | Only if not already inside `ENV_FILE` and `DYNAMIC_USER=false`  |

Do **not** commit real passwords, `.env`, or `playwright/.auth/*`.

### CI execution settings

Workflows set:

```yaml
NODE_VERSION: "24"
ENVIRONMENT: DEV
DYNAMIC_USER: "true"
HEADLESS: "true"
PARALLEL: "true"
WORKERS: "2"
MULTI_PHASE_RUN: "true"
```

Job details and artifact names are listed under [What the main CI pipeline does](#what-the-main-ci-pipeline-does).

**Note:** Test pass/fail/skip does **not** fail the CI workflow (by design). Inspect combined report artifacts or the emailed zip for real outcomes. If you use [auto-merge](.github/workflows/auto-merge.yml), review carefully — workflow success no longer means all tests passed.

### Download artifacts after a run

1. Open **Actions** → select the workflow run
2. Download under **Artifacts**, for example:
   - `playwright-report-combined` / `allure-report-combined` / `ortoni-report-combined`
   - Per-phase raw: `playwright-blob-*`, `allure-results-*`, `ortoni-results-*`
   - `pre-merge-test-results` (from the pre-merge workflow)

Allowed upload content: HTML / Allure / Ortoni reports, screenshots, videos, traces, sanitized logs under `test-results/`.

Do **not** upload: `src/config/environment/.env`, `playwright/.auth/auth.json`, `playwright/.auth/generated-user.json`, or password-bearing test JSON.

### Branch protection (recommended)

1. **Settings → Branches** → add a rule for `main` / `master`
2. Enable:
   - Require a pull request before merging
   - Require status checks to pass before merging
   - Require branches to be up to date before merging
3. Required checks (job names from `ci.yml`):
   - `Lint Code`
   - `Run API Tests`
   - `Run E2E Article + Tag Tests`
   - `Run E2E Settings Tests`
   - `Merge Reports`
   - `Summarize Run`

These jobs stay green even when individual tests fail/skip (by design). Review report artifacts or email for real pass/fail. Enable auto-merge only if you accept that workflow success ≠ all tests passed.

### Auto-merge behavior

Merges when the CI workflow concludes successfully for a same-repo PR (see `auto-merge.yml`).

### Local CI parity

```bash
npm ci
npx playwright install --with-deps
npm run lint
npm run typecheck
npm run format:check
CI=true HEADLESS=true ./all-test-run.sh
```

### CI troubleshooting

| Problem                                | What to check                                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| API / E2E auth failures                | With `DYNAMIC_USER=true`, auth is generated at run time; for fixed users verify `DEV_EMAIL` / `DEV_PASSWORD` / `DEV_USERNAME` |
| Wrong UI or API host                   | Set `DEV_BASEURL` / `DEV_API_BASE_URL` repository variables (or rely on the web application defaults)                         |
| Missing failure media                  | Inspect merged Playwright HTML / Allure / Ortoni combined artifacts                                                           |
| Ortoni / Playwright missing a phase    | Confirm each job uploaded its `playwright-blob-*` artifact and `merge-reports` ran                                            |
| Playwright report `EADDRINUSE` on 9323 | `npm run open:playwright-report` or `lsof -ti :9323 \| xargs kill`                                                            |
| Ortoni / `sqlite3` in CI               | `npm ci` on Ubuntu usually builds bindings; merge job runs `npm rebuild sqlite3`                                              |
| Auto-merge skipped                     | Branch protection, draft PR, failing checks, or merge conflicts                                                               |
| TC-0019 expected-fail in reports       | **Expected** via `test.fail()` — CI job stays green; see [Known Gaps or Limitations](#known-gaps-or-limitations)              |
| Email step skipped in Merge Reports    | Set repository secret `ENV_FILE` to full `.env` with `SEND_EMAIL_TO_USER=true` + SMTP App Password                            |
| TC-0020 skipped in reports             | **Expected** — intentional `test.skip` for Skipped visibility in Playwright / Allure / Ortoni                                 |

## Troubleshooting

| Issue                                       | Fix                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Ortoni / `sqlite3`                          | `npm rebuild sqlite3`                                                                                             |
| Auth / username mismatch                    | Confirm `.env` credentials when `DYNAMIC_USER=false`                                                              |
| Blank E2E page                              | Confirm `user-setup` produced `playwright/.auth/auth.json`                                                        |
| Missing browser                             | `npx playwright install`                                                                                          |
| Settings flaking in parallel                | Run `npm run test:dev:e2e:chrome:settings` only                                                                   |
| TC-0019 shows as **Failed** / expected-fail | **Expected** — `test.fail()` documents the invalid profile URL defect; suite/CI stay green                        |
| TC-0019 shows as unexpected **Passed**      | App may have been fixed — remove `test.fail` after confirming, or check a stale report                            |
| Report email not received                   | Confirm `SEND_EMAIL_TO_USER=true`, recipient, and SMTP App Password (local `.env` or CI secrets)                  |
| TC-0020 shows as **Skipped**                | **Expected** — intentional skip so reports demonstrate skipped-test inclusion                                     |
| TC-0020 shows as **Passed**                 | Unexpected while `test.skip` is in place — check for a local edit that re-enabled the test                        |
| CI artifact download empty                  | Download `*-report-combined` or per-phase `playwright-blob-*` / `allure-results-*` / `ortoni-results-*` artifacts |

## Submission Instructions

Checklist:

- [ ] Code pushed to GitHub
- [ ] GitHub Actions workflows visible under **Actions** (see [GitHub Actions CI/CD](#github-actions-cicd))
- [ ] Repository secret `ENV_FILE` set to full `.env` contents (includes `SEND_EMAIL_TO_USER_EMAIL` + SMTP for CI email)
- [ ] Repository variables/secrets configured if fixed-user auth is needed outside `ENV_FILE` (`DYNAMIC_USER=false`)
- [ ] No `.env`, password, token, or auth state committed
- [ ] README commands match `package.json`
- [ ] Combined reports upload in CI (`playwright-report-combined`, `allure-report-combined`, `ortoni-report-combined`)
- [ ] Repository URL emailed to the reviewer

Suggested email:

```text
Subject: Playwright TypeScript Automation Assignment Submission

Hello,

I have completed the Playwright TypeScript automation assignment for the web application.

GitHub repository:
<REPOSITORY_URL>

The repository includes UI and API automation, positive and negative test coverage, reusable authentication, dynamic test data, cross-browser configuration, reporting, parallel execution, and GitHub Actions CI/CD.

Regards,
Md Sakibur Rahman
```

## Known Gaps or Limitations

### CONDUIT-TC-0019 — expected to fail (catches a web application defect)

**CONDUIT-TC-0019: Verify that invalid profile picture URL should not be accepted** uses Playwright `test.fail()` so:

1. Test inputs an invalid URL in **URL of profile picture**.
2. Clicks **Update Settings**.
3. Asserts the UI **stays on Your Settings** and does **not** open `/profile/...` (**My Posts**).
4. The web application currently **accepts** the invalid URL and **navigates to the profile** → assertion fails as expected.

CI/suite stay green while that failure is expected. Reports still show the defect. If TC-0019 unexpectedly **passes**, remove `test.fail` after confirming the app was fixed.

Remaining settings cases (TC-0016–0018) still run. **TC-0020** remains **intentionally skipped** so reports show a Skipped result — see below.

### CONDUIT-TC-0020 — intentionally skipped (shows Skipped in reports)

**CONDUIT-TC-0020: Verify that an invalid email address can not be accepted and the user can not update settings** is marked with Playwright `test.skip` (annotation `intentional-skip`).

- Purpose: demonstrate that **Skipped** tests appear in the final Playwright HTML, Allure, and Ortoni reports after multi-phase merge.
- This is **not** a product defect quarantine; the body of the test remains in the repo and can be re-enabled by switching `test.skip` → `test`.
- Skipped status alone does not make `./all-test-run.sh` exit non-zero.

### Other notes

- The web application `/?tag=` UI may still show mixed cards when the Articles API filters correctly (filter specs annotate this behavior).
- Settings form fields often do not hydrate from the server; tests fill values explicitly.
- Create Article E2E cleanup uses UI delete; Edit/Delete use API cleanup after API setup.
- Full suite / CI can stay green with TC-0019 marked `test.fail` (expected product defect) and TC-0020 skipped; reports still show those outcomes.
