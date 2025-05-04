/**
 * Post Service
 * Handles LinkedIn post interactions such as liking posts, commenting, etc.
 */
import { IExecuteFunctions } from 'n8n-core';
import { Page } from 'puppeteer';
import { SELECTORS, WAIT_TIMES } from '../constants/selectors';
import * as logger from '../utils/logger';
import { isValidLinkedInPostUrl } from '../utils/validation';
import { navigateWithRetry, waitForSelectorWithFallback, takeScreenshot } from '../utils/browser';
import { LinkedInPost } from '../types/linkedin';

/**
 * Like a LinkedIn post by URL
 */
export async function likePost(this: IExecuteFunctions, page: Page, postUrl: string): Promise<boolean> {
	try {
		logger.info(`Navigating to LinkedIn post: ${postUrl}`);
		
		// Ensure it's a valid LinkedIn post URL
		if (!isValidLinkedInPostUrl(postUrl)) {
			throw new Error('Invalid LinkedIn post URL. Expected format includes "linkedin.com/feed/update/" or "linkedin.com/posts/"');
		}
		
		// Navigate to the post with retry logic
		const navigationSuccess = await navigateWithRetry(page, postUrl);
		if (!navigationSuccess) {
			throw new Error('Failed to navigate to the LinkedIn post after multiple attempts');
		}
		
		// Wait for the post container to load
		await page.waitForSelector(SELECTORS.POST_CONTAINER, { timeout: WAIT_TIMES.ELEMENT });
		
		// Find and click the like button using the fallback mechanism
		const likeButtonSelectors = SELECTORS.LIKE_BUTTON.split(', ');
		const likeButton = await waitForSelectorWithFallback(page, likeButtonSelectors);
		
		if (!likeButton) {
			await takeScreenshot(page, 'post-like-button-missing');
			throw new Error('Like button not found. LinkedIn may have changed their UI.');
		}
		
		// Get the current state of the like button (liked/unliked)
		const isAlreadyLiked = await page.evaluate(button => {
			return button.getAttribute('aria-pressed') === 'true' || 
				   button.classList.contains('react-button--active') ||
				   button.classList.contains('--active');
		}, likeButton);
		
		if (isAlreadyLiked) {
			logger.info('Post is already liked.');
			return true;
		}
		
		// Click the like button
		logger.info('Clicking like button...');
		await likeButton.click();
		
		// Wait for the like action to be processed
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Verify the like action worked
		const isNowLiked = await page.evaluate(button => {
			return button.getAttribute('aria-pressed') === 'true' || 
				   button.classList.contains('react-button--active') ||
				   button.classList.contains('--active');
		}, likeButton);
		
		if (!isNowLiked) {
			await takeScreenshot(page, 'post-like-failed');
			throw new Error('Like action did not register. The post might not be likeable.');
		}
		
		logger.info('Post liked successfully!');
		return true;
	} catch (error) {
		logger.error('Error liking post:', error);
		throw new Error(`Failed to like LinkedIn post: ${error.message}`);
	}
}

/**
 * Comment on a LinkedIn post by URL
 */
export async function commentOnPost(this: IExecuteFunctions, page: Page, postUrl: string, comment: string): Promise<boolean> {
	try {
		logger.info(`Navigating to LinkedIn post to comment: ${postUrl}`);
		
		// Ensure it's a valid LinkedIn post URL
		if (!isValidLinkedInPostUrl(postUrl)) {
			throw new Error('Invalid LinkedIn post URL. Expected format includes "linkedin.com/feed/update/" or "linkedin.com/posts/"');
		}
		
		// Navigate to the post with retry logic
		const navigationSuccess = await navigateWithRetry(page, postUrl);
		if (!navigationSuccess) {
			throw new Error('Failed to navigate to the LinkedIn post after multiple attempts');
		}
		
		// Wait for the post container to load
		await page.waitForSelector(SELECTORS.POST_CONTAINER, { timeout: WAIT_TIMES.ELEMENT });
		
		// Find and click the comment button to open the comment box
		const commentButtonSelectors = SELECTORS.COMMENT_BUTTON.split(', ');
		const commentButton = await waitForSelectorWithFallback(page, commentButtonSelectors);
		
		if (!commentButton) {
			await takeScreenshot(page, 'post-comment-button-missing');
			throw new Error('Comment button not found. LinkedIn may have changed their UI.');
		}
		
		// Click to open comment section
		logger.info('Clicking comment button to open comment box...');
		await commentButton.click();
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Wait for the comment textbox to appear
		const commentTextboxSelectors = SELECTORS.COMMENT_TEXTBOX.split(', ');
		const commentTextbox = await waitForSelectorWithFallback(page, commentTextboxSelectors);
		
		if (!commentTextbox) {
			await takeScreenshot(page, 'post-comment-textbox-missing');
			throw new Error('Comment textbox not found. LinkedIn may have changed their UI.');
		}
		
		// Click on the textarea and type the comment
		logger.info('Entering comment text...');
		await commentTextbox.click();
		
		// Type the comment with a natural typing speed
		await page.waitForTimeout(500); // Short pause before typing
		await commentTextbox.type(comment, { delay: WAIT_TIMES.TYPING });
		
		// Wait a bit to simulate human behavior after typing
		await page.waitForTimeout(1000);
		
		// Find and click the submit comment button
		const submitButtonSelectors = SELECTORS.COMMENT_SUBMIT.split(', ');
		const submitButton = await waitForSelectorWithFallback(page, submitButtonSelectors);
		
		if (!submitButton) {
			await takeScreenshot(page, 'post-comment-submit-missing');
			throw new Error('Comment submit button not found. LinkedIn may have changed their UI.');
		}
		
		logger.info('Submitting comment...');
		await submitButton.click();
		
		// Wait for the comment to be processed
		await page.waitForTimeout(WAIT_TIMES.ACTION * 2);
		
		logger.info('Comment submitted successfully!');
		return true;
	} catch (error) {
		logger.error('Error commenting on post:', error);
		throw new Error(`Failed to comment on LinkedIn post: ${error.message}`);
	}
}

