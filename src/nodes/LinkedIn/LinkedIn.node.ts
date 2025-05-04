import { IExecuteFunctions } from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Register stealth plugin for Puppeteer
puppeteer.use(StealthPlugin());

// Define LinkedIn selectors that we'll use for interactions
const SELECTORS = {
	// Login selectors
	LOGIN_USERNAME: '#username',
	LOGIN_PASSWORD: '#password',
	LOGIN_SUBMIT: 'button[type="submit"]',
	LOGIN_VERIFICATION_CODE: '#input__phone_verification_pin',
	LOGIN_VERIFICATION_SUBMIT: 'button[type="submit"]',
	
	// Security challenge selectors - Updated for 2025 LinkedIn UI
	SECURITY_CHALLENGE: '.form__input--floating, input[name="email-address"], input[name="security-code"], input[id*="verification"]',
	SECURITY_CHALLENGE_SUBMIT: 'button[type="submit"], button.form__submit, button[data-id="submit"], button.signin__button, button.action-submit',
	
	// Feed and post interaction selectors
	POST_CONTAINER: '.feed-shared-update-v2',
	LIKE_BUTTON: '.react-button__trigger',
	COMMENT_BUTTON: '.comment-button',
	COMMENT_TEXTBOX: '.comments-comment-box__form-container .ql-editor',
	COMMENT_SUBMIT: '.comments-comment-box__submit-button',

	// Profile selectors - Updated with more standard CSS selectors
	PROFILE_INFO: '.pv-top-card',
	// Multiple possible connect button selectors based on different LinkedIn UI versions
	PROFILE_CONNECT_BUTTON: [
		'.pv-s-profile-actions--connect',                      // Classic UI
		'button.artdeco-button[aria-label*="Connect"]',        // New UI with aria-label
		'button[data-control-name="connect"]',                 // Data attribute version
		'button.pvs-profile-actions__action:nth-child(1)',     // First action button
		// Removing the :has() selector since it's not supported in standard CSS
		'button.artdeco-button--primary',                      // Primary action button
		'button.pvs-profile-actions__action',                  // Any profile action button
		'button.ember-view[type="button"]',                    // Generic ember button
		'button.artdeco-button[type="button"]:not([aria-label*="Message"])', // Button that's not a message button
	].join(', '),
	PROFILE_FOLLOW_BUTTON: [
		'.pv-s-profile-actions--follow',
		'button.artdeco-button[aria-label*="Follow"]',
		'button[data-control-name="follow"]',
		// Removing the :contains() selectors since they're not supported in standard CSS
		'button.artdeco-button[aria-label="Follow"]',
	].join(', '),
	
	// Add note dialog - Updating with standard CSS selectors
	ADD_NOTE_BUTTON: [
		// Removing the :contains() selectors
		'button[aria-label="Add a note"]',
		'.artdeco-modal__content button.artdeco-button',
		'.send-invite button.artdeco-button',
	].join(', '),
	
	CONNECTION_MESSAGE_FIELD: [
		'.send-invite__custom-message',
		'textarea#custom-message',
		'.artdeco-modal__content textarea',
		'textarea[name="message"]',
	].join(', '),
	
	SEND_CONNECTION_BUTTON: [
		'button[aria-label="Send now"]',
		// Removing the :contains() selector
		'.artdeco-modal__content button.artdeco-button--primary',
		'button.artdeco-button--primary',
		'.send-invite__actions button:last-child',
	].join(', '),
	
	// Notification indicators
	NOTIFICATION_COUNT: '.nav-item__badge-count',
};

// Wait times in milliseconds
const WAIT_TIMES = {
	NAVIGATION: 15000,
	ELEMENT: 10000,
	TYPING: 100,
	ACTION: 2000,
};

