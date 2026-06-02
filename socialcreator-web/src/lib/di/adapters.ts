/**
 * Adapters for bridging existing service getters into the DI container
 * Coexists with existing entitlements module patterns
 */

import { getEntitlementRepository } from "@/lib/entitlements/repository";
import { FeatureGateService } from "@/lib/entitlements/service";
import { Container } from "./container";
import { TOKENS } from "./token";

/**
 * Register all default services into the container
 * This bridges the existing entitlements module without breaking it
 */
export function registerDefaultServices(container: Container): void {
  // Infrastructure
  container.register(
    TOKENS.PRISMA_CLIENT,
    () => {
      const { prisma } = require("@/lib/prisma");
      return prisma;
    },
    "singleton",
  );

  // Entitlements (bridging existing module)
  container.register(TOKENS.ENTITLEMENT_REPOSITORY, () => getEntitlementRepository(), "singleton");

  container.register(TOKENS.FEATURE_GATE_SERVICE, () => new FeatureGateService(), "singleton");
}

/**
 * Create a pre-configured default container
 */
export function createDefaultContainer(): Container {
  const container = new Container();
  registerDefaultServices(container);
  return container;
}
