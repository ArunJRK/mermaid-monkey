# Contributing to mermaid-monkey

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `pnpm install`
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development

This is a pnpm monorepo with two packages:

- `packages/core` — the rendering engine library
- `packages/vscode` — the VS Code extension

### Prerequisites

- Node.js 20+
- pnpm 9+

### Commands

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages
pnpm test           # Run tests
pnpm dev            # Start development mode
```

## Pull Requests

- Keep PRs focused on a single change
- Include tests for new functionality
- Update docs if behavior changes
- Follow existing code style (TypeScript, no semicolons configured in prettier)

## Reporting Issues

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Mermaid diagram source (if applicable)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