export class LinkedIn implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'LinkedIn Automation',
		name: 'linkedin',
		// Adding multiple icon properties to ensure compatibility
		icon: 'file:linkedin.svg',
		iconUrl: 'file:icons/linkedin.svg',
		// This absolute path can help in some n8n versions
		iconFile: __dirname + '/icons/linkedin.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Automate LinkedIn interactions using browser automation',
		defaults: {
			name: 'LinkedIn Automation',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'linkedInApi',
				required: false,
				displayOptions: {
					show: {
						authentication: ['apiKey'],
					},
				},
			},
			{
				name: 'linkedInBrowser',
				required: true,
				displayOptions: {
					show: {
						authentication: ['browser'],
					},
				},
			},
		],
		properties: [
			// Authentication Method
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Browser',
						value: 'browser',
					},
					{
						name: 'API Key',
						value: 'apiKey',
					},
				],
				default: 'browser',
				description: 'Method of authentication',
			},
			
			// Resources
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Post',
						value: 'post',
					},
					{
						name: 'Profile',
						value: 'profile',
					},
					{
						name: 'Feed',
						value: 'feed',
					},
				],
				default: 'post',
			},
			
			// Operations for POST
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['post'],
					},
				},
				options: [
					{
						name: 'Like',
						value: 'like',
						description: 'Like a LinkedIn post',
						action: 'Like a LinkedIn post',
					},
					{
						name: 'Comment',
						value: 'comment',
						description: 'Comment on a LinkedIn post',
						action: 'Comment on a LinkedIn post',
					},
					{
						name: 'Share',
						value: 'share',
						description: 'Share a LinkedIn post',
						action: 'Share a LinkedIn post',
					},
				],
				default: 'like',
			},
			
			// Operations for PROFILE
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['profile'],
					},
				},
				options: [
					{
						name: 'Connect',
						value: 'connect',
						description: 'Send connection request',
						action: 'Connect with a LinkedIn profile',
					},
					{
						name: 'Follow',
						value: 'follow',
						description: 'Follow a LinkedIn profile',
						action: 'Follow a LinkedIn profile',
					},
					{
						name: 'Get Info',
						value: 'getInfo',
						description: 'Get LinkedIn profile information',
						action: 'Get LinkedIn profile information',
					},
				],
				default: 'connect',
			},
			
			// Operations for FEED
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['feed'],
					},
				},
				options: [
					{
						name: 'Get Posts',
						value: 'getPosts',
						description: 'Get posts from LinkedIn feed',
						action: 'Get posts from LinkedIn feed',
					},
					{
						name: 'Monitor',
						value: 'monitor',
						description: 'Monitor LinkedIn feed for new posts',
						action: 'Monitor LinkedIn feed for new posts',
					},
				],
				default: 'getPosts',
			},

			// URL field for operations that need a LinkedIn URL
			{
				displayName: 'LinkedIn URL',
				name: 'url',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['post', 'profile'],
						operation: ['like', 'comment', 'share', 'connect', 'follow', 'getInfo'],
					},
				},
				description: 'URL of the LinkedIn post or profile',
			},
			
			// Comment text field for comment operation
			{
				displayName: 'Comment Text',
				name: 'commentText',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['comment'],
					},
				},
				description: 'Text content of the comment',
			},
			
			// Connection message field
			{
				displayName: 'Connection Message',
				name: 'connectionMessage',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['profile'],
						operation: ['connect'],
					},
				},
				description: 'Optional personalized message for connection request',
			},
			
			// Number of feed posts to retrieve
			{
				displayName: 'Number of Posts',
				name: 'postCount',
				type: 'number',
				default: 10,
				displayOptions: {
					show: {
						resource: ['feed'],
						operation: ['getPosts'],
					},
				},
				description: 'Number of feed posts to retrieve',
			},
			
			// Monitoring interval for feed
			{
				displayName: 'Monitoring Interval (minutes)',
				name: 'monitorInterval',
				type: 'number',
				default: 30,
				displayOptions: {
					show: {
						resource: ['feed'],
						operation: ['monitor'],
					},
				},
				description: 'Interval in minutes between LinkedIn feed checks',
			},
			
			// Cookie storage option for Browser authentication
			{
				displayName: 'Save Session Cookies',
				name: 'saveSessionCookies',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						authentication: ['browser'],
					},
				},
				description: 'Whether to save session cookies for future use',
			},
			
			// Session timeout for browser authentication
			{
				displayName: 'Session Timeout (minutes)',
				name: 'sessionTimeout',
				type: 'number',
				default: 30,
				displayOptions: {
					show: {
						authentication: ['browser'],
					},
				},
				description: 'Browser session timeout in minutes',
			},
		],
	};
	
	// Main execution function
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Get input data
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		
		// Common parameters
		const authentication = this.getNodeParameter('authentication', 0, 'browser') as string;
		
		let browser: Browser | undefined;
		let page: Page | undefined;
		
		try {
			// Initialize browser if using browser authentication
			if (authentication === 'browser') {
				const credentials = await this.getCredentials('linkedInBrowser');
				const headless = credentials.headless as boolean || true;
				
				browser = await puppeteer.launch({ 
					headless, 
					args: ['--no-sandbox', '--disable-setuid-sandbox'],
					defaultViewport: { width: 1280, height: 800 },
				});
				
				page = await browser.newPage();
				await page.setDefaultTimeout(WAIT_TIMES.NAVIGATION);
				await page.setDefaultNavigationTimeout(WAIT_TIMES.NAVIGATION);
				
				// Login to LinkedIn
				await loginToLinkedIn.call(this, page);
			}
			
			// Loop through each item and process
			for (let i = 0; i < items.length; i++) {
				try {
					const resource = this.getNodeParameter('resource', i) as string;
					const operation = this.getNodeParameter('operation', i) as string;
					
					if (authentication === 'browser' && page) {
						// Execute operation based on resource and operation
						let result: any;
						
						switch (resource) {
							case 'post':
								result = await handlePostOperations.call(this, page, operation, i);
								break;
								
							case 'profile':
								result = await handleProfileOperations.call(this, page, operation, i);
								break;
								
							case 'feed':
								result = await handleFeedOperations.call(this, page, operation, i);
								break;
								
							default:
								throw new NodeOperationError(this.getNode(), `Resource ${resource} is not supported`);
						}
						
						// Return data
						returnData.push({
							json: result,
							pairedItem: { item: i },
						});
					} else if (authentication === 'apiKey') {
						// Handle API-based operations (not implemented yet)
						throw new NodeOperationError(this.getNode(), 'API-based operations are not implemented yet');
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								error: error.message,
							},
							pairedItem: { item: i },
						});
						continue;
					}
					throw error;
				}
			}
			
			// Close the browser
			if (browser) {
				await browser.close();
			}
			
			return [returnData];
		} catch (error) {
			if (browser) {
				await browser.close();
			}
			throw error;
		}
	}
}

// LinkedIn login implementation with error handling
async function loginToLinkedIn(this: IExecuteFunctions, page: Page): Promise<void> {
	try {
		// Get credentials
		const credentials = await this.getCredentials('linkedInBrowser');
		if (!credentials) {
			throw new Error('No LinkedIn browser credentials provided');
		}
		
		const username = credentials.username as string;
		const password = credentials.password as string;
		const use2FA = credentials.use2FA as boolean;
		const twoFactorCode = credentials.twoFactorCode as string;
		
		console.log('Starting LinkedIn login process...');
		
		// Navigate to LinkedIn login page
		await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
		
		// Wait for login form to be visible and ensure we're on the right page
		const usernameSelector = await page.waitForSelector(SELECTORS.LOGIN_USERNAME, { timeout: WAIT_TIMES.NAVIGATION });
		if (!usernameSelector) {
			throw new Error('LinkedIn login form not found. LinkedIn may have changed their login page.');
		}
		
		// Enter username (with proper waiting and typing delay)
		console.log('Entering username...');
		await page.type(SELECTORS.LOGIN_USERNAME, username, { delay: WAIT_TIMES.TYPING });
		
		// Enter password (with proper waiting and typing delay)
		console.log('Entering password...');
		await page.type(SELECTORS.LOGIN_PASSWORD, password, { delay: WAIT_TIMES.TYPING });
		
		// Submit login form
		console.log('Submitting login form...');
		await Promise.all([
			page.click(SELECTORS.LOGIN_SUBMIT),
			page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }),
		]).catch(async (error) => {
			console.log('Navigation error after login submission. Proceeding anyway...', error.message);
			// Wait a bit in case the navigation event wasn't properly detected
			await page.waitForTimeout(WAIT_TIMES.NAVIGATION);
		});
		
		// Take a screenshot for debugging
		await page.screenshot({ path: 'linkedin-login-debug.png' });
		
		console.log('Checking current URL after login attempt:', page.url());
		
		// Handle 2FA if enabled
		if (use2FA) {
			await handle2FA.call(this, page, twoFactorCode);
		}
		
		// Handle any security challenges
		await handleSecurityChallenge.call(this, page);
		
		// Verify successful login by checking for feed or home page
		const currentUrl = page.url();
		console.log('Final URL after login process:', currentUrl);
		
		if (currentUrl.includes('linkedin.com/feed') || 
			currentUrl.includes('linkedin.com/home') ||
			currentUrl.includes('linkedin.com/checkpoint/lg/login-submit')) {
			console.log('Successfully logged in to LinkedIn!');
			return;
		} else if (currentUrl.includes('linkedin.com/checkpoint')) {
			console.log('Encountered a LinkedIn checkpoint page');
			// Try to handle the checkpoint
			await handleCheckpoint.call(this, page);
			return;
		} else {
			throw new Error(`Login might have failed. Current URL: ${currentUrl}`);
		}
	} catch (error) {
		// Take a final screenshot to help debug the login failure
		await page.screenshot({ path: 'linkedin-login-failure.png' });
		throw new Error(`LinkedIn login failed: ${error.message}`);
	}
}

