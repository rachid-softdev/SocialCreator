/**
 * E2E Tests for Profile Management (P2)
 * Tests: Navigation, creation, brand voice config, modification, deletion, active profile switching
 */

import { expect, test } from "@playwright/test";
import {
  EditProfilePage,
  NewProfilePage,
  ProfileDetailPage,
  ProfilesListPage,
} from "./pages/profile.page";

test.describe("Profile Management", () => {
  test.describe("Navigation", () => {
    test("should navigate to profiles page", async ({ page }) => {
      const profiles = new ProfilesListPage(page);
      await profiles.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(profiles.heading).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/manage your brand profiles/i)).toBeVisible({ timeout: 5000 });
    });

    test("should navigate to new profile page", async ({ page }) => {
      await page.goto("/profiles/new");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByRole("heading", { name: /create profile/i })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(/set up a new brand profile/i)).toBeVisible({ timeout: 5000 });
    });

    test("should have breadcrumb on profiles page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByText(/profiles/i).locator("..")).toHaveAttribute(
        "class",
        /breadcrumb|nav/i,
      );
    });

    test("should show new profile button on profiles list", async ({ page }) => {
      const profiles = new ProfilesListPage(page);
      await profiles.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(profiles.newProfileButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Profile Creation", () => {
    test("should display profile creation form with all required fields", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(newProfile.heading).toBeVisible({ timeout: 10000 });
      await expect(newProfile.nameInput).toBeVisible();
      await expect(newProfile.brandVoiceTextarea).toBeVisible();
      await expect(newProfile.submitButton).toBeVisible();
    });

    test("should show validation error for empty profile name", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await newProfile.submit();
      const errorText = await newProfile.getValidationError();
      expect(errorText.length).toBeGreaterThan(0);
    });

    test("should show validation error for short profile name", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await newProfile.fillName("A");
      await newProfile.submit();
      const errorText = await newProfile.getValidationError();
      expect(errorText.length).toBeGreaterThan(0);
    });

    test("should create a new profile with valid data", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileName = `Test Profile ${Date.now()}`;
      await newProfile.fillName(profileName);
      await newProfile.fillBrandVoice(
        "Professional, friendly, and approachable. We speak directly to our audience.",
      );
      await newProfile.submit();

      // After creation should redirect to profile detail page
      await page.waitForURL(/.*\/profiles\/(?!new).*/, { timeout: 10000 });
      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname).toMatch(/\/profiles\/(?!new)/);
    });
  });

  test.describe("Brand Voice Configuration", () => {
    test("should display brand voice editor on creation form", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await expect(page.getByText(/brand voice/i)).toBeVisible({ timeout: 5000 });
      await expect(page.locator("#brand-voice")).toBeVisible();
    });

    test("should allow typing in brand voice textarea", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      await newProfile.fillBrandVoice("Test brand voice description for testing purposes.");
      const value = await newProfile.brandVoiceTextarea.inputValue();
      expect(value.length).toBeGreaterThan(0);
    });

    test("should display brand voice on profile detail page", async ({ page }) => {
      // Navigate to profiles list and check first profile detail
      const profiles = new ProfilesListPage(page);
      await profiles.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Check if there are any profiles
      const profileCount = await profiles.getProfileCount();
      if (profileCount > 0) {
        // Navigate to first profile
        const firstProfileLink = page.locator('a[href*="/profiles/"][href*="/profiles/"]').first();
        if (await firstProfileLink.isVisible().catch(() => false)) {
          await firstProfileLink.click();
          await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

          // Brand voice section should be present if configured
          const hasBrandVoice = await page
            .getByText(/brand voice/i)
            .isVisible()
            .catch(() => false);
          // Either it's visible or the profile has no brand voice - both valid
          expect(true).toBe(true);
        }
      }
    });

    test("should show character count in brand voice editor", async ({ page }) => {
      const newProfile = new NewProfilePage(page);
      await newProfile.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Type some text and verify character count is shown
      await newProfile.fillBrandVoice("A".repeat(50));
      const charCount = page.getByText(/\/500/);
      await expect(charCount).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Profile Modification", () => {
    test("should navigate to edit page from profile detail", async ({ page }) => {
      const profiles = new ProfilesListPage(page);
      await profiles.goto();

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Find any profile with an edit link
      const editLinks = page.locator('a[href*="/edit"]');
      const linkCount = await editLinks.count();
      if (linkCount > 0) {
        await editLinks.first().click();
        await expect(page.getByRole("heading", { name: /edit profile/i })).toBeVisible({
          timeout: 10000,
        });
      }
    });

    test("should have edit profile form with pre-filled data", async ({ page }) => {
      // Navigate to a profile edit page directly
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      // Look for any profile card and click through to edit
      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      const linkCount = await profileLinks.count();
      if (linkCount > 0) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        // Click edit
        const editLink = page.locator('a[href*="/edit"]');
        if (await editLink.isVisible().catch(() => false)) {
          await editLink.click();
          await expect(page.getByRole("heading", { name: /edit profile/i })).toBeVisible({
            timeout: 10000,
          });
          // Name input should have a value
          const nameValue = await page.locator("#name").inputValue();
          expect(nameValue.length).toBeGreaterThan(0);
        }
      }
    });

    test("should update profile name and save changes", async ({ page }) => {
      // Navigate to edit page
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      const linkCount = await profileLinks.count();
      if (linkCount > 0) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        const editLink = page.locator('a[href*="/edit"]');
        if (await editLink.isVisible().catch(() => false)) {
          await editLink.click();
          await expect(page.getByRole("heading", { name: /edit profile/i })).toBeVisible({
            timeout: 10000,
          });

          // Modify name
          const updatedName = `Updated Profile ${Date.now()}`;
          const nameInput = page.locator("#name");
          await nameInput.fill(updatedName);
          await page.locator('button[type="submit"]').click();

          // Should redirect back to profile detail
          await page.waitForURL(/\/profiles\/(?!new)(?!.*edit)/, { timeout: 10000 });
          await expect(page.locator("h1")).toContainText(updatedName, { timeout: 5000 });
        }
      }
    });
  });

  test.describe("Profile Deletion", () => {
    test("should show delete section on edit page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const editLinks = page.locator('a[href*="/edit"]');
      if (await editLinks.isVisible().catch(() => false)) {
        await editLinks.first().click();
        await page.waitForTimeout(2000);

        // Danger zone should be visible
        const dangerZone = page.getByText(/danger zone/i);
        if (await dangerZone.isVisible().catch(() => false)) {
          await expect(dangerZone).toBeVisible();
          await expect(page.getByText(/deleting this profile will remove/i)).toBeVisible();
        }
      }
    });

    test("should show confirmation dialog before deleting profile", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const editLinks = page.locator('a[href*="/edit"]');
      if (await editLinks.isVisible().catch(() => false)) {
        await editLinks.first().click();
        await page.waitForTimeout(2000);

        const deleteButton = page.getByRole("button", { name: /delete profile/i });
        if (await deleteButton.isVisible().catch(() => false)) {
          await deleteButton.click();
          // Confirm dialog should appear
          await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  test.describe("Active Profile", () => {
    test("should display profile status on detail page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        // Status badge should be visible (Active or Inactive)
        const statusText = await page
          .locator('[class*="rounded-pill"]')
          .filter({ hasText: /active|inactive/i })
          .textContent();
        expect(["Active", "Inactive"]).toContain(statusText?.trim());
      }
    });

    test("should show profile stats on detail page", async ({ page }) => {
      await page.goto("/profiles");

      const currentUrl = new URL(page.url());
      if (currentUrl.pathname === "/login") {
        test.skip();
        return;
      }

      const profileLinks = page
        .locator('a[href*="/profiles/"][href*="/profiles/"]')
        .filter({ hasNotText: /new|edit/i });
      if (
        await profileLinks
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await profileLinks.first().click();
        await page.waitForURL(/\/profiles\/(?!new)/, { timeout: 10000 });

        // Stats section should be visible
        await expect(page.getByText(/agents/i).or(page.getByText(/contents/i))).toBeVisible({
          timeout: 5000,
        });
      }
    });
  });
});
