# YAML Frontmatter Schema

**See `schema.yaml` in the same directory as this skill for the core portable schema specification.**

If present, `schema.project.yaml` in the same directory acts as an optional repo-specific overlay for stricter enums.

## Required Fields

- **module** (string): Module name (e.g., "EmailProcessing") or "System" for system-wide issues
- **date** (string): ISO 8601 date (YYYY-MM-DD)
- **problem_type** (enum): One of [build_error, test_failure, runtime_error, performance_issue, database_issue, security_issue, ui_bug, integration_issue, logic_error, developer_experience, workflow_issue, best_practice, documentation_gap]. Use `best_practice`, `developer_experience`, or `workflow_issue` for implementation insights (patterns from feature work).
- **component** (string): Free text. Prefer stable slugs like [backend, frontend, database, infra, ci, auth, api, docs, tooling]
- **symptoms** (array): 1-5 specific observable symptoms
- **root_cause** (string): Free text. Describe the actual cause (not a symptom). Prefer stable slugs when possible.
- **resolution_type** (enum): One of [code_fix, migration, config_change, test_fix, dependency_update, environment_setup, workflow_improvement, documentation_update, tooling_addition, seed_data_update]
- **severity** (enum): One of [critical, high, medium, low]

## Optional Fields

- **framework** (string): Framework/library name if relevant (e.g., rails, django, react)
- **framework_version** (string): Framework version in X.Y.Z if known
- **runtime_version** (string): Runtime version (e.g., ruby 3.3.1, node 20.11.0)
- **environment** (string): dev|staging|prod|other
- **tags** (array): Searchable keywords (lowercase, hyphen-separated). Include `spike` when the solution originated from a spike (timeboxed investigation).

## Validation Rules

1. All required fields must be present
2. Enum fields must match allowed values exactly (case-sensitive)
3. symptoms must be YAML array with 1-5 items
4. date must match YYYY-MM-DD format
5. tags should be lowercase, hyphen-separated

## Example

```yaml
---
module: Email Processing
date: 2025-11-12
problem_type: performance_issue
component: backend
symptoms:
  - "N+1 query when loading email threads"
  - "Brief generation taking >5 seconds"
root_cause: missing_include
framework: rails
framework_version: 7.1.2
resolution_type: code_fix
severity: high
tags: [n-plus-one, eager-loading, performance]
---
```

Example with spike-origin doc:

```yaml
---
module: Auth Service
date: 2026-02-20
problem_type: integration_issue
component: backend
symptoms:
  - "Unclear whether OAuth or API keys fit our scale"
root_cause: spike-recommendation
resolution_type: documentation_update
severity: medium
tags: [spike, oauth, api-keys]
---
```

## Category Mapping

Based on `problem_type`, documentation is filed in:

- **build_error** → `docs/solutions/build-errors/`
- **test_failure** → `docs/solutions/test-failures/`
- **runtime_error** → `docs/solutions/runtime-errors/`
- **performance_issue** → `docs/solutions/performance-issues/`
- **database_issue** → `docs/solutions/database-issues/`
- **security_issue** → `docs/solutions/security-issues/`
- **ui_bug** → `docs/solutions/ui-bugs/`
- **integration_issue** → `docs/solutions/integration-issues/`
- **logic_error** → `docs/solutions/logic-errors/`
- **developer_experience** → `docs/solutions/developer-experience/`
- **workflow_issue** → `docs/solutions/workflow-issues/`
- **best_practice** → `docs/solutions/best-practices/`
- **documentation_gap** → `docs/solutions/documentation-gaps/`
