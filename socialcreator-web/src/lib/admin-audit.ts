import { createLogger } from "@/lib/observability/logger";

const auditLogger = createLogger("admin-audit");

export const adminAudit = {
  info(action: string, details: Record<string, unknown>) {
    auditLogger.info({ action, ...details }, `[Admin Audit] ${action}`);
  },
  warn(action: string, details: Record<string, unknown>) {
    auditLogger.warn({ action, ...details }, `[Admin Audit] ${action}`);
  },
  error(action: string, details: Record<string, unknown>) {
    auditLogger.error({ action, ...details }, `[Admin Audit] ${action}`);
  },
};
