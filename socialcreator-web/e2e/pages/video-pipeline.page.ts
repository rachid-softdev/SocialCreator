/**
 * Video Pipeline Page Object Model
 * Covers video upload, transcription status, and segment management
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class VideoPipelinePage extends BasePage {
  readonly heading: Locator;
  readonly uploadButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /video pipeline/i });
    this.uploadButton = page.getByRole("button", { name: /upload/i });
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/video`);
  }

  async uploadVideo(filePath: string) {
    // Click upload button to trigger file input
    await this.uploadButton.click();

    // Find hidden file input and set file
    const fileInput = this.page.locator('input[type="file"]').first();
    if (await fileInput.isVisible().catch(() => false)) {
      await fileInput.setInputFiles(filePath);
    } else {
      // File input may appear after clicking upload
      await this.page.waitForSelector('input[type="file"]', { timeout: 5000 });
      const deferredInput = this.page.locator('input[type="file"]').first();
      await deferredInput.setInputFiles(filePath);
    }
  }

  async getTranscriptionStatus(): Promise<string> {
    const statusEl = this.page
      .locator("[class*='transcription-status'], [data-testid='transcription-status']")
      .first();
    if (await statusEl.isVisible().catch(() => false)) {
      return (await statusEl.textContent()) || "";
    }
    return "";
  }

  async getSegmentCount(): Promise<number> {
    return this.page
      .locator("[class*='segment'], [class*='segment-card'], [role='listitem']")
      .count();
  }

  async waitForTranscription(timeout = 60000): Promise<boolean> {
    try {
      await expect(
        this.page
          .getByText(/transcription complete|transcription done/i)
          .or(this.page.getByText(/transcription failed/i)),
      ).toBeVisible({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async hasGeneratedContent(): Promise<boolean> {
    return this.page
      .getByText(/generated content|generated posts|content ready/i)
      .isVisible()
      .catch(() => false);
  }
}
