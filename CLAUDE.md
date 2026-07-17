# CLAUDE.md — Web Application Best Practices for wcos

This document defines the coding standards, architecture principles, and workflow conventions for the wcos project.

---

## 1. Architecture Principles

### SOLID Principles

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | Each class/module has one reason to change. Controllers handle HTTP only; services contain business logic; models handle data. |
| **Open/Closed** | Extend behavior via composition/inheritance, not modification. Use interfaces/protocols for swappable implementations. |
| **Liskov Substitution** | Subtypes must be substitutable for their base types. Favor interfaces over concrete classes in dependencies. |
| **Interface Segregation** | Many small, focused interfaces > one large interface. Depend on abstractions, not concretions. |
| **Dependency Inversion** | High-level modules don't depend on low-level modules. Both depend on abstractions. Inject dependencies (constructor injection preferred). |

### MVC Pattern

```
app/
├── controllers/     # HTTP layer: routing, request/response, serialization
├── services/        # Business logic: use cases, domain rules, orchestration
├── models/          # Data layer: entities, repositories, persistence
├── views/           # Presentation: templates, serializers, formatters
└── middleware/      # Cross-cutting: auth, logging, error handling
```

**Rules:**
- Controllers are thin — delegate to services
- Services contain zero HTTP knowledge (no request/response objects)
- Models expose domain behavior, not DB structure
- Views are dumb — receive data, render output

---

## 2. Code Organization

### Directory Structure

```
wcos/
├── app/
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── views/
│   └── middleware/
├── config/          # Environment-specific configuration
├── db/              # Migrations, seeds, schema
├── tests/
│   ├── unit/        # Fast, isolated (services, models)
│   ├── integration/ # Controller + DB, API contracts
│   └── e2e/         # Full stack, critical paths
├── scripts/         # One-off tasks, dev tooling
└── docs/            # Architecture decisions, API docs
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes/Modules | PascalCase | `UserService`, `OrderRepository` |
| Functions/Methods | snake_case | `calculate_total`, `find_by_email` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_ATTEMPTS` |
| Files | kebab-case | `user-service.ts`, `order_repository.py` |
| Tests | `*_test.py` or `*_spec.rb` | `user_service_test.py` |

---

## 3. Testing Strategy

### Test Pyramid

```
        /\
       /E2E\         ← Few (5-10%), slow, high confidence
      /------\
     /Integration\   ← Moderate (15-20%), medium speed
    /------------\
   /    Unit      \  ← Many (70-80%), fast, isolated
  /______________\
```

### Requirements

- **Unit tests**: No external dependencies (DB, HTTP, FS). Mock at boundaries. Target: >90% coverage on services/models.
- **Integration tests**: Real DB, testcontainers or test DB. Test controller → service → model flows.
- **E2E tests**: Critical user journeys only (signup, checkout, auth). Playwright/Cypress.
- **Run tests before every commit** — CI enforces this.

### Test Conventions

```python
# Unit test example (pytest)
def test_calculate_discount_applies_tiered_pricing():
    # Arrange
    service = PricingService()
    customer = Customer(tier="gold")
    
    # Act
    result = service.calculate_discount(customer, 1000)
    
    # Assert
    assert result == 150  # 15% for gold tier
```

- Use descriptive test names: `test_<method>_<scenario>_<expected>`
- Arrange → Act → Assert structure
- One assertion per test (or closely related assertions)
- Fixtures for shared test data

---

## 4. Git Branching Strategy

### Branch Policy (MANDATORY)

> **Never work on `main` or `master` directly.** Every change starts on a new feature branch.

### Branch Types

| Prefix | Purpose | Lifetime |
|--------|---------|----------|
| `feat/` | New feature | Until merged to main |
| `fix/` | Bug fix | Until merged to main |
| `refactor/` | Code improvement (no behavior change) | Until merged to main |
| `test/` | Test additions/improvements | Until merged to main |
| `docs/` | Documentation only | Until merged to main |
| `chore/` | Maintenance (deps, config, tooling) | Until merged to main |

### Naming Format

```
<type>/<short-descriptive-name>
# Examples:
feat/user-authentication
fix/login-race-condition
refactor/extract-payment-service
```

### Workflow

