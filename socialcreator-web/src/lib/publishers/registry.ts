/**
 * Enhanced publisher registry
 * Maps platforms to full PublisherRegistration with validators, hooks, retry
 */

import type { Platform } from "@prisma/client";
import type { Publisher } from "./index";
import type { PublisherRegistration } from "./types";

const registryMap = new Map<Platform, PublisherRegistration>();

/**
 * Register a publisher with full configuration (validators, hooks, retry)
 */
export function registerPublisherWithConfig(
  platform: Platform,
  registration: PublisherRegistration,
): void {
  registryMap.set(platform, registration);
}

/**
 * Register a simple publisher (wraps existing Publisher interface)
 */
export function registerSimplePublisher(platform: Platform, publisher: Publisher): void {
  registerPublisherWithConfig(platform, {
    platform,
    publish: (content, account) => publisher.publish(content, account),
  });
}

/**
 * Get the full registration for a platform
 */
export function getPublisherRegistration(platform: Platform): PublisherRegistration {
  const registration = registryMap.get(platform);
  if (!registration) {
    throw new Error(`No publisher registered for platform: ${platform}`);
  }
  return registration;
}

/**
 * Check if a publisher is registered for a platform
 */
export function hasPublisher(platform: Platform): boolean {
  return registryMap.has(platform);
}
