/**
 * Environment-aware logger barrel.
 *
 * On the client (browser): uses a lightweight console-based proxy to
 * avoid bundling pino (which depends on Node.js built-ins like
 * async_hooks). Server-only logging functions (createLogger, getLogger)
 * are re-exported from the pino logger but will fail at compile time if
 * imported from client bundles — server code should use `@/lib/logger`
 * directly and client code should only use the default export.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type LogFn = (msg: string, ...args: any[]) => void;

interface Logger {
  level: string;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  trace: LogFn;
  child(bindings: Record<string, unknown>): Logger;
}

const isClient = typeof window !== "undefined";

function createConsoleLogger(bindings?: Record<string, unknown>): Logger {
  const prefix = bindings ? `[${Object.values(bindings).filter(Boolean).join(":")}]` : "";

  const log =
    (method: "debug" | "info" | "warn" | "error"): LogFn =>
    (msg, ...args) => {
      const fullMsg = prefix ? `${prefix} ${msg}` : msg;
      console[method](fullMsg, ...args);
    };

  return {
    level: "debug",
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    fatal: log("error"),
    trace: log("debug"),
    child: (newBindings) => createConsoleLogger({ ...bindings, ...newBindings }),
  };
}

// In the browser, use a console-based logger immediately (no pino bundling).
// On the server, lazily import the real pino logger to avoid bundling it
// for client chunks. The dynamic import() keeps webpack from resolving
// pino's Node.js dependencies at compile time on the client.
let serverLogger: any = null;

async function getServerLogger(): Promise<any> {
  if (!serverLogger) {
    const mod = await import("./observability/logger");
    serverLogger = mod.default;
  }
  return serverLogger;
}

function createProxy(): Logger {
  const handler: ProxyHandler<any> = {
    get(_target, prop: string) {
      if (["debug", "info", "warn", "error", "fatal", "trace"].includes(prop)) {
        return (...args: any[]) => {
          getServerLogger().then((l: any) => {
            if (typeof l[prop] === "function") l[prop](...args);
          });
        };
      }
      if (prop === "child") {
        return (bindings: Record<string, unknown>) => {
          const childHandler: ProxyHandler<any> = {
            get(_c, childProp: string) {
              return (...args: any[]) => {
                getServerLogger().then((l: any) => {
                  const child = l.child(bindings);
                  if (typeof child[childProp] === "function") child[childProp](...args);
                });
              };
            },
          };
          return new Proxy({}, childHandler) as Logger;
        };
      }
      return undefined;
    },
  };
  return new Proxy({}, handler) as Logger;
}

const logger: Logger = isClient ? createConsoleLogger() : createProxy();

export default logger;
