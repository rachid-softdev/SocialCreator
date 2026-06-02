/**
 * DI Container - barrel export
 */

export { createDefaultContainer, registerDefaultServices } from "./adapters";
export type { Lifetime } from "./container";
export { Container, getContainer, resetContainer } from "./container";
export type { Token } from "./token";
export { TOKENS } from "./token";