// Handle LinkedIn 2FA verification
async function handle2FA(this: IExecuteFunctions, page: Page, twoFactorCode: string): Promise<void> {
	try {
		console.log('Handling 2FA verification...');
		
		if (!twoFactorCode) {
			throw new Error('Two-factor authentication code is required but not provided');
		}
		
		// Wait for verification code input with increased timeout
		const verificationInput = await page.waitForSelector(SELECTORS.LOGIN_VERIFICATION_CODE, 
			{ timeout: WAIT_TIMES.NAVIGATION, visible: true });
		
		if (!verificationInput) {
			console.log('2FA input field not found. LinkedIn might not have requested 2FA.');
			return;
		}
		
		console.log('Entering 2FA code...');
		await page.type(SELECTORS.LOGIN_VERIFICATION_CODE, twoFactorCode, { delay: WAIT_TIMES.TYPING });
		
		// Submit verification code
		console.log('Submitting 2FA code...');
		await Promise.all([
			page.click(SELECTORS.LOGIN_VERIFICATION_SUBMIT),
			page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }),
		]).catch(async (error) => {
			console.log('Navigation error after 2FA submission. Proceeding anyway...', error.message);
			// Wait a bit in case the navigation event wasn't properly detected
			await page.waitForTimeout(WAIT_TIMES.NAVIGATION);
		});
		
		console.log('2FA verification completed.');
	} catch (error) {
		console.log('Error during 2FA handling:', error.message);
		// If we couldn't find the 2FA input, LinkedIn might not have requested it,
		// so we'll continue with the process anyway
	}
}

// Handle LinkedIn security challenges
async function handleSecurityChallenge(this: IExecuteFunctions, page: Page): Promise<void> {
	try {
		console.log('Checking for security challenges...');
		
		// Take a screenshot to see what we're dealing with
		await page.screenshot({ path: 'security-challenge-before.png' });
		
		// Check if there's a security challenge by looking for various possible input fields
		const securityInput = await page.$(SELECTORS.SECURITY_CHALLENGE);
		
		if (securityInput) {
			console.log('Security challenge detected, entering email...');
			
			// Get the email from credentials
			const credentials = await this.getCredentials('linkedInBrowser');
			const email = credentials?.username as string;
			
			// Clear any existing text and type email in the security challenge field
			await securityInput.click({ clickCount: 3 }); // Select all existing text
			await securityInput.type(email, { delay: WAIT_TIMES.TYPING });
			
			// Find and click the submit button - try multiple selectors
			console.log('Looking for security challenge submit button...');
			
			// Trying multiple possible submit button selectors
			const submitButtonSelectors = SELECTORS.SECURITY_CHALLENGE_SUBMIT.split(', ');
			let submitButtonFound = false;
			
			for (const selector of submitButtonSelectors) {
				const submitButton = await page.$(selector);
				if (submitButton) {
					console.log(`Found submit button with selector: ${selector}`);
					submitButtonFound = true;
					
					// Click the button and wait for navigation
					await Promise.all([
						submitButton.click(),
						page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }),
					]).catch(async (error) => {
						console.log('Navigation error after security challenge submission:', error.message);
						// Wait a bit in case the navigation event wasn't properly detected
						await page.waitForTimeout(WAIT_TIMES.NAVIGATION);
					});
					
					break;
				}
			}
			
			if (!submitButtonFound) {
				console.log('No standard submit button found. Looking for any button...');
				
				// If we couldn't find a standard submit button, try to find any button
				const anyButtons = await page.$$('button');
				console.log(`Found ${anyButtons.length} buttons on the page`);
				
				let buttonClicked = false;
				for (const button of anyButtons) {
					// Try to get button text to identify which one might be the submit button
					const buttonText = await page.evaluate(el => el.textContent, button);
					console.log(`Button text: ${buttonText}`);
					
					if (buttonText && 
						(buttonText.toLowerCase().includes('submit') || 
						buttonText.toLowerCase().includes('continue') || 
						buttonText.toLowerCase().includes('next'))) {
						
						console.log(`Clicking button with text: ${buttonText}`);
						await Promise.all([
							button.click(),
							page.waitForNavigation({ waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION }).catch(() => {})
						]);
						
						buttonClicked = true;
						break;
					}
				}
				
				if (!buttonClicked) {
					throw new Error('Could not find any button to submit the security challenge');
				}
			}
			
			// Take a screenshot after handling the challenge
			await page.screenshot({ path: 'security-challenge-after.png' });
		} else {
			console.log('No security challenge detected.');
		}
	} catch (error) {
		console.error('Security challenge handling error:', error);
		throw new Error(`Security challenge handling failed: ${error.message}`);
	}
}

