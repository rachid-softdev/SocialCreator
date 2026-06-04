/**
 * Lightweight DI Container
 * Registry-based, no decorators, no external dependencies
 * Supports singleton / transient / scoped lifetimes
 */

export type Lifetime = "singleton" | "transient" | "scoped";

interface Registration<T> {
  factory: () => T;
  lifetime: Lifetime;
  instance?: T;
  scopedInstances?: Map<string, T>;
}

export class Container {
  private registrations = new Map<string, Registration<any>>();
  private parent: Container | null = null;
  private scopeId = "root";

  constructor(parent?: Container) {
    this.parent = parent ?? null;
  }

  /**
   * Register a service with a factory function
   */
  register<T>(name: string, factory: () => T, lifetime: Lifetime = "singleton"): void {
    if (this.registrations.has(name)) {
      throw new Error(`Service already registered: ${name}`);
    }
    this.registrations.set(name, { factory, lifetime });
  }

  /**
   * Register a pre-existing instance (always singleton)
   */
  registerInstance<T>(name: string, instance: T): void {
    this.registrations.set(name, {
      factory: () => instance,
      lifetime: "singleton",
      instance,
    });
  }

  /**
   * Check if a service is registered (including parent)
   */
  isRegistered(name: string): boolean {
    return this.registrations.has(name) || (this.parent?.isRegistered(name) ?? false);
  }

  /**
   * Resolve a service by name
   * Pass the originating container to propagate scopeId for scoped lifetime resolution
   */
  resolve<T>(name: string, origin?: Container): T {
    const registration = this.registrations.get(name);
    if (registration)
      return this.resolveFromRegistration<T>(registration, (origin ?? this).scopeId);
    if (this.parent) return this.parent.resolve<T>(name, origin ?? this);
    throw new Error(`Service not registered: ${name}`);
  }

  /**
   * Create a child scope (for scoped lifetime)
   */
  createScope(scopeId?: string): Container {
    const child = new Container(this);
    child.scopeId = scopeId ?? crypto.randomUUID();
    return child;
  }

  /**
   * Override a registration (for testing)
   */
  override<T>(name: string, factory: () => T): void {
    this.registrations.set(name, { factory, lifetime: "transient" });
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.registrations.clear();
  }

  private resolveFromRegistration<T>(registration: Registration<T>, scopeId: string): T {
    switch (registration.lifetime) {
      case "singleton":
        if (!registration.instance) {
          registration.instance = registration.factory();
        }
        return registration.instance;

      case "transient":
        return registration.factory();

      case "scoped":
        if (!registration.scopedInstances) {
          registration.scopedInstances = new Map();
        }
        if (!registration.scopedInstances.has(scopeId)) {
          registration.scopedInstances.set(scopeId, registration.factory());
        }
        return registration.scopedInstances.get(scopeId) as ReturnType<typeof registration.factory>;
    }
  }
}

// ── Global default container ──────────────────────────────────

let defaultContainer: Container | null = null;

/**
 * Get the global default container
 */
export function getContainer(): Container {
  if (!defaultContainer) {
    defaultContainer = new Container();
  }
  return defaultContainer;
}

/**
 * Reset the global container (for testing)
 */
export function resetContainer(): void {
  defaultContainer = null;
}
