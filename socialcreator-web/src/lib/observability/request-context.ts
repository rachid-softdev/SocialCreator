import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  method?: string;
  path?: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | null {
  return requestContextStorage.getStore() ?? null;
}

export function getRequestId(): string {
  return getRequestContext()?.requestId ?? "no-request-id";
}
