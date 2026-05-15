# Contributing to SocialCreator

Thank you for your interest in contributing to SocialCreator!

## Getting Started

1. **Fork the repository**
2. **Clone your fork**: `git clone https://github.com/YOUR_USERNAME/SocialCreator.git`
3. **Add upstream**: `git remote add upstream https://github.com/rachid-softdev/SocialCreator.git`

## Development Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.local.example .env.local

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

## Code Style

- Use TypeScript for all new code
- Follow existing naming conventions
- Run `npm run lint` before committing
- Run `npm run typecheck` to check types

## Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run E2E tests (requires dev server)
npx playwright test
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Add tests if applicable
4. Run linting and tests
5. Commit with clear messages
6. Push and create a PR

## Commit Message Format

Use conventional commits:

- `feat: add new feature`
- `fix: resolve bug`
- `docs: update documentation`
- `refactor: restructure code`
- `test: add tests`

## Code Review

- Be responsive to feedback
- Explain your changes
- Keep PRs focused and small

## Questions?

Open an issue for bugs, feature requests, or questions.