// Handle LinkedIn checkpoint pages
async function handleCheckpoint(this: IExecuteFunctions, page: Page): Promise<void> {
	try {
		console.log('Handling LinkedIn checkpoint page...');
		await page.screenshot({ path: 'linkedin-checkpoint.png' });
		
			// Get the current URL to determine what kind of checkpoint we're dealing with
		const currentUrl = page.url();
		console.log(`Checkpoint URL: ${currentUrl}`);
		
		// Add more selectors to try for buttons that might advance through security challenges
		const buttonSelectors = [
			'button',
			'button[type="submit"]', 
			'button.artdeco-button',
			'button.primary-action-button',
			'button.artdeco-button--primary',
			'button.form__submit',
			'a.primary-action-button',
			'input[type="submit"]'
		];
		
		// Try to extract HTML content to diagnose the page
		const pageContent = await page.content();
		console.log(`Checkpoint page title: ${await page.title()}`);
		
		if (pageContent.includes('security verification') || 
			pageContent.includes('confirm it\'s you') ||
			pageContent.includes('unusual login activity')) {
			console.log('Security verification checkpoint detected');
		}
		
		// First try clicking buttons with specific text
		const buttonTextOptions = [
			'Continue', 'Verify', 'Next', 'Submit', 'I Agree', 'Approve', 
			'Done', 'Confirm', 'Yes', 'Allow', 'Proceed', 'Sign in', 'Send code'
		];
		
		// Try to find any text input fields (email, phone, etc.)
		const textInputs = await page.$$('input[type="text"], input[type="email"], input[type="tel"]');
		if (textInputs.length > 0) {
			console.log(`Found ${textInputs.length} text input fields on checkpoint page`);
			
			// Get credentials to fill in the fields
			const credentials = await this.getCredentials('linkedInBrowser');
			const email = credentials?.username as string;
			
			// Try to fill in any text field with the email
			for (const input of textInputs) {
				try {
					await input.click({ clickCount: 3 }); // Select all existing text
					await input.type(email, { delay: 50 });
					console.log('Filled input field with email address');
					await page.waitForTimeout(1000);
				} catch (err) {
					console.log(`Failed to fill input: ${err.message}`);
				}
			}
		}
		
		// Try to find any specific verification button by text content
		let buttonClicked = false;
		for (const buttonText of buttonTextOptions) {
			const buttons = await page.$$('button, a.artdeco-button');
			for (const button of buttons) {
				const text = await page.evaluate(el => el.textContent?.trim(), button);
				if (text && text.toLowerCase().includes(buttonText.toLowerCase())) {
					console.log(`Found button with text containing "${buttonText}"`);
					try {
						await Promise.all([
							button.click(),
							page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {})
						]);
						buttonClicked = true;
						console.log('Clicked button and waited for navigation');
						await page.waitForTimeout(3000); // Wait to see if anything changes
						await page.screenshot({ path: 'linkedin-checkpoint-after-action.png' });
						break;
					} catch (err) {
						console.log(`Error clicking button: ${err.message}`);
					}
				}
			}
			if (buttonClicked) break;
		}
		
		// If no button with text matched, try generic button selectors
		if (!buttonClicked) {
			console.log('Trying generic button selectors...');
			for (const selector of buttonSelectors) {
				try {
					const buttons = await page.$$(selector);
					if (buttons.length > 0) {
						console.log(`Found ${buttons.length} buttons with selector: ${selector}`);
						
						// Try each button we found
						for (const button of buttons) {
							// Skip disabled buttons
							const isDisabled = await page.evaluate(el => (el as HTMLButtonElement).disabled || false, button);
							if (isDisabled) continue;
							
							console.log('Clicking button...');
							await button.click();
							await page.waitForTimeout(2000);
							await page.screenshot({ path: `linkedin-checkpoint-after-click-${Date.now()}.png` });
							
							// Check if we navigated away from checkpoint
							const newUrl = page.url();
							if (!newUrl.includes('checkpoint')) {
								console.log('Successfully passed checkpoint!');
								return;
							}
						}
					}
				} catch (err) {
					console.log(`Error with selector ${selector}: ${err.message}`);
				}
			}
		}
		
		// Check if we have multiple screens/steps in the verification process
		const verificationOptions = await page.$$('form, .verification-step, .security-verification');
		if (verificationOptions.length > 0) {
			console.log('Found possible verification forms or steps');
			await page.screenshot({ path: 'linkedin-checkpoint-verification-steps.png' });
		}
		
		// Check if there's a "Remember this device" checkbox
		try {
			const rememberDeviceCheckbox = await page.$('input[type="checkbox"]');
			if (rememberDeviceCheckbox) {
				await rememberDeviceCheckbox.click();
				console.log('Clicked "Remember this device" checkbox');
			}
		} catch (err) {
			console.log('No remember device checkbox found');
		}
		
		// Check final URL to see if we've successfully navigated past the checkpoint
		const finalUrl = page.url();
		if (finalUrl.includes('linkedin.com/feed') || finalUrl.includes('linkedin.com.home')) {
			console.log('Successfully passed checkpoint!');
			return;
		}

		// If we still have a checkpoint URL but the page looks different, try to handle it as a new checkpoint
		if (finalUrl.includes('checkpoint') && finalUrl !== currentUrl) {
			console.log('Advanced to a new checkpoint page, recursively handling...');
			return await handleCheckpoint.call(this, page);
		}
		
		// We've tried everything but still can't get past the checkpoint
		console.log('Attempted to handle checkpoint but may require manual intervention');
		await page.screenshot({ path: 'linkedin-checkpoint-final.png' });
		
		// Instead of failing hard, let's try to continue and see if we can complete the workflow
		// If we're in a headless browser, we might need manual intervention
		const headless = await this.getCredentials('linkedInBrowser')
			.then(cred => cred?.headless as boolean)
			.catch(() => true);
			
		if (headless) {
			console.log('Running in headless mode, user intervention may be required');
			throw new Error('Could not automatically handle LinkedIn checkpoint page. Try running with headless=false to manually approve the login.');
		} else {
			console.log('Running in visible browser mode, waiting for user to handle the checkpoint manually...');
			// Give some time for the user to interact with the browser
			await page.waitForTimeout(30000); // 30 seconds
			
			// Check if we're now logged in
			const newUrl = page.url();
			if (newUrl.includes('linkedin.com/feed') || 
				newUrl.includes('linkedin.com/home') || 
				!newUrl.includes('checkpoint')) {
				console.log('Successfully passed checkpoint (possibly with user intervention)!');
				return;
			} else {
				throw new Error('Even after waiting for user intervention, still stuck at LinkedIn checkpoint page.');
			}
		}
	} catch (error) {
		throw new Error(`Checkpoint handling failed: ${error.message}`);
	}
}

