/**
 * Browser utility functions for Puppeteer operations
 */
import { Page } from 'puppeteer';
import * as logger from './logger';
import { WAIT_TIMES } from '../constants/selectors';

/**
 * Navigate to a URL with retry logic
 * @param page Puppeteer Page
 * @param url URL to navigate to
 * @param options Navigation options
 * @returns Promise resolving to boolean indicating success
 */
export async function navigateWithRetry(
  page: Page, 
  url: string, 
  maxRetries = 3,
  options = { waitUntil: 'networkidle2' as 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }
): Promise<boolean> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      logger.debug(`Navigating to ${url} (attempt ${attempts + 1})`);
      await page.goto(url, options);
      return true;
    } catch (error) {
      attempts++;
      logger.warn(`Navigation failed (attempt ${attempts}): ${error.message}`);
      
      if (attempts >= maxRetries) {
        logger.error('Navigation failed after maximum retries', error);
        return false;
      }
      
      // Wait before retrying
      await page.waitForTimeout(1000);
    }
  }
  
  return false;
}

/**
 * Wait for a selector with multiple fallback selectors
 * @param page Puppeteer Page
 * @param selectors Array of selectors to try
 * @param options Selector options
 * @returns Promise resolving to ElementHandle or null
 */
export async function waitForSelectorWithFallback(
  page: Page,
  selectors: string[],
  options = { timeout: WAIT_TIMES.ELEMENT }
) {
  for (const selector of selectors) {
    try {
      logger.debug(`Trying selector: ${selector}`);
      const element = await page.waitForSelector(selector, options);
      if (element) {
        return element;
      }
    } catch (error) {
      logger.debug(`Selector ${selector} not found, trying next fallback`);
    }
  }
  
  logger.warn('All selectors failed to match any elements');
  return null;
}

/**
 * Take a screenshot with meaningful filename
 * @param page Puppeteer Page
 * @param name Base name for the screenshot
 * @returns Promise resolving to path where screenshot was saved
 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().getTime();
  const filename = `linkedin-${name}-${timestamp}.png`;
  
  try {
    await page.screenshot({ path: filename });
    logger.info(`Screenshot saved to ${filename}`);
    return filename;
  } catch (error) {
    logger.error(`Failed to take screenshot ${filename}`, error);
    return '';
  }
}

/**
 * Check if an element is visible on the page
 * @param page Puppeteer Page
 * @param selector CSS selector for the element
 * @returns Promise resolving to boolean indicating visibility
 */
export async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = await page.$(selector);
    if (!element) return false;
    
    const isVisibleHandle = await page.evaluateHandle(el => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, element);
    
    const isVisible = await isVisibleHandle.jsonValue();
    return !!isVisible;
  } catch (error) {
    logger.debug(`Error checking element visibility: ${error.message}`);
    return false;
  }
}