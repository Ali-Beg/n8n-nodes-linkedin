/**
 * Profile Service
 * Handles LinkedIn profile interactions, such as viewing profiles, getting profile info,
 * sending connection requests, etc.
 */
import { IExecuteFunctions } from 'n8n-core';
import { Page } from 'puppeteer';
import { SELECTORS, WAIT_TIMES } from '../constants/selectors';

/**
 * Types for profile data
 */
interface LinkedInProfileData {
	name?: string;
	headline?: string;
	location?: string;
	connections?: string;
	about?: string;
	experience: string[];
	education: string[];
	skills: string[];
	[key: string]: any;
}

/**
 * Visit a LinkedIn profile by URL
 */
export async function visitProfile(this: IExecuteFunctions, page: Page, profileUrl: string): Promise<void> {
	try {
		console.log(`Navigating to LinkedIn profile: ${profileUrl}`);
		
		// Normalize the URL to ensure it's a valid LinkedIn profile URL
		if (!profileUrl.includes('linkedin.com/in/')) {
			throw new Error('Invalid LinkedIn profile URL. Expected format: https://www.linkedin.com/in/username');
		}
		
		// Navigate to the profile
		await page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: WAIT_TIMES.NAVIGATION });
		
		// Take a screenshot for debugging
		await page.screenshot({ path: 'linkedin-profile-page.png' });
		
		console.log(`Successfully navigated to profile: ${profileUrl}`);
		
		// Check if we're logged in or redirected to login page
		const currentUrl = page.url();
		if (currentUrl.includes('linkedin.com/login')) {
			console.log('Not logged in. Current URL indicates we were redirected to login page.');
			throw new Error('Login required. Please run the login operation first.');
		}
	} catch (error) {
		console.error('Error visiting profile:', error);
		await page.screenshot({ path: 'linkedin-profile-page-navigation.png' });
		throw new Error(`Failed to visit LinkedIn profile: ${error.message}`);
	}
}

/**
 * Extract profile information from a LinkedIn profile
 */