// Handle LinkedIn post operations (like, comment, share)
async function handlePostOperations(this: IExecuteFunctions, page: Page, operation: string, itemIndex: number): Promise<any> {
	try {
		const url = this.getNodeParameter('url', itemIndex) as string;
		
		// Navigate to the post URL
		await page.goto(url, { waitUntil: 'networkidle2' });
		
		// Execute the operation
		switch (operation) {
			case 'like': {
				// Find and click the like button
				await page.waitForSelector(SELECTORS.LIKE_BUTTON);
				await page.click(SELECTORS.LIKE_BUTTON);
				await page.waitForTimeout(WAIT_TIMES.ACTION);
				
				return { success: true, action: 'liked', url };
			}
			
			case 'comment': {
				const commentText = this.getNodeParameter('commentText', itemIndex) as string;
				
				// Open comment section
				await page.waitForSelector(SELECTORS.COMMENT_BUTTON);
				await page.click(SELECTORS.COMMENT_BUTTON);
				await page.waitForTimeout(WAIT_TIMES.ACTION);
				
				// Enter comment text
				await page.waitForSelector(SELECTORS.COMMENT_TEXTBOX);
				await page.click(SELECTORS.COMMENT_TEXTBOX);
				await page.type(SELECTORS.COMMENT_TEXTBOX, commentText, { delay: WAIT_TIMES.TYPING });
				
				// Submit comment
				await page.waitForSelector(SELECTORS.COMMENT_SUBMIT);
				await page.click(SELECTORS.COMMENT_SUBMIT);
				await page.waitForTimeout(WAIT_TIMES.ACTION * 2);
				
				return { success: true, action: 'commented', url, comment: commentText };
			}
			
			case 'share': {
				// Share functionality - to be implemented
				throw new Error('Share operation not implemented yet');
			}
			
			default:
				throw new Error(`Operation ${operation} is not supported for post resource`);
		}
	} catch (error) {
		throw new Error(`Post operation '${operation}' failed: ${error.message}`);
	}
}

