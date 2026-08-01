# Contributing to Anki MCP Server

Thank you for your interest in contributing! This document outlines how to set up
the project, submit changes, and communicate with maintainers.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)
- [Security Reports](#security-reports)

## Code of Conduct

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
Please be respectful and inclusive in all interactions.

## Prerequisites

| Requirement | Minimum Version | Notes |
|-------------|----------------|-------|
| Node.js | 22.12.0+ (or 20.19+) | Node 21.x is **not** supported |
| npm | 10.x+ | Ships with Node.js |
| Anki desktop | 2.1.50+ | Required for integration tests |
| AnkiConnect add-on | latest | Add-on code `2055492159` |

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/ankimcp/anki-mcp-server.git
cd anki-mcp-server

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Verify the environment
node scripts/health-check.mjs
```

### Running in Development

```bash
# STDIO mode with auto-rebuild on file changes
npm run start:dev:stdio

# HTTP mode (http://127.0.0.1:3000)
npm run start:dev:http

# Run the MCP Inspector for interactive testing
npm run inspector:stdio
```

## Project Structure

```
anki-mcp-server/
├── bin/                    # CLI entry point (ankimcp)
├── docs/                   # Additional documentation & screenshots
├── scripts/                # Build, release, and utility scripts
├── src/
│   ├── cli/                # CLI argument parsing & output formatting
│   ├── config/             # Configuration schema & env-var loading
│   ├── http/guards/        # HTTP-mode guards (API key, rate limit, origin)
│   ├── mcp/
│   │   ├── clients/        # AnkiConnect HTTP client
│   │   ├── primitives/
│   │   │   ├── essential/  # Core tools (notes, decks, media, stats)
│   │   │   └── gui/        # GUI-interaction tools
│   │   ├── types/          # Shared TypeScript types
│   │   └── utils/          # Shared utilities (markdown, media, stats)
│   ├── services/           # Confirmation, audit-log, idempotency services
│   ├── tunnel/             # Remote tunnel transport (optional)
│   ├── app.module.ts       # NestJS root module
│   ├── app-config.service.ts
│   ├── bootstrap.ts        # Logger factory
│   ├── main-stdio.ts       # STDIO entry point
│   ├── main-http.ts        # HTTP entry point
│   └── main-tunnel.ts      # Tunnel entry point
├── test/                   # Jest unit & e2e tests
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Coding Standards

- **Language**: TypeScript (strict mode enabled)
- **Framework**: NestJS 11 with `@rekog/mcp-nest`
- **Linting**: ESLint + Prettier (config in `eslint.config.mjs`)
- **Style**: Follow existing patterns; the linter enforces most rules automatically.

```bash
# Format code
npm run format

# Lint
npm run lint

# Type-check without emitting
npm run type-check
```

### Key Conventions

1. **One tool per file** under `src/mcp/primitives/essential/tools/`.
2. **Zod schemas** for all tool inputs and outputs.
3. **Dependency injection** via NestJS providers — never instantiate services manually.
4. **Pino logger** — use the injected `LoggerService`, never `console.log` in production code.
5. **Security**: Destructive operations must go through `ConfirmationService`.

## Testing

```bash
# Unit tests
npm test

# Unit tests with coverage (70% threshold enforced)
npm run test:cov

# E2e tests (requires Docker for AnkiConnect mock)
npm run e2e:up
npm run e2e:test
npm run e2e:down

# Run a single test file
npm run test:single
```

### Writing Tests

- Unit tests live next to the source file: `foo.tool.ts` → `foo.tool.spec.ts`.
- E2e tests live in `test/` and use the `*.e2e-spec.ts` suffix.
- Use `@nestjs/testing` for module isolation.
- Mock the AnkiConnect client in unit tests; use the Docker mock for e2e.

## Submitting Changes

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feat/my-new-tool
   ```
2. **Write tests** for your changes. Coverage thresholds are enforced.
3. **Ensure all checks pass**:
   ```bash
   npm run lint && npm run type-check && npm test
   ```
4. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new tool for X
   fix: resolve crash when Y
   docs: update README section Z
   ```
5. **Push** and open a Pull Request against `main`.
6. Fill in the PR template and link any related issues.

### Pull Request Checklist

- [ ] Code compiles (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] New features have tests
- [ ] Documentation updated (README, CHANGELOG if user-facing)
- [ ] Commit messages follow Conventional Commits

## Release Process

Releases are automated via GitHub Actions (`.github/workflows/release.yml`):

1. Maintainer bumps version in `package.json` and `server.json`.
2. A tagged push triggers the release workflow.
3. The workflow builds, publishes to npm, and creates a GitHub Release.
4. `CHANGELOG.md` is updated as part of the PR.

Contributors do **not** need to worry about versioning — just focus on the code.

## Security Reports

**Do not open public issues for security vulnerabilities.**
See [SECURITY.md](SECURITY.md) for the private disclosure process.

---

Questions? Open a [Discussion](https://github.com/ankimcp/anki-mcp-server/discussions)
or join the conversation in Issues. Happy hacking! 🎴
