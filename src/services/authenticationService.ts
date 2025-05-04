/**
 * Authentication Service
 * Handles LinkedIn authentication, login, and security challenges
 */
import { IExecuteFunctions } from 'n8n-core';
import { Browser, Page } from 'puppeteer';
import { SELECTORS, WAIT_TIMES, URLS, ERROR_MESSAGES } from '../constants/selectors';

/**
 * Login to LinkedIn
 * Handles the authentication process including potential security challenges
 */
export async function login(
	this: IExecuteFunctions, 
	browser: Browser, 
	username: string, 
	password: string,
	securityPin?: string
): Promise<Page> {
	try {
		console.log('Starting LinkedIn login process...');
		const page = await browser.newPage();
		
		// Set viewport to desktop size
		await page.setViewport({ width: 1280, height: 800 });
		
		// Set user agent to look like a normal browser
		await page.setUserAgent(
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
		);
		
		// Navigate to LinkedIn login page
		console.log('Navigating to LinkedIn login page...');
		await page.goto(URLS.LOGIN, { waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION });
		
		// Fill in username field
		await page.waitForSelector(SELECTORS.LOGIN_USERNAME, { timeout: WAIT_TIMES.ELEMENT });
		await page.type(SELECTORS.LOGIN_USERNAME, username, { delay: WAIT_TIMES.TYPING });
		
		// Fill in password field
		await page.waitForSelector(SELECTORS.LOGIN_PASSWORD, { timeout: WAIT_TIMES.ELEMENT });
		await page.type(SELECTORS.LOGIN_PASSWORD, password, { delay: WAIT_TIMES.TYPING });
		
		// Submit login form
		console.log('Submitting login credentials...');
		await Promise.all([
			page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }),
			page.click(SELECTORS.LOGIN_SUBMIT)
		]).catch(e => {
			// Sometimes waitForNavigation fails but login is still successful
			console.warn('Navigation promise rejected, but this may be fine:', e.message);
		});
		
		// Wait a moment to see if security challenge appears
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Check for security challenge
		const securityChallenge = await page.$(SELECTORS.SECURITY_CHALLENGE)
			.catch(() => null);
		
		if (securityChallenge) {
			console.log('Security challenge detected!');
			
			// Take screenshot of security challenge for debugging
			await page.screenshot({ path: './security-challenge-before.png' });
			
			if (!securityPin) {
				throw new Error(ERROR_MESSAGES.SECURITY_CHALLENGE);
			}
			
			// Handle the security challenge with the provided pin
			console.log('Entering security verification code...');
			await securityChallenge.type(securityPin, { delay: WAIT_TIMES.TYPING });
			
			// Submit the security challenge
			const verifyButton = await page.$(SELECTORS.SECURITY_VERIFY_BUTTON);
			if (verifyButton) {
				await Promise.all([
					page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.SECURITY_CHALLENGE }),
					verifyButton.click()
				]).catch(e => {
					console.warn('Security challenge navigation promise rejected:', e.message);
				});
			}
			
			// Take after screenshot
			await page.screenshot({ path: './security-challenge-after.png' });
			
			// Verify we're logged in
			await verifyLoggedIn(page);
		} else {
			// Verify login was successful even without security challenge
			await verifyLoggedIn(page);
		}
		
		console.log('LinkedIn login successful!');
		return page;
	} catch (error) {
		console.error('LinkedIn login failed:', error);
		throw new Error(`LinkedIn login failed: ${error.message}`);
	}
}

/**
 * Verify that the user is logged into LinkedIn
 */
export async function verifyLoggedIn(page: Page): Promise<boolean> {
	try {
		// Take screenshot after login attempt
		await page.screenshot({ path: './linkedin-login-debug.png' });
		
		// Check current URL - if we're still on login page, login failed
		const currentUrl = page.url();
		if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
			throw new Error('Still on login page after authentication attempt');
		}
		
		// Check for profile icon or feed elements that would indicate successful login
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Look for feed or main content elements
		const loggedInIndicator = await page.$('.feed-identity-module, .global-nav, .authentication-outlet')
			.catch(() => null);
			
		if (!loggedInIndicator) {
			throw new Error('Could not detect logged-in state elements');
		}
		
		return true;
	} catch (error) {
		console.error('Login verification failed:', error);
		throw new Error(ERROR_MESSAGES.LOGIN_FAILED);
	}
}

/**
 * Check if a page is already authenticated to LinkedIn
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
	try {
		// Go to LinkedIn homepage
		await page.goto(URLS.FEED, { waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION });
		
		// Check if we got redirected to login page
		const currentUrl = page.url();
		if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
			return false;
		}
		
		// Look for elements that only appear when logged in
		const loggedInIndicator = await page.$('.feed-identity-module, .global-nav, .authentication-outlet')
			.catch(() => null);
			
		return !!loggedInIndicator;
	} catch (error) {
		console.error('Error checking login status:', error);
		return false;
	}
}

/**
 * Log out of LinkedIn
 */
export async function logout(page: Page): Promise<boolean> {
	try {
		// Navigate to LinkedIn homepage
		await page.goto(URLS.FEED, { waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION });
		
		// Click on the profile menu
		const profileMenu = await page.$('button.global-nav__primary-link, button.artdeco-dropdown__trigger')
			.catch(() => null);
			
		if (!profileMenu) {
			throw new Error('Could not find profile menu button');
		}
		
		await profileMenu.click();
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Click on Sign Out
		const signOutButton = await page.$('a[href*="/m/logout/"], button.global-nav__secondary-item')
			.catch(() => null);
			
		if (!signOutButton) {
			throw new Error('Could not find sign out button');
		}
		
		await Promise.all([
			page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }),
			signOutButton.click()
		]).catch(e => {
			console.warn('Logout navigation promise rejected:', e.message);
		});
		
		// Verify we're logged out
		const currentUrl = page.url();
		return currentUrl.includes('/login') || 
			   currentUrl.includes('/logout') || 
			   !currentUrl.includes('linkedin.com/feed');
	} catch (error) {
		console.error('Error during logout:', error);
		return false;
	}
}