// Handle LinkedIn profile operations (connect, follow, getInfo)
async function handleProfileOperations(this: IExecuteFunctions, page: Page, operation: string, itemIndex: number): Promise<any> {
	try {
		const url = this.getNodeParameter('url', itemIndex) as string;
		
		// Navigate to the profile URL with a different approach
		console.log(`Navigating to profile URL: ${url}`);
		
		// First check if we're already logged in by examining current session
		const currentUrl = page.url();
		console.log(`Current page before navigation: ${currentUrl}`);
		
		// Instead of relying on networkidle2, we'll use domcontentloaded which is faster
		try {
			console.log('Attempting navigation with domcontentloaded...');
			await page.goto(url, { 
				waitUntil: 'domcontentloaded' as 'domcontentloaded', 
				timeout: 20000  // 20 seconds
			});
		} catch (initialError) {
			// If domcontentloaded fails, try with a basic navigation and no waitUntil
			console.log('Initial navigation failed, trying basic navigation...');
			try {
				await page.goto(url, { timeout: 30000 });
			} catch (basicError) {
				console.log('Basic navigation also failed. Will try to work with current page state...');
				// We'll continue anyway and try to extract whatever data we can
			}
		}
		
		// Take a screenshot to debug
		await page.screenshot({ path: 'linkedin-profile-page-navigation.png' });
		
		// Wait for the page to stabilize
		await page.waitForTimeout(5000);
		
		// Check if we're on an authwall page
		const pageUrl = page.url();
		console.log(`Current URL after navigation attempts: ${pageUrl}`);
		
		if (pageUrl.includes('authwall') || pageUrl.includes('checkpoint')) {
			console.log('Detected LinkedIn authwall or checkpoint page. Attempting to handle...');
			
			// Try clicking any "Sign in" or "Continue" buttons that might be present
			const buttonSelectors = [
				'a.sign-in-link', 
				'a[href*="login"]', 
				'button[data-litms-control-urn="login-submit"]',
				'button.sign-in-form__submit-button',
				'button[type="submit"]',
				'button.btn__primary--large'
			];
			
			for (const selector of buttonSelectors) {
				const button = await page.$(selector);
				if (button) {
					console.log(`Found button with selector "${selector}", clicking it...`);
					await button.click();
					await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
					break;
				}
			}
			
			// After clicking any buttons, check if we still need to login
			if (page.url().includes('authwall') || page.url().includes('checkpoint') || page.url().includes('login')) {
				console.log('Still on authentication page, attempting to log in again...');
				await loginToLinkedIn.call(this, page);
				
				// After logging in, navigate back to the target profile URL
				console.log(`Navigating back to profile URL after login: ${url}`);
				try {
					await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
				} catch (error) {
					console.log(`Navigation after login failed: ${error.message}, continuing anyway`);
				}
				await page.screenshot({ path: 'linkedin-profile-page-after-relogin.png' });
			}
		}
		
		// Take another screenshot to see current state
		await page.screenshot({ path: 'linkedin-profile-current-state.png' });
		
		// Execute the operation
		switch (operation) {
			case 'getInfo': {
				// Get profile information
				console.log('Attempting to extract profile information...');
				
				// Wait a bit to ensure the page has loaded as much as possible
				await page.waitForTimeout(3000);
				
				// Instead of waiting for specific selectors that might not appear,
				// we'll try to extract data from whatever is currently available on the page
				console.log('Extracting profile data from current page state...');
				const profileData = await page.evaluate(() => {
					// This function runs in browser context
					// Create more flexible selectors that can work with different LinkedIn page layouts
					const nameSelectors = [
						'.pv-top-card--list .text-heading-xlarge',
						'h1.text-heading-xlarge',
						'.ph5 h1',
						'h1[data-generated-cert-name]',
						'.profile-info h1',
						'.artdeco-entity-lockup__title',
						'[data-member-name]',
						'.profile-topcard-person-entity__name',
						'h1[class*="text-heading"]',
						'h1', // Most basic - any h1 on the page
						'.identity-name', // Another possible name container
						'[class*="name"]' // Any element with "name" in its class
					];
					
					const titleSelectors = [
						'.pv-top-card--list .text-body-medium',
						'.ph5 .text-body-medium',
						'.pv-text-details__left-panel .text-body-medium',
						'.profile-info .text-body-medium',
						'.artdeco-entity-lockup__subtitle',
						'.profile-topcard-person-entity__content .t-black',
						'div[class*="text-body-medium"]',
						'[class*="headline"]', // Headline element
						'[class*="title"]', // Any title element
						'[class*="position"]' // Any position element
					];
					
					const locationSelectors = [
						'.pv-top-card--list .text-body-small[aria-label]',
						'.ph5 .text-body-small[aria-label]',
						'.pv-text-details__left-panel .text-body-small',
						'.profile-topcard-person-entity__content .t-black--light',
						'div[class*="t-black--light"]',
						'span[class*="location"]',
						'[class*="location"]', // Any element with "location" in its class
						'[class*="address"]', // Any element with "address" in its class
						'[class*="locality"]' // Any element with "locality" in its class
					];
					
					const aboutSelectors = [
						'.pv-about-section .pv-shared-text-with-see-more div',
						'section.summary div',
						'.pv-shared-text-with-see-more div',
						'section[data-section="summary"]',
						'div[id*="about"] .display-flex .pv-shared-text-with-see-more',
						'div[id*="about"] p',
						'[class*="about"]', // Any element with "about" in its class
						'[class*="summary"]', // Any element with "summary" in its class
						'[class*="description"]' // Any element with "description" in its class
					];
					
					// Helper function to try multiple selectors
					const getElementText = (selectors: string[]) => {
						for (const selector of selectors) {
							try {
								const elements = document.querySelectorAll(selector);
								if (elements && elements.length > 0) {
									for (let i = 0; i < elements.length; i++) {
										const text = elements[i].textContent?.trim();
										if (text && text.length > 0) {
											return text;
										}
									}
								}
							} catch (e) {
								// Ignore errors for individual selectors
								console.log(`Error with selector ${selector}: ${e}`);
							}
						}
						return null;
					};
					
					// Get general page information
					const htmlContent = document.documentElement.outerHTML || '';
					const bodyText = document.body?.textContent || '';
					const pageTitle = document.title;
					const isAuthWall = htmlContent.includes('authwall') || 
						bodyText.includes('Sign In') || 
						bodyText.includes('Log In');
					
					// Try to identify if this is actually a profile page
					const isProfilePage = 
						pageTitle.includes('Profile') || 
						pageTitle.includes('LinkedIn') ||
						htmlContent.includes('profile-view') ||
						htmlContent.includes('pv-top-card');
					
					// Get raw HTML snippets for debugging
					const bodyContent = document.body?.innerHTML.slice(0, 1000) || ''; // First 1000 chars
					
					// Get all useful text on the page
					const allTextNodes = Array.from(document.querySelectorAll('h1, h2, h3, p, span, div'))
						.map(el => el.textContent?.trim())
						.filter(text => text && text.length > 5)
						.slice(0, 20); // Get first 20 meaningful text elements
					
					return {
						name: getElementText(nameSelectors),
						title: getElementText(titleSelectors),
						location: getElementText(locationSelectors),
						about: getElementText(aboutSelectors),
						currentUrl: window.location.href,
						isAuthWall: isAuthWall,
						isProfilePage: isProfilePage,
						pageTitle: pageTitle,
						extractionNote: '', // Add this property to the return object
						debugInfo: {
							bodySnippet: bodyContent,
							textSamples: allTextNodes
						}
					};
				});
				
				console.log('Profile data extracted:', profileData);
				
				// If the profile data is empty but we think we're on a profile page,
				// try to provide useful diagnostic information
				if (!profileData.name && !profileData.title && profileData.isProfilePage) {
					console.log('Could not extract specific profile data, but appears to be a profile page');
					
					// Take additional screenshots
					await page.screenshot({ path: 'linkedin-profile-data-empty.png' });
					
					// Add more debugging information
					profileData.extractionNote = 'Limited profile data available - LinkedIn may be showing a restricted view';
				}
				
				// If we're still on an authwall, return an informative error
				if (profileData.isAuthWall) {
					throw new Error('LinkedIn authentication wall detected. Profile data could not be extracted. Please ensure your LinkedIn credentials are correct and try again.');
				}
				
				return { 
					success: true, 
					action: 'profile info retrieved', 
					data: profileData 
				};
			}
			
			// ... other operations (connect, follow) remain the same
			case 'connect': {
				const connectionMessage = this.getNodeParameter('connectionMessage', itemIndex, '') as string;
				
				console.log('Executing Connect operation...');
				// First take a screenshot of the profile page
				await page.screenshot({ path: 'linkedin-profile-before-connect.png' });
				
				// Use a more reliable approach to find and click the connect button
				console.log('Looking for connect button...');
				
				// Try all the connect button selectors from our updated list - no mandatory waitForSelector
				let connectButtonFound = false;
				const connectButtonSelectors = SELECTORS.PROFILE_CONNECT_BUTTON.split(', ');
				
				for (const selector of connectButtonSelectors) {
					try {
						// First check if the selector exists, using a short timeout
						const connectButton = await page.$(selector);
						
						if (connectButton) {
							console.log(`Found connect button with selector: ${selector}`);
							
							// Check if it's visible and enabled
							const isVisible = await page.evaluate((el) => {
								// Check if element is visible
								const style = window.getComputedStyle(el);
								const isDisplayed = style.display !== 'none';
								const isVisible = style.visibility !== 'hidden';
								const hasSize = (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0;
								
								// Check if element is enabled
								const isDisabled = (el as HTMLButtonElement).disabled;
								
								return isDisplayed && isVisible && hasSize && !isDisabled;
							}, connectButton);
							
							// Only click if the button is visible and enabled
							if (isVisible) {
								console.log('Connect button is visible and enabled, clicking it');
								await connectButton.click();
								await page.waitForTimeout(WAIT_TIMES.ACTION);
								connectButtonFound = true;
								
								// Take a screenshot after clicking connect button
								await page.screenshot({ path: 'linkedin-profile-after-connect-click.png' });
								break;
							} else {
								console.log('Connect button found but is not visible or enabled');
							}
						}
					} catch (err) {
						console.log(`Error with connect button selector ${selector}: ${err.message}`);
					}
				}
				
				// If we couldn't find a connect button with our selectors, try a more aggressive approach
				if (!connectButtonFound) {
					console.log('Could not find connect button with predefined selectors, trying alternative approaches...');
					
					// First try to find any primary action button
					const primaryButtons = await page.$$('button.artdeco-button--primary, button.primary-action-button');
					
					for (const button of primaryButtons) {
						try {
							// Check if the button text contains "Connect"
							const buttonText = await page.evaluate(el => el.textContent?.trim().toLowerCase() || '', button);
							console.log(`Found primary button with text: "${buttonText}"`);
							
							// If it contains "connect", click it
							if (buttonText.includes('connect')) {
								console.log('Found connect button by text content, clicking it');
								await button.click();
								await page.waitForTimeout(WAIT_TIMES.ACTION);
								connectButtonFound = true;
								await page.screenshot({ path: 'linkedin-profile-after-connect-click-alternative.png' });
								break;
							}
						} catch (err) {
							console.log(`Error checking primary button: ${err.message}`);
						}
					}
					
					// If we still couldn't find a connect button, try to find any button
					if (!connectButtonFound) {
						console.log('Attempting to identify all buttons on the page...');
						// Get all buttons and count them
						const allButtons = await page.$$('button');
						console.log(`Found ${allButtons.length} total buttons on the page`);
						
						// Take screenshots of the profile section to help debug
						await page.screenshot({ path: 'linkedin-profile-connect-debug.png' });
						
						// If there are buttons, check each one for "connect"-related text or attributes
						if (allButtons.length > 0) {
							for (const button of allButtons) {
								try {
									const buttonInfo = await page.evaluate(el => {
										return {
											text: el.textContent?.trim().toLowerCase() || '',
											ariaLabel: el.getAttribute('aria-label')?.toLowerCase() || '',
											classes: Array.from(el.classList).join(' '),
											disabled: (el as HTMLButtonElement).disabled
										};
									}, button);
									
									console.log(`Button found - Text: "${buttonInfo.text}", Aria-label: "${buttonInfo.ariaLabel}", Classes: "${buttonInfo.classes}"`);
									
									// Check if any button attribute contains "connect"
									if ((buttonInfo.text.includes('connect') || buttonInfo.ariaLabel.includes('connect')) && !buttonInfo.disabled) {
										console.log('Found potential connect button from generic button search, clicking it');
										await button.click();
										await page.waitForTimeout(WAIT_TIMES.ACTION);
										connectButtonFound = true;
										await page.screenshot({ path: 'linkedin-profile-after-generic-connect-click.png' });
										break;
									}
								} catch (err) {
									console.log(`Error checking button: ${err.message}`);
								}
							}
						}
					}
				}
				
				if (connectButtonFound) {
					console.log('Connect button clicked successfully');
					
					// Check if there's a modal dialog for connection options
					console.log('Checking for "Add a note" or connection options dialog...');
					await page.waitForTimeout(2000); // Wait for any modal to appear
					
					// Take a screenshot to see if a dialog appeared
					await page.screenshot({ path: 'linkedin-connect-dialog.png' });
					
					// Look for the "Add a note" button in any potential modal
					let addNoteButtonFound = false;
					
					// Try each selector for the add note button
					const addNoteSelectors = SELECTORS.ADD_NOTE_BUTTON.split(', ');
					for (const selector of addNoteSelectors) {
						try {
							const addNoteButton = await page.$(selector);
							if (addNoteButton) {
								console.log(`Found "Add a note" button with selector: ${selector}`);
								
								// Only proceed if we have a connection message
								if (connectionMessage && connectionMessage.trim().length > 0) {
									await addNoteButton.click();
									await page.waitForTimeout(WAIT_TIMES.ACTION);
									addNoteButtonFound = true;
									
									// Take screenshot after clicking "Add a note"
									await page.screenshot({ path: 'linkedin-add-note-click.png' });
									
									// Find the message textarea
									const messageFieldSelectors = SELECTORS.CONNECTION_MESSAGE_FIELD.split(', ');
									let messageFieldFound = false;
									
									for (const fieldSelector of messageFieldSelectors) {
										try {
											const messageField = await page.$(fieldSelector);
											if (messageField) {
												console.log(`Found message field with selector: ${fieldSelector}`);
												await messageField.click();
												await messageField.type(connectionMessage, { delay: WAIT_TIMES.TYPING });
												messageFieldFound = true;
												
												// Take screenshot after typing connection message
												await page.screenshot({ path: 'linkedin-connection-message.png' });
												break;
											}
										} catch (fieldErr) {
											console.log(`Error with message field selector ${fieldSelector}: ${fieldErr.message}`);
										}
									}
									
									if (!messageFieldFound) {
										console.log('Could not find message field to type connection message');
									}
									break;
								} else {
									console.log('No connection message provided, skipping "Add a note"');
								}
							}
						} catch (err) {
							console.log(`Error with "Add a note" button selector ${selector}: ${err.message}`);
						}
					}
					
					// Look for a send/done button to complete the connection request
					console.log('Looking for send/done button...');
					const sendButtonSelectors = SELECTORS.SEND_CONNECTION_BUTTON.split(', ');
					let sendButtonFound = false;
					
					for (const selector of sendButtonSelectors) {
						try {
							const sendButton = await page.$(selector);
							if (sendButton) {
								console.log(`Found send button with selector: ${selector}`);
								await sendButton.click();
								await page.waitForTimeout(WAIT_TIMES.ACTION);
								sendButtonFound = true;
								
								// Take screenshot after clicking send
								await page.screenshot({ path: 'linkedin-connection-sent.png' });
								break;
							}
						} catch (err) {
							console.log(`Error with send button selector ${selector}: ${err.message}`);
						}
					}
					
					// If we couldn't find a specific send button, look for any primary button in a modal
					if (!sendButtonFound) {
						console.log('Could not find specific send button, looking for any primary action button...');
						
						try {
							// Look for any primary button that might be the send button
							const anyPrimaryButton = await page.$('.artdeco-modal__actionbar button.artdeco-button--primary');
							
							if (anyPrimaryButton) {
								console.log('Found a primary button in modal actionbar, clicking it');
								await anyPrimaryButton.click();
								await page.waitForTimeout(WAIT_TIMES.ACTION);
								sendButtonFound = true;
							} else {
								// Try one last approach - find any button that looks like a submit/send button
								const possibleSendButtons = await page.$$('button.artdeco-button--primary');
								
								if (possibleSendButtons.length > 0) {
									// Prioritize the last button (usually the submit action)
									const lastButton = possibleSendButtons[possibleSendButtons.length - 1];
									console.log('Clicking the last primary button found');
									await lastButton.click();
									await page.waitForTimeout(WAIT_TIMES.ACTION);
									sendButtonFound = true;
								}
							}
							
							// Take final screenshot
							await page.screenshot({ path: 'linkedin-connection-final-state.png' });
						} catch (err) {
							console.log(`Error finding alternative send button: ${err.message}`);
						}
					}
					
					// Check for success indicators
					await page.waitForTimeout(2000);
					const finalUrl = page.url();
					const htmlContent = await page.content();
					
					// Look for visual confirmation like "Pending" text or success messages
					const hasPendingIndicator = htmlContent.toLowerCase().includes('pending') || 
												htmlContent.toLowerCase().includes('request sent');
					
					return { 
						success: true, 
						action: 'connection request sent',
						url,
						message: connectionMessage || 'No message included',
						uiState: {
							connectButtonFound,
							addNoteButtonFound,
							sendButtonFound,
							hasPendingIndicator
						}
					};
				} else {
					console.log('Could not find any connect button on the profile page');
					throw new Error('Could not find connect button on profile page. The profile may already be connected, or LinkedIn UI may have changed');
				}
			}
			
			case 'follow': {
				// Find and click follow button
				await page.waitForSelector(SELECTORS.PROFILE_FOLLOW_BUTTON);
				await page.click(SELECTORS.PROFILE_FOLLOW_BUTTON);
				await page.waitForTimeout(WAIT_TIMES.ACTION);
				
				return { success: true, action: 'followed', url };
			}
			
			default:
				throw new Error(`Operation ${operation} is not supported for profile resource`);
		}
	} catch (error) {
		console.error('Profile operation error:', error);
		// Take screenshot to help debug
		await page.screenshot({ path: `linkedin-profile-error-${operation}.png` });
		throw new Error(`Profile operation '${operation}' failed: ${error.message}`);
	}
}

// Handle LinkedIn feed operations (getPosts, monitor)
async function handleFeedOperations(this: IExecuteFunctions, page: Page, operation: string, itemIndex: number): Promise<any> {
	try {
		switch (operation) {
			case 'getPosts': {
				const postCount = this.getNodeParameter('postCount', itemIndex, 10) as number;
				
				// Navigate to LinkedIn feed
				await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2' });
				
				// Scroll to load more posts if needed
				await scrollToLoadPosts(page, postCount);
				
				// Extract posts using page.evaluate
				const feedPosts = await page.evaluate((selector, maxPosts) => {
					const posts = Array.from(document.querySelectorAll(selector)).slice(0, maxPosts);
					
					return posts.map((post: any) => {
						// Extract post author
						const authorElement = post.querySelector('.feed-shared-actor__name');
						const author = authorElement ? authorElement.textContent.trim() : null;
						
						// Extract post content
						const contentElement = post.querySelector('.feed-shared-update-v2__description');
						const content = contentElement ? contentElement.textContent.trim() : null;
						
						// Extract post URL
						const linkElement = post.querySelector('.feed-shared-actor__meta-link');
						const postUrl = linkElement ? linkElement.href : null;
						
						// Extract timestamp
						const timestampElement = post.querySelector('.feed-shared-actor__sub-description');
						const timestamp = timestampElement ? timestampElement.textContent.trim() : null;
						
						// Extract engagement metrics if available
						let engagementText = '';
						const engagementElement = post.querySelector('.social-details-social-counts__reactions-count');
						if (engagementElement) {
							engagementText = engagementElement.textContent.trim();
						}
						
						return {
							author,
							content,
							postUrl,
							timestamp,
							engagement: engagementText,
						};
					});
				}, SELECTORS.POST_CONTAINER, postCount);
				
				return { success: true, action: 'feed posts retrieved', count: feedPosts.length, posts: feedPosts };
			}
			
			case 'monitor': {
				// Implementation for monitoring LinkedIn feed for new posts
				// This would typically involve a webhook or scheduled execution in n8n
				throw new Error('Feed monitoring should be implemented using n8n workflows with scheduled triggers');
			}
			
			default:
				throw new Error(`Operation ${operation} is not supported for feed resource`);
		}
	} catch (error) {
		throw new Error(`Feed operation '${operation}' failed: ${error.message}`);
	}
}

// Helper: Scroll to load more posts in the feed
async function scrollToLoadPosts(page: Page, desiredPostCount: number): Promise<void> {
	let previousPostCount = 0;
	let currentPostCount = 0;
	const maxScrollAttempts = 10;
	let scrollAttempts = 0;
	
	do {
		previousPostCount = currentPostCount;
		
		// Scroll down
		await page.evaluate(() => {
			window.scrollBy(0, 1000);
		});
		
		// Wait for posts to load
		await page.waitForTimeout(1000);
		
		// Check current post count
		currentPostCount = await page.$$eval(SELECTORS.POST_CONTAINER, (posts) => posts.length);
		
		// Increment scroll attempts
		scrollAttempts++;
		
		// Break if we've reached the desired count or if we're no longer loading new posts
		if (currentPostCount >= desiredPostCount || scrollAttempts >= maxScrollAttempts || previousPostCount === currentPostCount) {
			break;
		}
	} while (true);
}