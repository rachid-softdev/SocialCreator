/**
 * Content validators per platform
 * Pre-publish validation rules
 */

import type { ContentValidator, PublishContent } from "./types";

/**
 * Create a character limit validator
 */
export function characterLimitValidator(maxChars: number): ContentValidator {
  return async (content: PublishContent) => {
    const errors: string[] = [];

    if (content.textContent.length > maxChars) {
      errors.push(`Text exceeds ${maxChars} character limit`);
    }

    return { valid: errors.length === 0, errors, warnings: [] };
  };
}

/**
 * Create a media requirement validator
 */
export function mediaRequiredValidator(
  requiredCount: number,
  allowedTypes?: string[],
): ContentValidator {
  return async (content: PublishContent) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (content.mediaUrls.length < requiredCount) {
      errors.push(
        `At least ${requiredCount} media file(s) required, got ${content.mediaUrls.length}`,
      );
    }

    if (allowedTypes && content.mediaUrls.length > 0) {
      const hasAllowedType = content.mediaUrls.some((url) =>
        allowedTypes.some((ext) => url.toLowerCase().endsWith(ext)),
      );
      if (!hasAllowedType) {
        warnings.push(`No media file matches allowed types: ${allowedTypes.join(", ")}`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  };
}

/**
 * X (Twitter) validator: 4000 char limit
 */
export const xValidator: ContentValidator = characterLimitValidator(4000);

/**
 * TikTok validator: requires at least one video file
 */
export const tiktokValidator: ContentValidator = async (content: PublishContent) => {
  const errors: string[] = [];

  if (!content.mediaUrls.some((u) => u.replace(/\?.*$/, "").match(/\.(mp4|mov|webm)$/i))) {
    errors.push("TikTok requires at least one video file (.mp4, .mov, .webm)");
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Instagram validator: 2200 char limit, requires media
 */
export const instagramValidator: ContentValidator = mediaRequiredValidator(1);

/**
 * LinkedIn validator: 3000 char limit
 */
export const linkedinValidator: ContentValidator = characterLimitValidator(3000);