```bash
# 1. Start from updated main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feat/user-authentication

# 3. Work in small commits
git add -p
git commit -m "feat(auth): add JWT token generation"

# 4. Push and open PR
git push origin feat/user-authentication
# Open PR via GitHub UI or `gh pr create`

# 5. After review + CI pass: squash merge
# 6. Delete branch locally and remotely
git checkout main && git pull && git branch -d feat/user-authentication
```

### Commit Message Format (Conventional Commits)

```
<type>(<scope>): <imperative summary>

[optional body: motivation, context]

[optional footer: breaking changes, issue refs]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`

**Examples:**
```
feat(auth): add password reset flow
fix(cart): resolve race condition on concurrent updates
refactor(orders): extract pricing logic to service
test(services): add coverage for discount calculation
```

### PR Requirements

- [ ] All tests pass (CI green)
- [ ] Code coverage maintained or improved
- [ ] No direct commits to main — PR required
- [ ] At least one approval (or self-merge for trivial docs/chore)
- [ ] Squash merge — clean history
- [ ] Branch deleted after merge

---

## 5. Development Practices

### Code Quality

- **Type hints / type annotations** required in all languages that support them
- **Linting + formatting** enforced in CI (ruff/black, eslint/prettier, rubocop, etc.)
- **No commented-out code** — delete it, git has history
- **No TODO/FIXME without issue reference** — `# TODO(#123): explanation`

### Error Handling

- Fail fast, fail loud — validate inputs at boundaries
- Use domain-specific exceptions, not generic ones
- Log at the right level: `error` for failures, `warn` for degraded, `info` for lifecycle
- Never leak stack traces to clients

### Security

- Never commit secrets — use `.env.local` (gitignored) + secret manager in prod
- Parameterized queries / ORM — no string interpolation in SQL
- Validate and sanitize all inputs
- Implement rate limiting on public endpoints
- Keep dependencies updated (`dependabot` / `renovate`)

### Performance

- N+1 queries: use eager loading / batch loading
- Paginate all list endpoints
- Cache aggressively at service layer (Redis), invalidate on write
- Profile before optimizing — `py-spy`, `pprof`, `bullet` (Rails)

---

## 6. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml (conceptual)
stages:
  - lint          # format, type-check, static analysis
  - unit-tests    # fast, parallel
  - integration-tests  # with test DB
  - build         # docker image, artifacts
  - e2e-tests     # against staging-like env (optional, nightly)
  - deploy        # on main merge, manual approval for prod
```

---

## 7. Documentation

- **README.md**: Quick start, run commands, environment setup
- **ARCHITECTURE.md**: High-level design, data flow, key decisions (ADR format)
- **API.md** or OpenAPI/Swagger: Contract for consumers
- **CHANGELOG.md**: Keep a changelog (conventional-changelog format)
- **Code comments**: Why, not what. Public APIs must have docstrings.

---

## 8. Tooling Standards

| Category | Tool |
|----------|------|
| Language | Python 3.11+, Node 22+, Ruby 3.3+ |
| Package Manager | uv / poetry, pnpm, bundler |
| Lint/Format | ruff + black, eslint + prettier, rubocop |
| Testing | pytest, vitest/jest, rspec |
| Type Check | mypy / pyright, tsc, steep |
| Git Hooks | pre-commit (lint, format, test) |
| CI | GitHub Actions |

---

## 9. Project-Specific Notes for wcos

- **Framework**: [To be determined — update when chosen]
- **Database**: [PostgreSQL / SQLite / etc. — update when chosen]
- **Deployment Target**: [Docker / Serverless / VPS — update when chosen]
- **Authentication**: [JWT / Session / OAuth — update when chosen]

> Update this section as the project evolves. Keep it accurate — stale docs are worse than no docs.

---

## 10. Quick Reference Commands

```bash
# Setup
make setup              # or ./scripts/setup.sh

# Development
make dev                # start dev server with hot reload
make test               # run all tests
make test-unit          # unit tests only
make lint               # lint + format check
make format             # auto-fix formatting

# Git
git checkout -b feat/<name>
git commit -m "feat(scope): description"
git push origin feat/<name>
gh pr create --fill

# Database
make migrate            # run migrations
make seed               # seed development data
make db-reset           # drop, create, migrate, seed
```

---

**Remember:** This document is a living guide. Update it when conventions change. If you're unsure about a pattern not covered here, ask — consistency matters more than perfection.