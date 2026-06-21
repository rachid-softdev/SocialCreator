/**
 * Blog Page Object Model
 * Covers blog list and blog detail pages
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class BlogListPage extends BasePage {
  readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole("heading", { name: /blog/i });
  }

  override async goto() {
    await super.goto("/blog");
  }

  async getPostCount(): Promise<number> {
    return this.page.locator("article, [class*='post-card'], [class*='blog-post']").count();
  }

  async openPost(slug: string) {
    const link = this.page.locator(`a[href*="/blog/${slug}"]`).first();
    if (await link.isVisible()) {
      await link.click();
    }
  }
}

export class BlogDetailPage extends BasePage {
  readonly heading: Locator;
  readonly content: Locator;
  readonly relatedPosts: Locator;
  readonly seoMeta: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator("article h1").first();
    this.content = page.locator("article").first();
    this.relatedPosts = page
      .getByRole("heading", { name: /related posts|you may also like/i })
      .locator("..");
    this.seoMeta = page.locator('head meta[name="description"], head meta[property="og:title"]');
  }

  override async goto(slug: string) {
    await super.goto(`/blog/${slug}`);
  }

  async getSEOTitle(): Promise<string> {
    const titleEl = this.page.locator('head title');
    return (await titleEl.textContent()) || "";
  }

  async getSEODescription(): Promise<string> {
    const metaDesc = this.page.locator('head meta[name="description"]');
    return (await metaDesc.getAttribute("content")) || "";
  }

  async isRelatedPostsVisible(): Promise<boolean> {
    return this.relatedPosts.isVisible().catch(() => false);
  }
}
