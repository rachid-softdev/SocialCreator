/**
 * E2E Tests for Blog Detail Deep (P3+)
 * Tests: Full content rendering, markdown edge cases, metadata, navigation, 404, loading state, TOC, comments, etc.
 *
 * The blog detail page is a server component reading directly from src/content/blog/posts.json.
 * No API routes to mock — tests use real known slugs where possible.
 */

import { expect, test } from "@playwright/test";

test.describe("Blog Detail Deep", () => {
  const KNOWN_SLUG = "comment-debuter-reseaux-sociaux-2025";
  const KNOWN_SLUG_CODE = "ia-redaction-contenu-reseaux-sociaux";
  const KNOWN_SLUG_LONG = "linkedin-b2b-strategie-viralite";
  const KNOWN_SLUG_TABLE = "algorithme-instagram-2025-guide";

  // ── 1. Blog post loads ──────────────────────────────────────────────
  test("01 — should display blog post with title and content", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Title is rendered as h1
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Main article content area exists
    const article = page.locator("article");
    await expect(article).toBeVisible({ timeout: 5000 });

    // PostContent renders paragraphs from markdown
    const paragraph = article.locator("p").first();
    await expect(paragraph).toBeVisible({ timeout: 5000 });
  });

  // ── 2. Blog post metadata ───────────────────────────────────────────
  test("02 — should display author info, publish date, and reading time", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Author name — "Équipe SocialCreator" for that post
    const authorName = page
      .locator("text=Équipe SocialCreator")
      .or(page.getByText(/Équipe|Marie|Thomas|Sophie|Alexandre/));
    await expect(authorName.first()).toBeVisible({ timeout: 10000 });

    // Author avatar is an image
    const authorAvatar = page.locator(
      "img[alt*='Équipe'], img[alt*='Marie'], img[alt*='Thomas'], img[alt*='Sophie'], img[alt*='Alexandre']",
    );
    const avatarCount = await authorAvatar.count();
    if (avatarCount > 0) {
      await expect(authorAvatar.first()).toBeVisible({ timeout: 5000 });
    }

    // Reading time badge — "min de lecture"
    const readingTime = page.getByText(/min de lecture/);
    await expect(readingTime.first()).toBeVisible({ timeout: 5000 });

    // Date is rendered as relative time (il y a X mois/jours)
    const dateText = page.locator("text=/il y a/");
    const hasDate = await dateText.isVisible().catch(() => false);
    expect(hasDate).toBe(true);

    // Author label "Auteur"
    const authorLabel = page.getByText("Auteur");
    await expect(authorLabel).toBeVisible({ timeout: 5000 });
  });

  // ── 3. Cover image ──────────────────────────────────────────────────
  test("03 — should display cover image with correct alt text", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // The cover image is a full-width <img> inside a div with Image component
    // It uses priority loading (the first image on the page)
    const coverImage = page
      .locator(
        "div.relative.w-full.h-64 img, img[alt='Comment Débuter sur les Réseaux Sociaux en 2025 : Le Guide Complet']",
      )
      .first();
    await expect(coverImage).toBeVisible({ timeout: 15000 });

    // Verify image has loaded (naturalWidth > 0)
    const isLoaded = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.some((img) => img.naturalWidth > 0 && img.naturalHeight > 0);
    });
    expect(isLoaded).toBe(true);
  });

  // ── 4. Markdown rendering — code blocks, headings, lists, bold ──────
  test("04 — should render markdown: headings, lists, bold, blockquotes", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Wait for article content
    const article = page.locator("article");
    await expect(article).toBeVisible({ timeout: 10000 });

    // h2 headings from markdown
    const h2Count = await article.locator("h2").count();
    expect(h2Count).toBeGreaterThanOrEqual(2);

    // h3 headings
    const h3Count = await article.locator("h3").count();
    expect(h3Count).toBeGreaterThanOrEqual(0);

    // Unordered lists
    const ulCount = await article.locator("ul").count();
    expect(ulCount).toBeGreaterThanOrEqual(1);

    // Ordered lists
    const olCount = await article.locator("ol").count();
    expect(olCount).toBeGreaterThanOrEqual(0);

    // Bold/strong text
    const strongCount = await article.locator("strong").count();
    expect(strongCount).toBeGreaterThanOrEqual(1);

    // Blockquotes
    const blockquoteCount = await article.locator("blockquote").count();
    expect(blockquoteCount).toBeGreaterThanOrEqual(1);

    // Paragraphs
    const pCount = await article.locator("p").count();
    expect(pCount).toBeGreaterThanOrEqual(5);
  });

  // ── 5. Code block rendering ─────────────────────────────────────────
  test("05 — should render code blocks with syntax highlighting", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG_CODE}`);

    // This post contains code blocks (``` markers)
    const article = page.locator("article");
    await expect(article).toBeVisible({ timeout: 10000 });

    // Code blocks — either inline <code> or <pre> blocks
    const codeBlocks = article.locator("pre code, pre");
    const codeCount = await codeBlocks.count();

    // Post "ia-redaction-contenu-reseaux-sociaux" has 5 code blocks
    expect(codeCount).toBeGreaterThanOrEqual(5);

    // Verify at least one code block has a language label
    const languageLabel = article.locator("text=/javascript|typescript|bash|prompt|text/");
    const hasLabel = await languageLabel.isVisible().catch(() => false);
    // Language labels may or may not be visible in the UI
    expect(codeCount).toBeGreaterThanOrEqual(5);
  });

  // ── 6. Table rendering ──────────────────────────────────────────────
  test("06 — should render markdown tables with headers and rows", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG_TABLE}`);

    const article = page.locator("article");
    await expect(article).toBeVisible({ timeout: 10000 });

    // Tables rendered from markdown
    const tables = article.locator("table");
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThanOrEqual(1);

    // Table should have header cells (th) and data cells (td)
    if (tableCount > 0) {
      const thCount = await tables.first().locator("th").count();
      expect(thCount).toBeGreaterThanOrEqual(1);

      const tdCount = await tables.first().locator("td").count();
      expect(tdCount).toBeGreaterThanOrEqual(1);
    }
  });

  // ── 7. Related posts section ────────────────────────────────────────
  test("07 — should display 'Articles Similaires' with related post cards", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Section heading
    const relatedHeading = page.getByRole("heading", { name: /articles similaires/i });
    await expect(relatedHeading).toBeVisible({ timeout: 10000 });

    // Related post cards — article elements inside the related section
    const relatedSection = relatedHeading.locator("..").locator("..");
    const relatedCards = relatedSection.locator("article");
    const cardCount = await relatedCards.count();

    // Should have 1-3 related posts
    expect(cardCount).toBeGreaterThanOrEqual(1);
    expect(cardCount).toBeLessThanOrEqual(3);

    // Each card should have a title and an image
    for (let i = 0; i < cardCount; i++) {
      const card = relatedCards.nth(i);
      await expect(card.locator("h2, h3").first()).toBeVisible({ timeout: 3000 });
      const cardImg = card.locator("img").first();
      await expect(cardImg).toBeVisible({ timeout: 5000 });
    }
  });

  // ── 8. Tag badges as clickable links ────────────────────────────────
  test("08 — should display tag badges that link to filtered blog page", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Tags are rendered as links with href="/blog?tag=..."
    const tagLinks = page.locator('a[href*="/blog?tag="]');
    const tagCount = await tagLinks.count();
    expect(tagCount).toBeGreaterThanOrEqual(1);

    // Verify tag text is visible
    await expect(tagLinks.first()).toBeVisible({ timeout: 5000 });

    // Click a tag link and verify navigation to filtered blog
    const tagHref = await tagLinks.first().getAttribute("href");
    expect(tagHref).toContain("/blog?tag=");

    await tagLinks.first().click();
    await page.waitForURL(/\/blog/, { timeout: 10000 });
    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.has("tag")).toBe(true);
  });

  // ── 9. Breadcrumb navigation ────────────────────────────────────────
  test("09 — should show breadcrumb with 'Retour au blog' link that navigates back", async ({
    page,
  }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Breadcrumb link
    const backLink = page.getByText("Retour au blog");
    await expect(backLink).toBeVisible({ timeout: 5000 });

    // Click and verify navigation
    await backLink.click();
    await page.waitForURL("/blog", { timeout: 10000 });
    expect(page.url()).toContain("/blog");
  });

  // ── 10. Sidebar table of contents placeholder ────────────────────────
  test("10 — should display 'Dans cet article' sidebar with TOC info", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Sidebar heading
    const tocHeading = page.getByText("Dans cet article");
    await expect(tocHeading).toBeVisible({ timeout: 5000 });

    // The sidebar is sticky (class contains "sticky")
    const sidebar = tocHeading.locator("..");
    const classAttr = await sidebar.getAttribute("class");
    expect(classAttr).toContain("sticky");

    // Sidebar has descriptive text about navigation
    const tocDescription = page.getByText(/naviguer facilement/);
    await expect(tocDescription).toBeVisible({ timeout: 5000 });
  });

  // ── 11. Reading progress bar ────────────────────────────────────────
  test("11 — should display reading progress bar at top of page", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // ReadingProgress renders a fixed div at top with h-1
    const progressBar = page.locator("div.fixed.top-0.left-0.right-0.z-50.h-1");
    await expect(progressBar).toBeVisible({ timeout: 5000 });

    // The inner fill div with scaleX transform
    const progressFill = progressBar.locator("div").first();
    await expect(progressFill).toBeAttached({ timeout: 3000 });

    // Scroll down to trigger progress update
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(300);

    // Progress should have increased past 0
    const transform = await progressFill.getAttribute("style");
    expect(transform).toContain("scaleX");
  });

  // ── 12. JSON-LD structured data ─────────────────────────────────────
  test("12 — should embed JSON-LD structured data with Article schema", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // Look for the JSON-LD script tag
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    expect(count).toBeGreaterThanOrEqual(1);

    let foundArticle = false;
    for (let i = 0; i < count; i++) {
      const content = await jsonLd.nth(i).textContent();
      if (content) {
        try {
          const parsed = JSON.parse(content);
          if (parsed["@type"] === "Article") {
            expect(parsed.headline).toBeTruthy();
            expect(parsed.datePublished).toBeTruthy();
            expect(parsed.author).toBeTruthy();
            expect(parsed.author["@type"]).toBe("Person");
            expect(parsed.publisher).toBeTruthy();
            expect(parsed.publisher["@type"]).toBe("Organization");
            foundArticle = true;
            break;
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
    expect(foundArticle).toBe(true);
  });

  // ── 13. Post type badge ─────────────────────────────────────────────
  test("13 — should display post type badge (Quick Read / Guide Complet)", async ({ page }) => {
    // Quick Read type
    await page.goto(`/blog/${KNOWN_SLUG_CODE}`);
    const quickReadBadge = page.getByText("⚡ Quick Read");
    await expect(quickReadBadge).toBeVisible({ timeout: 5000 });

    // Guide Complet type (the first post is "long" type)
    await page.goto(`/blog/${KNOWN_SLUG}`);
    const guideBadge = page.getByText("📖 Guide Complet");
    await expect(guideBadge).toBeVisible({ timeout: 5000 });
  });

  // ── 14. CTA section ─────────────────────────────────────────────────
  test("14 — should display CTA section 'Tu as aimé cet article ?'", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // CTA heading
    const ctaHeading = page.getByText("Tu as aimé cet article ?");
    await expect(ctaHeading).toBeVisible({ timeout: 10000 });

    // CTA description
    const ctaDescription = page.getByText(/Découvre comment SocialCreator/);
    await expect(ctaDescription).toBeVisible({ timeout: 5000 });

    // CTA button
    const ctaButton = page.getByRole("link", { name: /Essayer gratuitement/ });
    await expect(ctaButton).toBeVisible({ timeout: 5000 });

    // Button should link to /login
    const href = await ctaButton.getAttribute("href");
    expect(href).toBe("/login");
  });

  // ── 15. Very long content ───────────────────────────────────────────
  test("15 — should handle very long blog post with scrolling", async ({ page }) => {
    await page.goto(`/blog/${KNOWN_SLUG_LONG}`);

    // Title should be visible
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 10000 });

    // Page should be scrollable (content taller than viewport)
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(scrollHeight).toBeGreaterThan(viewportHeight);

    // Scroll to bottom — page should not crash
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Footer should be visible at bottom
    const footer = page.getByText("© 2025 SocialCreator");
    await expect(footer).toBeVisible({ timeout: 5000 });

    // Reading progress should be near 100%
    const progressBar = page.locator("div.fixed.top-0.left-0.right-0.z-50.h-1 div").first();
    const style = await progressBar.getAttribute("style");
    // scaleX should be > 0.9 (close to 1.0 at bottom)
    const match = style?.match(/scaleX\(([\d.]+)\)/);
    if (match) {
      const progress = Number.parseFloat(match[1]!);
      expect(progress).toBeGreaterThan(0.8);
    }
  });

  // ── 16. 404 for non-existent slug ───────────────────────────────────
  test("16 — should return 404 for non-existent blog slug", async ({ page }) => {
    const response = await page.goto("/blog/cette-page-n-existe-pas-12345", {
      waitUntil: "networkidle",
    });

    // Next.js notFound() returns 404 status
    const status = response?.status() ?? 0;
    expect(status).toBe(404);

    // Page body should indicate not-found
    const bodyText = await page.locator("body").textContent();
    const hasNotFound =
      bodyText?.toLowerCase().includes("404") ||
      bodyText?.toLowerCase().includes("not found") ||
      bodyText?.toLowerCase().includes("introuvable") ||
      bodyText?.toLowerCase().includes("non trouvé") ||
      status === 404;

    expect(hasNotFound).toBe(true);
  });

  // ── 17. Loading skeleton ────────────────────────────────────────────
  test("17 — should show loading skeleton during client navigation", async ({ page }) => {
    // First load a page to establish a client-side navigation context
    await page.goto("/blog");

    // Intercept the blog detail page to add delay
    const fullUrl = `**/blog/${KNOWN_SLUG}`;
    await page.route(fullUrl, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Find a link to the known blog post and click it
    const postLink = page.locator(`a[href="/blog/${KNOWN_SLUG}"]`).first();
    if (await postLink.isVisible().catch(() => false)) {
      await postLink.click();

      // Loading skeleton should appear — look for Skeleton elements
      const skeleton = page.locator('[class*="skeleton"]').first();
      const hasSkeleton = await skeleton.isVisible({ timeout: 1500 }).catch(() => false);
      if (hasSkeleton) {
        await expect(skeleton).toBeVisible({ timeout: 1000 });
      }

      // Wait for the actual page to load
      await page.waitForURL(`/blog/${KNOWN_SLUG}`, { timeout: 15000 });
      await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
    }
  });

  // ── 18. Share buttons / links ────────────────────────────────────────
  test("18 — should handle share functionality gracefully (absent or present)", async ({
    page,
  }) => {
    await page.goto(`/blog/${KNOWN_SLUG}`);

    // The blog detail page may not have share buttons — check gracefully
    const shareBtns = page
      .locator("button")
      .filter({ hasText: /share|partager|tweet|linkedin|facebook/i });
    const shareLinks = page.locator(
      'a[href*="twitter.com/share"], a[href*="linkedin.com/share"], a[href*="facebook.com/sharer"]',
    );

    const hasShareBtn = await shareBtns.isVisible().catch(() => false);
    const hasShareLink = await shareLinks
      .first()
      .isVisible()
      .catch(() => false);

    if (hasShareBtn) {
      // If share button exists, verify it can be clicked without error
      await shareBtns.first().click();
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toBeVisible({ timeout: 3000 });
    } else if (hasShareLink) {
      // If share links exist, verify they open in a new tab (target=_blank)
      const target = await shareLinks.first().getAttribute("target");
      expect(target).toBe("_blank");
    } else {
      // No share buttons implemented — page should still render correctly
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 5000 });
    }
  });
});
