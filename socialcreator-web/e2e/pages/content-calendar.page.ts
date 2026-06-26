/**
 * Content Calendar Page Object Model
 * Covers /content/calendar — month/week views, event scheduling, date interactions
 *
 * API endpoints:
 *   GET /api/v1/calendar/events?month=&year= → CalendarEvent[]
 *   POST /api/v1/calendar/events → create event
 *   DELETE /api/v1/calendar/events/{id} → delete event
 *   GET /api/v1/content?groupBy=date → { date: items[] }
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class ContentCalendarPage extends BasePage {
  readonly heading: Locator;
  readonly calendarGrid: Locator;
  readonly monthLabel: Locator;
  readonly nextMonthButton: Locator;
  readonly prevMonthButton: Locator;
  readonly todayButton: Locator;
  readonly weekViewButton: Locator;
  readonly monthViewButton: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;
  readonly errorBanner: Locator;
  readonly eventPopover: Locator;
  readonly createEventButton: Locator;
  readonly scheduleModal: Locator;
  readonly dateCells: Locator;
  readonly eventIndicators: Locator;
  readonly platformFilters: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /calendrier|calendar/i }).first();
    this.calendarGrid = page
      .locator("table")
      .or(page.locator('[class*="grid"]'))
      .or(page.locator('[class*="calendar"]'))
      .first();
    this.monthLabel = page
      .getByText(
        /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december/i,
      )
      .first();
    this.nextMonthButton = page
      .getByRole("button")
      .filter({ hasText: /next|suivant|›|»|→|>/i })
      .first();
    this.prevMonthButton = page
      .getByRole("button")
      .filter({ hasText: /prev|précédent|‹|«|←|</i })
      .first();
    this.todayButton = page
      .getByRole("button")
      .filter({ hasText: /aujourd'hui|today/i })
      .first();
    this.weekViewButton = page
      .getByRole("button")
      .filter({ hasText: /semaine|week/i })
      .first();
    this.monthViewButton = page
      .getByRole("button")
      .filter({ hasText: /mois|month/i })
      .first();
    this.emptyState = page
      .getByText(
        /aucun contenu|rien de prévu|no content scheduled|nothing scheduled|aucun événement/i,
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
      .filter({ hasText: /erreur|error|échec|failed|impossible de charger|unable to load/i })
      .first();
    this.eventPopover = page
      .locator('[role="dialog"], [class*="popover"], [class*="tooltip"], [class*="detail"]')
      .first();
    this.createEventButton = page
      .getByRole("button")
      .filter({ hasText: /créer|create|nouveau|new|ajouter|add/i })
      .first();
    this.scheduleModal = page
      .locator('[role="dialog"], [class*="modal"], [class*="overlay"]')
      .filter({ hasText: /programmer|schedule|planifier/i })
      .first();
    this.dateCells = page.locator("td, [class*='day'], button").filter({ hasText: /^\d+$/ });
    this.eventIndicators = page.locator(
      '[class*="dot"], [class*="indicator"], [class*="badge"], [class*="event"]',
    );
    this.platformFilters = page
      .getByRole("button")
      .filter({ hasText: /twitter|x|linkedin|instagram|facebook|all|tous|linkedin/i });
  }

  override async goto() {
    await super.goto("/content/calendar");
  }

  async getMonthLabelText(): Promise<string> {
    return this.monthLabel.textContent().then((t) => (t ?? "").trim());
  }

  async clickNextMonth(): Promise<void> {
    if (await this.nextMonthButton.isVisible().catch(() => false)) {
      await this.nextMonthButton.click();
    }
  }

  async clickPrevMonth(): Promise<void> {
    if (await this.prevMonthButton.isVisible().catch(() => false)) {
      await this.prevMonthButton.click();
    }
  }

  async clickToday(): Promise<void> {
    if (await this.todayButton.isVisible().catch(() => false)) {
      await this.todayButton.click();
    }
  }

  async clickWeekView(): Promise<void> {
    if (await this.weekViewButton.isVisible().catch(() => false)) {
      await this.weekViewButton.click();
    }
  }

  async clickMonthView(): Promise<void> {
    if (await this.monthViewButton.isVisible().catch(() => false)) {
      await this.monthViewButton.click();
    }
  }

  async clickDate(dayNumber: number): Promise<void> {
    const dateCell = this.page
      .locator("td, [class*='day'], button")
      .filter({ hasText: new RegExp(`^${dayNumber}$|\\b${dayNumber}\\b`) })
      .first();
    if (await dateCell.isVisible().catch(() => false)) {
      await dateCell.click();
    }
  }

  async getEventIndicatorCount(): Promise<number> {
    return this.eventIndicators.count();
  }

  async getDateCellCount(): Promise<number> {
    return this.dateCells.count();
  }

  async isEventPopoverVisible(): Promise<boolean> {
    return this.eventPopover.isVisible().catch(() => false);
  }

  async closePopoverWithEscape(): Promise<void> {
    await this.page.keyboard.press("Escape");
  }

  async closePopoverWithOutsideClick(): Promise<void> {
    await this.page.locator("body").click({ position: { x: 10, y: 10 } });
  }

  async clickCreateEvent(): Promise<void> {
    if (await this.createEventButton.isVisible().catch(() => false)) {
      await this.createEventButton.click();
    }
  }

  async isScheduleModalVisible(): Promise<boolean> {
    return this.scheduleModal.isVisible().catch(() => false);
  }

  async clickPlatformFilter(name: string): Promise<void> {
    const filter = this.platformFilters.filter({ hasText: new RegExp(name, "i") }).first();
    if (await filter.isVisible().catch(() => false)) {
      await filter.click();
    }
  }

  async fillScheduleForm(data: { title?: string; date?: string; time?: string }): Promise<void> {
    if (data.title) {
      const titleInput = this.scheduleModal.locator('input[type="text"], textarea').first();
      await titleInput.fill(data.title);
    }
    if (data.date) {
      const dateInput = this.scheduleModal.locator('input[type="date"]').first();
      if (await dateInput.isVisible().catch(() => false)) {
        await dateInput.fill(data.date);
      }
    }
    if (data.time) {
      const timeInput = this.scheduleModal.locator('input[type="time"]').first();
      if (await timeInput.isVisible().catch(() => false)) {
        await timeInput.fill(data.time);
      }
    }
  }

  async submitScheduleForm(): Promise<void> {
    const submitBtn = this.scheduleModal
      .getByRole("button")
      .filter({ hasText: /programmer|schedule|enregistrer|save|créer|create/i })
      .first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    }
  }

  async cancelScheduleForm(): Promise<void> {
    const cancelBtn = this.scheduleModal
      .getByRole("button")
      .filter({ hasText: /annuler|cancel|fermer|close/i })
      .first();
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    }
  }

  async getFirstEventTitle(): Promise<string> {
    const eventEl = this.page
      .locator('[class*="event"], [class*="content-item"], a[href*="/content/"]')
      .first();
    return (await eventEl.textContent())?.trim() ?? "";
  }

  async clickFirstEvent(): Promise<void> {
    const event = this.page
      .locator('[class*="event"], [class*="content-item"], a[href*="/content/"]')
      .first();
    if (await event.isVisible().catch(() => false)) {
      await event.click();
    }
  }

  async clickDeleteEvent(): Promise<void> {
    const deleteBtn = this.eventPopover
      .getByRole("button")
      .filter({ hasText: /supprimer|delete|retirer|remove|unschedule/i })
      .first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
    }
  }

  async confirmDelete(): Promise<void> {
    const confirmBtn = this.page
      .getByRole("button")
      .filter({ hasText: /confirmer|confirm|oui|yes|supprimer|delete/i })
      .first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }
  }

  async getSuccessToast(): Promise<Locator> {
    return this.page
      .locator('[class*="toast"], [role="status"]')
      .filter({ hasText: /succès|success|programmé|scheduled|créé|created/i })
      .first();
  }
}
