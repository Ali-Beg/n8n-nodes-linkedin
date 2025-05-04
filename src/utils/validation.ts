/**
 * Validation utilities for LinkedIn operations
 */

/**
 * Validates if a URL is a valid LinkedIn post URL
 * @param url URL to validate
 * @returns boolean indicating if URL is valid
 */
export function isValidLinkedInPostUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('linkedin.com/feed/update/') || url.includes('linkedin.com/posts/');
}

/**
 * Validates if a URL is a valid LinkedIn profile URL
 * @param url URL to validate
 * @returns boolean indicating if URL is valid
 */
export function isValidLinkedInProfileUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('linkedin.com/in/');
}

/**
 * Validates if a URL is a valid LinkedIn company URL
 * @param url URL to validate
 * @returns boolean indicating if URL is valid
 */
export function isValidLinkedInCompanyUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('linkedin.com/company/');
}