/**
 * Share a LinkedIn post (repost)
 */
export async function sharePost(
	this: IExecuteFunctions, 
	page: Page, 
	postUrl: string, 
	shareText: string = ''
): Promise<boolean> {
	try {
		logger.info(`Navigating to LinkedIn post to share: ${postUrl}`);
		
		// Ensure it's a valid LinkedIn post URL
		if (!isValidLinkedInPostUrl(postUrl)) {
			throw new Error('Invalid LinkedIn post URL. Expected format includes "linkedin.com/feed/update/" or "linkedin.com/posts/"');
		}
		
		// Navigate to the post with retry logic
		const navigationSuccess = await navigateWithRetry(page, postUrl);
		if (!navigationSuccess) {
			throw new Error('Failed to navigate to the LinkedIn post after multiple attempts');
		}
		
		// Wait for the post container to load
		await page.waitForSelector(SELECTORS.POST_CONTAINER, { timeout: WAIT_TIMES.ELEMENT });
		
		// Find the share button (using multiple potential selectors)
		const shareButtonSelectors = [
			'button.share-actions__primary-action',
			'button.artdeco-button[aria-label*="repost" i]',
			'button.artdeco-button[aria-label*="share" i]',
			'button[data-control-name="share"]',
			'.feed-shared-control-menu__item[aria-label*="share" i]',
			'.feed-shared-control-menu__item[aria-label*="repost" i]'
		];
		
		const shareButton = await waitForSelectorWithFallback(page, shareButtonSelectors);
		
		if (!shareButton) {
			await takeScreenshot(page, 'post-share-button-missing');
			throw new Error('Share button not found. LinkedIn may have changed their UI.');
		}
		
		// Click the share button to open share dialog
		logger.info('Clicking share button to open share dialog...');
		await shareButton.click();
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Wait for the share dialog to appear
		const shareDialogSelectors = [
			'.share-box__content',
			'.artdeco-modal__content',
			'div[role="dialog"]',
			'.share-creation-state'
		];
		
		const shareDialog = await waitForSelectorWithFallback(page, shareDialogSelectors);
		if (!shareDialog) {
			await takeScreenshot(page, 'post-share-dialog-missing');
			throw new Error('Share dialog not found. LinkedIn may have changed their UI.');
		}
		
		// If there's share text, enter it in the text area
		if (shareText && shareText.trim() !== '') {
			const shareTextAreaSelectors = [
				'div[role="textbox"]',
				'.share-creation-state__textarea',
				'.ql-editor',
				'.mentions-texteditor__content'
			];
			
			const shareTextArea = await waitForSelectorWithFallback(page, shareTextAreaSelectors);
				
			if (shareTextArea) {
				logger.info('Entering share text...');
				await shareTextArea.click();
				await shareTextArea.type(shareText, { delay: WAIT_TIMES.TYPING });
				await page.waitForTimeout(1000);
			}
		}
		
		// Click the Post/Share button to submit
		const postButtonSelectors = [
			'button.share-actions__primary-action',
			'button.artdeco-button--primary',
			'button[aria-label*="Post" i]',
			'button[aria-label*="Share" i]',
			'button.share-creation-state__submit'
		];
		
		const postButton = await waitForSelectorWithFallback(page, postButtonSelectors);
			
		if (!postButton) {
			await takeScreenshot(page, 'post-share-submit-missing');
			throw new Error('Post/Share submit button not found. LinkedIn may have changed their UI.');
		}
		
		logger.info('Submitting share...');
		await postButton.click();
		
		// Wait for the share to be processed
		await page.waitForTimeout(WAIT_TIMES.ACTION * 2);
		
		logger.info('Post shared successfully!');
		return true;
	} catch (error) {
		logger.error('Error sharing post:', error);
		throw new Error(`Failed to share LinkedIn post: ${error.message}`);
	}
}

