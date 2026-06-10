/**
 * Publisher strategy pattern - shared types
 * Enhances the existing publisher interface with validation, hooks, and retry
 */

import type { Platform } from "@prisma/client";

// Standardized publisher interfaces
export interface PublishInput {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

export interface PublishOptions {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

export type PublisherFunction = (
  input: PublishInput,
  options: PublishOptions,
) => Promise<PublishResult>;

export interface PublishContent {
  textContent: string;
  mediaUrls: string[];
  hashtags: string[];
}

export interface PublishAccount {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  platform?: Platform;
  durationMs?: number;
}

export interface PublishContext {
  content: PublishContent;
  account: PublishAccount;
  platform: Platform;
  profileId: string;
  userId: string;
  attempt: number;
  idempotencyKey?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type ContentValidator = (content: PublishContent) => Promise<ValidationResult>;

export type PrePublishHook = (ctx: PublishContext) => Promise<PublishContext | null>;
export type PostPublishHook = (ctx: PublishContext, result: PublishResult) => Promise<void>;
export type OnErrorHook = (ctx: PublishContext, error: Error) => Promise<void>;

export interface PublisherHooks {
  prePublish?: PrePublishHook;
  postPublish?: PostPublishHook;
  onError?: OnErrorHook;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  useJitter: boolean;
  retryOnStatuses: number[];
}

export interface PublisherRegistration {
  platform: Platform;
  publish: (content: PublishContent, account: PublishAccount) => Promise<PublishResult>;
  validators?: ContentValidator[];
  hooks?: PublisherHooks;
  retry?: Partial<RetryConfig>;
}
