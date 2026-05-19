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

## Development Scripts

```bash
# Start development server
npm run dev

# Start scheduler (for testing scheduled posts in dev mode)
npm run dev:scheduler

# Run both Next.js and scheduler together
npm run dev:all
```

## Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:coverage

# Install Playwright browsers (run once)
npm run test:e2e:install

# Run E2E tests headless
npm run test:e2e

# Run E2E tests with visible browser
npm run test:e2e:headed

# Run E2E tests with interactive UI
npm run test:e2e:ui
```

## Scheduler

The development scheduler (`scripts/dev-scheduler.ts`) runs alongside the Next.js dev server to simulate scheduled tasks:
- Publishes scheduled posts every minute
- Checks token expiration every 5 minutes
- Processes pending media every 10 minutes

Use `npm run dev:scheduler` to run it standalone, or `npm run dev:all` to run both together.

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