/**
 * Get post information from a LinkedIn post URL
 */
export async function getPostInfo(
	this: IExecuteFunctions, 
	page: Page, 
	postUrl: string
): Promise<LinkedInPost> {
	try {
		logger.info(`Getting information for LinkedIn post: ${postUrl}`);
		
		// Ensure it's a valid LinkedIn post URL
		if (!isValidLinkedInPostUrl(postUrl)) {
			throw new Error('Invalid LinkedIn post URL. Expected format includes "linkedin.com/feed/update/" or "linkedin.com/posts/"');
		}
		
		// Navigate to the post with retry logic
		const navigationSuccess = await navigateWithRetry(page, postUrl);
		if (!navigationSuccess) {
			throw new Error('Failed to navigate to the LinkedIn post after multiple attempts');
		}
		
		// Wait for the post container to load
		await page.waitForSelector(SELECTORS.POST_CONTAINER, { timeout: WAIT_TIMES.ELEMENT });
		
		// Extract post data using page.evaluate
		const postData = await page.evaluate(() => {
			// Author name - multiple selectors for resilience
			const authorNameSelectors = [
				'.feed-shared-actor__name',
				'.nt-card-creator__name',
				'.feed-shared-actor__title',
				'a[data-control-name="actor"]'
			];
			
			let authorName = '';
			for (const selector of authorNameSelectors) {
				const element = document.querySelector(selector);
				if (element && element.textContent) {
					authorName = element.textContent.trim();
					break;
				}
			}
			
			// Author headline
			const authorHeadlineSelectors = [
				'.feed-shared-actor__description',
				'.feed-shared-actor__sub-description',
				'.nt-card-creator__headline'
			];
			
			let authorHeadline = '';
			for (const selector of authorHeadlineSelectors) {
				const element = document.querySelector(selector);
				if (element && element.textContent) {
					authorHeadline = element.textContent.trim();
					break;
				}
			}
			
			// Author profile URL
			const authorLinkSelectors = [
				'.feed-shared-actor__container a',
				'.nt-card-creator__details a',
				'a[data-control-name="actor"]'
			];
			
			let authorProfileUrl = '';
			for (const selector of authorLinkSelectors) {
				const element = document.querySelector(selector);
				if (element && element instanceof HTMLAnchorElement && element.href) {
					authorProfileUrl = element.href;
					break;
				}
			}
			
			// Post text
			const postTextSelectors = [
				'.feed-shared-update-v2__description-wrapper',
				'.feed-shared-text',
				'.feed-shared-text-view',
				'.feed-shared-update-v2__commentary'
			];
			
			let postText = '';
			for (const selector of postTextSelectors) {
				const element = document.querySelector(selector);
				if (element && element.textContent) {
					postText = element.textContent.trim();
					break;
				}
			}
			
			// Post date
			const postDateSelectors = [
				'.feed-shared-actor__sub-description',
				'.post-share-time',
				'time',
				'.feed-shared-actor__sub-description span'
			];
			
			let postDate = '';
			for (const selector of postDateSelectors) {
				const element = document.querySelector(selector);
				if (element && element.textContent) {
					postDate = element.textContent.trim();
					break;
				}
			}
			
			// Check if post is liked
			const likeButtonSelectors = [
				'button.react-button__trigger',
				'button.option-component--like-button',
				'button[aria-label*="Like" i]',
				'button.artdeco-button[aria-label*="like" i]'
			];
			
			let isLiked = false;
			for (const selector of likeButtonSelectors) {
				const element = document.querySelector(selector);
				if (element) {
					isLiked = element.getAttribute('aria-pressed') === 'true' || 
							  element.classList.contains('react-button--active') ||
							  element.classList.contains('--active');
					break;
				}
			}
			
			return {
				authorName,
				authorHeadline,
				authorProfileUrl,
				postText,
				postDate,
				isLiked,
				postUrl: window.location.href
			};
		});
		
		logger.info('Successfully extracted post information');
		return postData as LinkedInPost;
		
	} catch (error) {
		logger.error('Error getting post information:', error);
		await takeScreenshot(page, 'post-info-error');
		throw new Error(`Failed to get LinkedIn post information: ${error.message}`);
	}
}