/**
 * DI Container (deprecated)
 *
 * This Container was an early abstraction that was never adopted by application code.
 * The codebase uses the repository registry pattern (getRepositories()) instead.
 *
 * To revive: re-implement the Container class with full typing, migrate repositories
 * to use it, and remove the registry pattern. Until then, this file serves as a
 * placeholder to avoid breaking tests that reference the module shape.
 *
 * @deprecated Use getRepositories() from "@/lib/repositories" instead.
 */

export type Lifetime = "singleton" | "transient" | "scoped";

/**
 * @deprecated Will be removed in future cleanup. Do not use in new code.
 */
export class Container {
  register<T>(_name: string, _factory: () => T, _lifetime: Lifetime = "singleton"): void {
    // No-op: use getRepositories() instead
  }

  registerInstance<T>(_name: string, _instance: T): void {
    // No-op: use getRepositories() instead
  }

  isRegistered(_name: string): boolean {
    return false;
  }

  resolve<T>(_name: string, _origin?: Container): T {
    throw new Error("DI Container is deprecated. Use getRepositories() instead.");
  }

  createScope(_scopeId?: string): Container {
    return new Container();
  }

  override<T>(_name: string, _factory: () => T): void {
    // No-op
  }

  clear(): void {
    // No-op
  }
}

let defaultContainer: Container | null = null;

/**
 * @deprecated Use getRepositories() from "@/lib/repositories" instead.
 */
export function getContainer(): Container {
  if (!defaultContainer) {
    defaultContainer = new Container();
  }
  return defaultContainer;
}

/**
 * @deprecated Use getRepositories() from "@/lib/repositories" instead.
 */
export function resetContainer(): void {
  defaultContainer = null;
}
