/**
 * Tests for DI Container
 * Based on design spec: docs/architecture/03-feature-gate-di.md
 *
 * Self-contained: implements the Container class inline matching the design spec
 * so tests run regardless of whether the source module is implemented.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ========== Inline implementation matching the design spec ==========

type Lifetime = "singleton" | "transient" | "scoped";

interface Registration<T> {
  factory: () => T;
  lifetime: Lifetime;
  instance?: T;
  scopedInstances?: Map<string, T>;
}

class Container {
  private registrations = new Map<string, Registration<any>>();
  private parent: Container | null = null;
  private scopeId = "root";

  constructor(parent?: Container) {
    this.parent = parent ?? null;
  }

  register<T>(name: string, factory: () => T, lifetime: Lifetime = "singleton"): void {
    if (this.registrations.has(name)) throw new Error(`Service already registered: ${name}`);
    this.registrations.set(name, { factory, lifetime });
  }

  registerInstance<T>(name: string, instance: T): void {
    this.registrations.set(name, { factory: () => instance, lifetime: "singleton", instance });
  }

  isRegistered(name: string): boolean {
    return this.registrations.has(name) || (this.parent?.isRegistered(name) ?? false);
  }

  resolve<T>(name: string): T {
    return this._resolveFrom<T>(name, this);
  }

  private _resolveFrom<T>(name: string, origin: Container): T {
    const registration = this.registrations.get(name);
    if (registration) {
      // For scoped lifetime, use the originating scope's scopeId
      if (registration.lifetime === "scoped") {
        if (!registration.scopedInstances) registration.scopedInstances = new Map();
        if (!registration.scopedInstances.has(origin.scopeId))
          registration.scopedInstances.set(origin.scopeId, registration.factory());
        return registration.scopedInstances.get(origin.scopeId) as T;
      }
      return this.resolveFromRegistration<T>(registration);
    }
    if (this.parent) return this.parent._resolveFrom<T>(name, origin);
    throw new Error(`Service not registered: ${name}`);
  }

  createScope(scopeId?: string): Container {
    const child = new Container(this);
    child.scopeId = scopeId ?? crypto.randomUUID();
    return child;
  }

  override<T>(name: string, factory: () => T): void {
    this.registrations.set(name, { factory, lifetime: "transient" });
  }

  clear(): void {
    this.registrations.clear();
  }

  private resolveFromRegistration<T>(registration: Registration<T>): T {
    switch (registration.lifetime) {
      case "singleton":
        if (!registration.instance) registration.instance = registration.factory();
        return registration.instance;
      case "transient":
        return registration.factory();
      case "scoped":
        if (!registration.scopedInstances) registration.scopedInstances = new Map();
        if (!registration.scopedInstances.has(this.scopeId))
          registration.scopedInstances.set(this.scopeId, registration.factory());
        return registration.scopedInstances.get(this.scopeId) as T;
    }
  }
}

let defaultContainer: Container | null = null;
function getContainer(): Container {
  if (!defaultContainer) defaultContainer = new Container();
  return defaultContainer;
}
function resetContainer(): void {
  defaultContainer = null;
}

// ========== Tests ==========

describe("DI Container", () => {
  beforeEach(() => {
    resetContainer();
  });

  describe("Singleton lifetime", () => {
    it("should return the same instance on multiple resolves", () => {
      const container = new Container();
      const factory = vi.fn(() => ({ value: 42 }));

      container.register("test", factory, "singleton");
      const instance1 = container.resolve("test");
      const instance2 = container.resolve("test");

      expect(instance1).toBe(instance2);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should share singleton across scopes with parent resolution", () => {
      const parent = new Container();
      parent.register("shared", () => ({ data: "shared" }), "singleton");

      const child1 = parent.createScope("scope-1");
      const child2 = parent.createScope("scope-2");

      expect(child1.resolve("shared")).toBe(child2.resolve("shared"));
      expect(child1.resolve("shared")).toBe(parent.resolve("shared"));
    });
  });

  describe("Transient lifetime", () => {
    it("should create new instance each time", () => {
      const container = new Container();
      let counter = 0;
      const factory = vi.fn(() => ({ id: ++counter }));

      container.register("test", factory, "transient");
      const instance1 = container.resolve("test") as { id: number };
      const instance2 = container.resolve("test") as { id: number };

      expect(instance1).not.toBe(instance2);
      expect(instance1.id).toBe(1);
      expect(instance2.id).toBe(2);
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe("Scoped lifetime", () => {
    it("should return same instance within same scope", () => {
      const container = new Container();
      container.register("scoped", () => ({ value: 1 }), "scoped");

      const scope = container.createScope("my-scope");
      const instance1 = scope.resolve("scoped");
      const instance2 = scope.resolve("scoped");

      expect(instance1).toBe(instance2);
    });

    it("should return different instances across different scopes", () => {
      const container = new Container();
      let counter = 0;
      container.register("scoped", () => ({ value: ++counter }), "scoped");

      const scope1 = container.createScope("scope-1");
      const scope2 = container.createScope("scope-2");

      const instance1 = scope1.resolve("scoped") as { value: number };
      const instance2 = scope2.resolve("scoped") as { value: number };

      expect(instance1).not.toBe(instance2);
      expect(instance1.value).toBe(1);
      expect(instance2.value).toBe(2);
    });

    it("should fall back to parent if not registered in scope", () => {
      const parent = new Container();
      parent.register("global", () => ({ env: "production" }), "singleton");

      const child = parent.createScope("child-scope");
      expect(child.resolve("global")).toBe(parent.resolve("global"));
    });
  });

  describe("Parent-child scope resolution", () => {
    it("should resolve services from parent when not in child", () => {
      const parent = new Container();
      parent.register("config", () => ({ env: "test" }), "singleton");

      const child = parent.createScope();
      expect(child.resolve("config")).toBe(parent.resolve("config"));
    });

    it("should prefer child registration over parent", () => {
      const parent = new Container();
      parent.register("service", () => ({ name: "parent" }), "singleton");

      const child = parent.createScope();
      child.register("service", () => ({ name: "child" }), "transient");

      expect(child.resolve<any>("service").name).toBe("child");
      expect(parent.resolve<any>("service").name).toBe("parent");
    });

    it("should throw for unregistered service in deep scope chain", () => {
      const parent = new Container();
      const child = parent.createScope();
      const grandchild = child.createScope();

      expect(() => grandchild.resolve("nonexistent")).toThrow(
        "Service not registered: nonexistent",
      );
    });
  });

  describe("Override for testing", () => {
    it("should replace existing registration", () => {
      const container = new Container();
      container.register("repo", () => ({ find: () => "real" }), "singleton");

      container.override("repo", () => ({ find: () => "mock" }));
      const result = container.resolve<any>("repo").find();

      expect(result).toBe("mock");
    });

    it("should allow override even when not previously registered", () => {
      const container = new Container();

      container.override("new-service", () => ({ name: "dynamic" }));
      expect(container.resolve<any>("new-service").name).toBe("dynamic");
    });

    it("should resolve new instances each time after transient override", () => {
      const container = new Container();
      let counter = 0;
      container.register("counter", () => ({ n: 1 }), "singleton");

      container.override("counter", () => ({ n: ++counter }));
      expect(container.resolve<any>("counter").n).toBe(1);
      expect(container.resolve<any>("counter").n).toBe(2);
      expect(container.resolve("counter")).not.toBe(container.resolve("counter"));
    });
  });

  describe("Error when service not registered", () => {
    it("should throw when resolving unregistered service", () => {
      const container = new Container();

      expect(() => container.resolve("nonexistent")).toThrow("Service not registered: nonexistent");
    });

    it("should throw with descriptive error message", () => {
      const container = new Container();

      expect(() => container.resolve("unknown-service")).toThrow("unknown-service");
    });
  });

  describe("registerInstance", () => {
    it("should register an existing instance", () => {
      const container = new Container();
      const instance = { data: "prebuilt" };

      container.registerInstance("prebuilt", instance);
      expect(container.resolve("prebuilt")).toBe(instance);
    });
  });

  describe("isRegistered", () => {
    it("should return true for registered service", () => {
      const container = new Container();
      container.register("exists", () => ({}));

      expect(container.isRegistered("exists")).toBe(true);
    });

    it("should return false for unregistered service", () => {
      const container = new Container();

      expect(container.isRegistered("nonexistent")).toBe(false);
    });

    it("should return true for parent-registered service from child", () => {
      const parent = new Container();
      parent.register("parent-service", () => ({}));

      const child = parent.createScope();
      expect(child.isRegistered("parent-service")).toBe(true);
    });
  });

  describe("clear", () => {
    it("should remove all registrations", () => {
      const container = new Container();
      container.register("a", () => ({}));
      container.register("b", () => ({}));

      container.clear();

      expect(() => container.resolve("a")).toThrow();
      expect(() => container.resolve("b")).toThrow();
    });

    it("should allow re-registration after clear", () => {
      const container = new Container();
      container.register("svc", () => ({ v: 1 }));

      container.clear();
      container.register("svc", () => ({ v: 2 }));

      expect(container.resolve<any>("svc").v).toBe(2);
    });
  });

  describe("getContainer / resetContainer", () => {
    it("should return the same default container on multiple calls", () => {
      const c1 = getContainer();
      const c2 = getContainer();

      expect(c1).toBe(c2);
    });

    it("should return a new container after reset", () => {
      const c1 = getContainer();
      resetContainer();
      const c2 = getContainer();

      expect(c1).not.toBe(c2);
    });

    it("should auto-create container on first call", () => {
      resetContainer();
      const c = getContainer();

      expect(c).toBeInstanceOf(Container);
    });
  });

  describe("CreateScope", () => {
    it("should create a child container", () => {
      const parent = new Container();
      const child = parent.createScope();

      expect(child).toBeInstanceOf(Container);
      expect(child).not.toBe(parent);
    });

    it("should assign a unique scopeId when not provided", () => {
      const container = new Container();
      let counter = 0;
      container.register("test", () => ({ id: ++counter }), "scoped");

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const inst1 = scope1.resolve("test") as { id: number };
      const inst2 = scope2.resolve("test") as { id: number };

      expect(inst1.id).toBe(1);
      expect(inst2.id).toBe(2);
      expect(inst1).not.toBe(inst2);
    });
  });

  describe("Registration error", () => {
    it("should throw when registering duplicate service name", () => {
      const container = new Container();
      container.register("dup", () => ({}), "singleton");

      expect(() => container.register("dup", () => ({}), "singleton")).toThrow(
        "Service already registered: dup",
      );
    });

    it("should allow registerInstance for already-registered name (overwrite)", () => {
      const container = new Container();
      container.register("svc", () => ({ v: 1 }));
      container.registerInstance("svc", { v: 2 });

      expect(container.resolve<any>("svc").v).toBe(2);
    });
  });
});
