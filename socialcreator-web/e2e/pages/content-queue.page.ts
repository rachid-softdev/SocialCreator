/**
 * Content Queue Page Object Model
 * Covers /content/queue — publish queue list with filtering, sorting, job actions
 *
 * API endpoints:
 *   GET /api/v1/queue/jobs → QueueJobItem[]
 *   GET /api/v1/queue/status → { queued, running, completed, failed, total }
 *   POST /api/v1/queue/jobs/{jobId}/retry
 *   POST /api/v1/queue/jobs/{jobId}/cancel
 *   GET /api/v1/queue/jobs?page=1&pageSize=20 → paginated response
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentQueuePage extends BasePage {
  readonly heading: Locator;
  readonly queueList: Locator;
  readonly jobRows: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorBanner: Locator;
  readonly statusFilters: Locator;
  readonly typeFilters: Locator;
  readonly searchInput: Locator;
  readonly retryButtons: Locator;
  readonly cancelButtons: Locator;
  readonly previousButton: Locator;
  readonly nextButton: Locator;
  readonly pageIndicator: Locator;
  readonly confirmationDialog: Locator;
  readonly successToast: Locator;
  readonly sortSelect: Locator;
  readonly summaryStats: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page
      .getByRole("heading", { name: /file d'attente|queue|publish queue|publication/i })
      .first();
    this.queueList = page
      .locator("table")
      .or(page.locator('[class*="list"]'))
      .or(page.locator('[class*="queue-items"]'))
      .first();
    this.jobRows = page
      .locator("table tbody tr")
      .or(page.locator('[class*="job-item"]'))
      .or(page.locator('[class*="queue-item"]'));
    this.emptyState = page
      .getByText(
        /aucun job|aucun élément|rien à publier|no jobs|no items|empty|nothing queued|aucune tâche/i,
      )
      .first();
    this.loadingSpinner = page
      .locator(
        '[class*="spinner"], [class*="loading"], [class*="skeleton"], .animate-spin, .animate-pulse',
      )
      .first();
    this.errorBanner = page
      .locator('[role="alert"]')
      .or(page.locator('[class*="error"]'))
      .filter({ hasText: /erreur|error|échec|failed|impossible|unable/i })
      .first();
    this.statusFilters = page.getByRole("button").filter({
      hasText:
        /all|tous|pending|en attente|running|en cours|completed|terminé|failed|échoué|queued/i,
    });
    this.typeFilters = page
      .getByRole("button")
      .filter({
        hasText:
          /publish|publier|schedule|programmer|retry|all type|social|content|tous les types/i,
      })
      .or(page.locator("select"));
    this.searchInput = page
      .locator(
        'input[type="search"], input[placeholder*="rechercher"], input[placeholder*="search"]',
      )
      .first();
    this.retryButtons = page
      .getByRole("button")
      .filter({ hasText: /réessayer|retry|relancer|try again/i });
    this.cancelButtons = page
      .getByRole("button")
      .filter({ hasText: /annuler|cancel|supprimer|remove/i });
    this.previousButton = page.getByRole("button", { name: /précédent|previous/i });
    this.nextButton = page.getByRole("button", { name: /suivant|next/i });
    this.pageIndicator = page.locator("span").filter({ hasText: /page \d+ (of|sur|de) \d+/i });
    this.confirmationDialog = page
      .locator('[role="dialog"], [class*="modal"]')
      .filter({ hasText: /confirmer|confirm|annuler|cancel/i })
      .first();
    this.successToast = page
      .locator('[class*="toast"], [role="status"]')
      .filter({ hasText: /succès|success|relancé|retried|annulé|cancelled/i })
      .first();
    this.sortSelect = page
      .locator("select")
      .filter({ hasText: /date|priority|priorité|type|statut|status/i })
      .or(page.getByRole("button").filter({ hasText: /trier|sort/i }));
    this.summaryStats = page
      .locator('[class*="stats"], [class*="summary"]')
      .or(page.getByText(/\d+ (total|pending|completed|failed|en attente|terminé|échoué)/i))
      .first();
  }

  override async goto() {
    await super.goto("/content/queue");
  }

  async getJobCount(): Promise<number> {
    return this.jobRows.count();
  }

  async getJobStatusAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator('[class*="badge"], [class*="pill"], [class*="status"], td:nth-child(3) span')
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getJobTypeAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(2)")
      .or(this.jobRows.nth(index).locator('[class*="type"]'))
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async getJobTitleAt(index: number): Promise<string> {
    return this.jobRows
      .nth(index)
      .locator("td:nth-child(1) a, [class*='title'] a")
      .first()
      .textContent()
      .then((t) => (t ?? "").trim());
  }

  async clickJobAt(index: number): Promise<void> {
    const job = this.jobRows.nth(index);
    if (await job.isVisible().catch(() => false)) {
      await job.click();
    }
  }

  async clickRetryOnRow(index: number): Promise<void> {
    const retryBtn = this.jobRows
      .nth(index)
      .getByRole("button")
      .filter({ hasText: /réessayer|retry|relancer|try again/i });
    if (await retryBtn.isVisible().catch(() => false)) {
      await retryBtn.click();
    }
  }

  async clickCancelOnRow(index: number): Promise<void> {
    const cancelBtn = this.jobRows
      .nth(index)
      .getByRole("button")
      .filter({ hasText: /annuler|cancel|supprimer|remove/i });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
  }

  async confirmAction(): Promise<void> {
    const confirmBtn = this.confirmationDialog
      .getByRole("button")
      .filter({ hasText: /confirmer|confirm|oui|yes|supprimer|delete|annuler|cancel/i })
      .first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
  }

  async dismissConfirmation(): Promise<void> {
    const dismissBtn = this.confirmationDialog
      .getByRole("button")
      .filter({ hasText: /non|no|fermer|close|annuler|cancel/i })
      .first();
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
    }
  }

  async filterByStatus(status: string): Promise<void> {
    const filterBtn = this.statusFilters.filter({ hasText: new RegExp(status, "i") }).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click();
    }
  }

  async filterByType(type: string): Promise<void> {
    const filterBtn = this.typeFilters.filter({ hasText: new RegExp(type, "i") }).first();
    if (await filterBtn.isVisible().catch(() => false)) {
      await filterBtn.click();
    }
  }

  async search(query: string): Promise<void> {
    if (await this.searchInput.isVisible().catch(() => false)) {
      await this.searchInput.fill(query);
      await this.searchInput.press("Enter");
    }
  }

  async clickPrevious(): Promise<void> {
    if (await this.previousButton.isVisible().catch(() => false)) {
      await this.previousButton.click();
    }
  }

  async clickNext(): Promise<void> {
    if (await this.nextButton.isVisible().catch(() => false)) {
      await this.nextButton.click();
    }
  }

  async isPreviousDisabled(): Promise<boolean> {
    return this.previousButton.isDisabled().catch(() => true);
  }

  async isNextDisabled(): Promise<boolean> {
    return this.nextButton.isDisabled().catch(() => true);
  }

  async getPageText(): Promise<string> {
    return this.pageIndicator.textContent().then((t) => (t ?? "").trim());
  }

  async getRetryCount(): Promise<number> {
    return this.retryButtons.count();
  }

  async getCancelCount(): Promise<number> {
    return this.cancelButtons.count();
  }

  async isSuccessToastVisible(): Promise<boolean> {
    return this.successToast.isVisible().catch(() => false);
  }

  async getStatsText(): Promise<string> {
    return this.summaryStats.textContent().then((t) => (t ?? "").trim());
  }

  async isConfirmationVisible(): Promise<boolean> {
    return this.confirmationDialog.isVisible().catch(() => false);
  }
}