export async function getProfileInfo(this: IExecuteFunctions, page: Page): Promise<LinkedInProfileData> {
	try {
		console.log('Extracting profile information...');
		
		// Check that we're on a LinkedIn profile page
		const currentUrl = page.url();
		if (!currentUrl.includes('linkedin.com/in/')) {
			throw new Error('Not on a LinkedIn profile page. Cannot extract profile information.');
		}
		
		// Take a screenshot for debugging
		await page.screenshot({ path: 'linkedin-profile-current-state.png' });
		
		// Wait for profile info to load
		await page.waitForSelector(SELECTORS.PROFILE_INFO, { timeout: WAIT_TIMES.ELEMENT })
			.catch(() => {
				throw new Error('Profile information container not found. LinkedIn may have changed their page structure.');
			});
		
		// Extract profile data using JavaScript in the browser context
		const profileData = await page.evaluate(() => {
			const data: LinkedInProfileData = {
				// Initialize required arrays to avoid TypeScript errors
				experience: [],
				education: [],
				skills: []
			};
			
			// Name - try different selectors as LinkedIn changes its HTML structure
			data.name = 
				document.querySelector('.text-heading-xlarge')?.textContent?.trim() ||
				document.querySelector('.pv-top-card-section__name')?.textContent?.trim() ||
				document.querySelector('.pv-top-card--list li:first-child')?.textContent?.trim() ||
				document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() ||
				document.querySelector('h1.pv-text-details__title')?.textContent?.trim() ||
				'';
			
			// Headline
			data.headline = 
				document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ||
				document.querySelector('.pv-top-card-section__headline')?.textContent?.trim() ||
				document.querySelector('.pv-top-card--list li:nth-child(2)')?.textContent?.trim() ||
				document.querySelector('div.text-body-medium')?.textContent?.trim() ||
				'';
			
			// Location
			data.location = 
				document.querySelector('.pv-top-card--list.pv-top-card--list-bullet li:first-child')?.textContent?.trim() ||
				document.querySelector('.pv-top-card-section__location')?.textContent?.trim() ||
				document.querySelector('.pv-text-details__left-panel mt2')?.textContent?.trim() ||
				document.querySelector('span.text-body-small.inline.t-black--light.break-words')?.textContent?.trim() ||
				'';
			
			// Connections - this can be in various formats
			const connectionsElement = 
				document.querySelector('.pv-top-card--list.pv-top-card--list-bullet li:nth-child(2)') ||
				document.querySelector('.pv-top-card-section__connections') ||
				document.querySelector('ul.pv-top-card--list-bullet li:last-child') ||
				document.querySelector('span.t-bold');
				
			if (connectionsElement) {
				const connectionsText = connectionsElement.textContent?.trim() || '';
				// Extract the number from text like "500+ connections"
				const connectionsMatch = connectionsText.match(/\\d+\\+?/);
				data.connections = connectionsMatch ? connectionsMatch[0] : connectionsText;
			}
			
			// About section
			const aboutSection = 
				document.querySelector('#about + div + div .pv-shared-text-with-see-more') ||
				document.querySelector('.pv-about-section .pv-about__summary-text') ||
				document.querySelector('.pv-about-section');
				
			if (aboutSection) {
				data.about = aboutSection.textContent?.trim() || '';
				// Clean up extra whitespace and "see more" buttons
				data.about = data.about
					.replace(/\\s+/g, ' ')
					.replace(/see more|show more/gi, '')
					.trim();
			}
			
			// Experience - collect job titles and companies
			data.experience = [];
			const experienceSections = document.querySelectorAll('#experience .pv-entity__summary-info, #experience .pvs-entity');
			experienceSections.forEach(section => {
				const role = section.querySelector('h3, .pv-entity__summary-info-item, .pvs-entity__summary-info-item')?.textContent?.trim();
				const company = section.querySelector('h4, .pv-entity__secondary-title, .pvs-entity__caption-item')?.textContent?.trim();
				if (role && company) {
					data.experience.push(`${role} at ${company}`);
				} else if (role) {
					data.experience.push(role);
				}
			});
			
			// Education - collect schools and degrees
			data.education = [];
			const educationSections = document.querySelectorAll('#education .pv-entity__summary-info, #education .pvs-entity');
			educationSections.forEach(section => {
				const school = section.querySelector('h3, .pv-entity__school-name, .pvs-entity__summary-info-item')?.textContent?.trim();
				const degree = section.querySelector('h4, .pv-entity__degree-name, .pvs-entity__caption-item')?.textContent?.trim();
				if (school && degree) {
					data.education.push(`${degree} from ${school}`);
				} else if (school) {
					data.education.push(school);
				}
			});
			
			// Skills
			data.skills = [];
			const skillSections = document.querySelectorAll('#skills .pv-skill-category-entity__name, #skills .pvs-entity__pill-text');
			skillSections.forEach(section => {
				const skill = section.textContent?.trim();
				if (skill) {
					data.skills.push(skill);
				}
			});
			
			return data;
		});
		
		// Check if we got meaningful data
		if (!profileData.name && !profileData.headline) {
			console.log('Failed to extract profile data. Taking a screenshot for debugging...');
			await page.screenshot({ path: 'linkedin-profile-data-empty.png' });
			throw new Error('Failed to extract profile data. LinkedIn may have changed their page structure.');
		}
		
		console.log('Successfully extracted profile information:', profileData);
		return profileData;
	} catch (error) {
		console.error('Error extracting profile information:', error);
		await page.screenshot({ path: 'linkedin-profile-error-getInfo.png' });
		throw new Error(`Failed to extract LinkedIn profile information: ${error.message}`);
	}
}

/**
 * Send a connection request to the current profile
 */
