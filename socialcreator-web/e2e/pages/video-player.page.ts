/**
 * Video Player & Clip Selector Page Object Model
 * Covers the video pipeline page at /profiles/[profileId]/video with player, clips, and generation
 */

import type { Locator, Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class VideoPlayerPage extends BasePage {
  readonly heading: Locator;
  readonly previewSection: Locator;
  readonly videoContainer: Locator;
  readonly videoElement: Locator;
  readonly clipsHeading: Locator;
  readonly generateButton: Locator;
  readonly selectAllButton: Locator;
  readonly deselectAllButton: Locator;
  readonly progressStepper: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /video pipeline/i });
    this.previewSection = page.getByText(/preview/i);
    this.videoContainer = page.locator('[class*="aspect-video"]');
    this.videoElement = page.locator("video[controls]");
    this.clipsHeading = page.getByText(/identified clips/i);
    this.generateButton = page.locator("button").filter({ hasText: /generate content for/i });
    this.selectAllButton = page.locator("button").filter({ hasText: /select all/i });
    this.deselectAllButton = page.locator("button").filter({ hasText: /deselect all/i });
    this.progressStepper = page
      .getByText(/upload/i)
      .or(page.getByText(/transcrib/i))
      .or(page.getByText(/segment/i))
      .or(page.getByText(/clip/i));
  }

  override async goto(profileId: string) {
    await super.goto(`/profiles/${profileId}/video`);
  }

  async isHeadingVisible(): Promise<boolean> {
    return this.heading.isVisible().catch(() => false);
  }

  async getSegmentCount(): Promise<number> {
    return this.page
      .locator("button")
      .filter({ hasText: /clip \d/i })
      .count();
  }

  async getSegmentHooks(): Promise<string[]> {
    return this.page
      .locator('[class*="segment"] [class*="hook"], [class*="clip"] [class*="title"]')
      .allTextContents();
  }

  async clickSegmentByHook(hook: string) {
    const btn = this.page
      .locator("button")
      .filter({ hasText: new RegExp(hook, "i") })
      .first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
    }
  }

  async getSelectionCountText(): Promise<string> {
    const el = this.page.getByText(/\d+ of \d+ selected/);
    if (await el.isVisible().catch(() => false)) {
      return (await el.textContent()) || "";
    }
    return "";
  }

  async clickSelectAll() {
    if (await this.selectAllButton.isVisible().catch(() => false)) {
      await this.selectAllButton.click();
    }
  }

  async clickDeselectAll() {
    if (await this.deselectAllButton.isVisible().catch(() => false)) {
      await this.deselectAllButton.click();
    }
  }

  async clickGenerate() {
    if (await this.generateButton.isVisible().catch(() => false)) {
      await this.generateButton.click();
    }
  }

  async isGenerateDisabled(): Promise<boolean> {
    if (await this.generateButton.isVisible().catch(() => false)) {
      return this.generateButton.isDisabled().catch(() => false);
    }
    return true;
  }

  async hasUploadPlaceholder(): Promise<boolean> {
    return this.page
      .getByText(/upload a video to preview|upload your video|upload a video/i)
      .isVisible()
      .catch(() => false);
  }

  async isVideoVisible(): Promise<boolean> {
    return this.videoElement.isVisible().catch(() => false);
  }

  async isContainerVisible(): Promise<boolean> {
    return this.videoContainer.isVisible().catch(() => false);
  }

  async isStepperVisible(): Promise<boolean> {
    return this.progressStepper
      .first()
      .isVisible()
      .catch(() => false);
  }

  async getClipCountInDOM(): Promise<number> {
    return this.page.getByText(/clip \d+: .*/i).count();
  }

  async isCheckIconVisible(): Promise<boolean> {
    return this.page
      .locator('[class*="gradient-mint"], [class*="check"]')
      .first()
      .isVisible()
      .catch(() => false);
  }

  async hasDurationText(): Promise<boolean> {
    return this.page
      .getByText(/\d+m \ds|\d+:\d{2}/)
      .isVisible()
      .catch(() => false);
  }
}
