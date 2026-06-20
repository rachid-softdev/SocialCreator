/**
 * DI Container - barrel export (deprecated)
 *
 * @deprecated The DI container was never adopted. Use getRepositories() from
 * "@/lib/repositories" for dependency resolution instead.
 */

export type { Lifetime } from "./container";
// Container class remains exported for backward compatibility but will throw
// if resolve() is called. Use getRepositories() instead.
export { Container, getContainer, resetContainer } from "./container";