export async function sendConnectionRequest(
	this: IExecuteFunctions, 
	page: Page, 
	message: string = ''
): Promise<boolean> {
	try {
		console.log('Attempting to send connection request...');
		
		// Make sure we're on a LinkedIn profile page
		const currentUrl = page.url();
		if (!currentUrl.includes('linkedin.com/in/')) {
			throw new Error('Not on a LinkedIn profile page. Cannot send connection request.');
		}
		
		// Look for the Connect button using various selectors
		console.log('Looking for Connect button...');
		const connectButtonSelector = SELECTORS.PROFILE_CONNECT_BUTTON;
		
		// Wait until the button is available
		const connectButton = await page.waitForSelector(connectButtonSelector, { timeout: WAIT_TIMES.ELEMENT })
			.catch(() => null);
		
		if (!connectButton) {
			console.log('Connect button not found. Taking a screenshot for debugging...');
			await page.screenshot({ path: 'linkedin-profile-error-connect.png' });
			throw new Error('Connect button not found. You might already be connected or LinkedIn changed their UI.');
		}
		
		console.log('Found Connect button, clicking...');
		await connectButton.click();
		
		// Wait a moment for any dialog to appear
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		// Check if there's an "Add a note" option before sending
		if (message && message.trim() !== '') {
			console.log('Looking for "Add a note" button...');
			
			// Try to locate the "Add a note" button
			const addNoteButton = await page.$(SELECTORS.ADD_NOTE_BUTTON)
				.catch(() => null);
			
			if (addNoteButton) {
				console.log('Found "Add a note" button, clicking...');
				await addNoteButton.click();
				await page.waitForTimeout(WAIT_TIMES.ACTION);
				
				// Find and fill the connection message field
				const messageField = await page.waitForSelector(SELECTORS.CONNECTION_MESSAGE_FIELD, { timeout: WAIT_TIMES.ELEMENT })
					.catch(() => null);
				
				if (messageField) {
					console.log('Found message field, entering connection message...');
					await messageField.click({ clickCount: 3 }); // Select all text just in case
					await messageField.type(message, { delay: WAIT_TIMES.TYPING });
					await page.waitForTimeout(WAIT_TIMES.ACTION);
				} else {
					console.log('Message field not found. Continuing without adding a note.');
				}
			} else {
				console.log('Add note option not available. Continuing with default connection request.');
			}
		}
		
		// Find and click the final send/connect button
		console.log('Looking for Send button...');
		const sendButtonSelector = SELECTORS.SEND_CONNECTION_BUTTON;
		
		// Wait for the Send button to be available
		const sendButton = await page.waitForSelector(sendButtonSelector, { timeout: WAIT_TIMES.ELEMENT })
			.catch(() => null);
		
		if (!sendButton) {
			console.log('Send button not found. Taking a screenshot for debugging...');
			await page.screenshot({ path: 'linkedin-send-button-not-found.png' });
			throw new Error('Send button not found. LinkedIn may have changed their UI.');
		}
		
		// Click the send button
		console.log('Found Send button, clicking to send connection request...');
		await sendButton.click();
		
		// Wait for any confirmation or dialog to close
		await page.waitForTimeout(WAIT_TIMES.ACTION);
		
		console.log('Connection request sent successfully!');
		return true;
	} catch (error) {
		console.error('Error sending connection request:', error);
		throw new Error(`Failed to send connection request: ${error.message}`);
	}
}

/**
 * Send a message to an existing connection
 */
export async function sendMessage(
	this: IExecuteFunctions, 
	page: Page, 
	message: string
): Promise<boolean> {
	try {
		console.log('Attempting to send message...');
		
		// Ensure we're on a LinkedIn profile page
		const currentUrl = page.url();
		if (!currentUrl.includes('linkedin.com/in/')) {
			throw new Error('Not on a LinkedIn profile page. Cannot send message.');
		}
		
		// Look for the Message button - typically the primary button if connected
		const messageButton = await page.$('button.pv-s-profile-actions__message, button[aria-label*="Message"], button.artdeco-button--primary:not([aria-label*="Connect"])')
			.catch(() => null);
		
		if (!messageButton) {
			throw new Error('Message button not found. You might not be connected to this person.');
		}
		
		console.log('Found Message button, clicking...');
		await messageButton.click();
		
		// Wait for the message dialog to appear
		await page.waitForSelector('.msg-form__contenteditable, .msg-form__message-texteditor, div[role="textbox"]', { timeout: WAIT_TIMES.ELEMENT })
			.then(async (messageField) => {
				if (!messageField) {
					throw new Error('Message input field not found.');
				}
				
				console.log('Found message field, entering message...');
				await messageField.click();
				await messageField.type(message, { delay: WAIT_TIMES.TYPING });
				
				// Find and click the send button
				const sendButton = await page.$('button.msg-form__send-button, button[type="submit"]');
				if (!sendButton) {
					throw new Error('Message send button not found.');
				}
				
				console.log('Clicking send button...');
				await sendButton.click();
				
				// Wait for the message to be sent
				await page.waitForTimeout(WAIT_TIMES.ACTION);
				
				return true;
			})
			.catch((error) => {
				console.error('Error sending message:', error);
				throw new Error(`Failed to send message: ${error.message}`);
			});
		
		console.log('Message sent successfully!');
		return true;
	} catch (error) {
		console.error('Error sending message:', error);
		throw new Error(`Failed to send message: ${error.message}`);
	}
}