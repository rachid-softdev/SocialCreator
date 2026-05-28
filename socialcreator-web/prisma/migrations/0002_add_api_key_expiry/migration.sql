-- Add expiresAt column to ApiKey model for automatic key expiration
ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMPTZ;
