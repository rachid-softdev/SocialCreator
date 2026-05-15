# Deployment Guide

This guide covers deploying SocialCreator to Vercel with PostgreSQL on Neon.

## Prerequisites

- Node.js 20+
- Vercel account
- Neon PostgreSQL database
- GitHub repository

## Environment Variables

Create a `.env.local` file with these variables:

```env
# Database (Neon)
DATABASE_URL="postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/socialcreator?sslmode=require"

# Auth
AUTH_SECRET="your-auth-secret"
AUTH_URL="https://your-app.vercel.app"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Meta OAuth (Instagram, Facebook, Threads)
META_CLIENT_ID=""
META_CLIENT_SECRET=""

# TikTok
TIKTOK_CLIENT_KEY=""
TIKTOK_CLIENT_SECRET=""

# LinkedIn
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""

# X (Twitter)
X_CLIENT_ID=""
X_CLIENT_SECRET=""

# Pinterest
PINTEREST_CLIENT_ID=""
PINTEREST_CLIENT_SECRET=""

# APIs
ANTHROPIC_API_KEY="sk-ant-..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
DEEPGRAM_API_KEY=""
MUX_TOKEN_ID=""
MUX_TOKEN_SECRET=""
UPLOADTHING_SECRET=""
UPLOADTHING_APP_ID=""

# Encryption
ENCRYPTION_KEY="your-32-char-encryption-key"

# Rate Limiting (Optional - Upstash Redis)
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Trigger.dev (Optional)
TRIGGER_API_KEY=""
TRIGGER_API_URL="https://api.trigger.dev"
TRIGGER_PUBLIC_KEY=""
```

## Deploy to Vercel

### Option 1: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Add the environment variables in the Vercel dashboard
5. Click "Deploy"

### Option 2: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

## Database Setup

### Neon

1. Create a project at [neon.tech](https://neon.tech)
2. Get your connection string
3. Add to Vercel environment variables

### Run Migrations

```bash
npx prisma generate
npx prisma db push
```

## OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth credentials (OAuth 2.0)
3. Add authorized redirect URI: `https://your-app.com/api/auth/callback/google`

### Meta (Instagram/Facebook/Threads)

1. Go to [Meta Developers](https://developers.facebook.com)
2. Create an app
3. Add Facebook Login product
4. Add authorized redirect URI: `https://your-app.com/api/auth/callback/facebook`

### TikTok

1. Go to [TikTok Developers](https://developers.tiktok.com)
2. Create an app
3. Add redirect URI: `https://your-app.com/api/auth/callback/tiktok`

### LinkedIn

1. Go to [LinkedIn Developers](https://developer.linkedin.com)
2. Create an app
3. Add redirect URI: `https://your-app.com/api/auth/callback/linkedin`

### X (Twitter)

1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create an app
3. Set callback URL: `https://your-app.com/api/auth/callback/twitter`

### Pinterest

1. Go to [Pinterest Developers](https://developers.pinterest.com)
2. Create an app
3. Add redirect URI: `https://your-app.com/api/auth/callback/pinterest`

## Stripe Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create API keys
3. Create webhook endpoint: `https://your-app.com/api/stripe/webhook`
4. Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`

## Troubleshooting

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm ci
npm run build
```

### Database Connection

```bash
# Test database connection
npx prisma db execute
```

### OAuth Errors

- Check redirect URIs match exactly
- Ensure scopes are correct
- Verify client IDs and secrets

### Rate Limiting

If Upstash Redis is not configured, the app falls back to in-memory rate limiting which resets on server restart.

## Production Checklist

- [ ] Environment variables configured in Vercel
- [ ] Database migrated and seeded
- [ ] OAuth credentials configured
- [ ] Stripe webhook set up
- [ ] Custom domain configured (optional)
- [ ] SSL enabled (automatic on Vercel)
- [ ] Monitoring set up (optional)