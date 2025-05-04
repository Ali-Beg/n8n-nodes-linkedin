/**
 * LinkedIn Selectors and Constants
 * Centralized selectors and timing configurations for the LinkedIn plugin
 */

/**
 * HTML selectors for LinkedIn elements
 * Multiple selector options are provided where possible for resilience against UI changes
 */
export const SELECTORS = {
    // Login selectors
    LOGIN_USERNAME: '#username, input[name="session_key"]',
    LOGIN_PASSWORD: '#password, input[name="session_password"]',
    LOGIN_SUBMIT: 'button[type="submit"], button.sign-in-form__submit-btn',
    
    // Security challenge selectors
    SECURITY_CHALLENGE: '#input__email_verification_pin, input[name="pin"]',
    SECURITY_VERIFY_BUTTON: 'button[type="submit"], button.form__submit, button.primary-action-new',
    
    // Profile selectors
    PROFILE_INFO: '.pv-top-card, .artdeco-card.ember-view.pv-top-card',
    PROFILE_CONNECT_BUTTON: 'button.pv-s-profile-actions__connect, button[aria-label*="Connect" i], button.artdeco-button--primary:not([aria-label*="Message"])',
    ADD_NOTE_BUTTON: 'button.artdeco-modal__confirm-dialog-btn, button.mr1, button[aria-label*="Add a note" i]',
    CONNECTION_MESSAGE_FIELD: 'textarea#custom-message, textarea.send-invite__custom-message, textarea[name="message"]',
    SEND_CONNECTION_BUTTON: 'button.artdeco-button--primary, button.ml1, button[aria-label*="Send" i]',
    
    // Post interaction selectors
    POST_CONTAINER: '.feed-shared-update-v2, .artdeco-card, article.ember-view',
    LIKE_BUTTON: 'button.react-button__trigger, button.option-component--like-button, button[aria-label*="Like" i], button.artdeco-button[aria-label*="like" i]',
    COMMENT_BUTTON: 'button.comment-button, button[aria-label*="Comment" i], button.artdeco-button[aria-label*="comment" i]',
    COMMENT_TEXTBOX: '.comments-comment-box__text-input, div[role="textbox"], div.ql-editor, textarea.comments-comment-box__text-editor',
    COMMENT_SUBMIT: 'button.comments-comment-box__submit-button, button[type="submit"], button.artdeco-button--primary',
    
    // Feed selectors
    FEED_CONTAINER: '.scaffold-finite-scroll__content, .core-rail',
    
    // Navigation selectors
    NAV_HOME: 'a[href="/feed/"], a[data-control-name="nav_homepage"]',
    NAV_MESSAGING: 'a[href="/messaging/"], a[data-control-name="messaging"]',
    NAV_NOTIFICATIONS: 'a[href="/notifications/"], a[data-control-name="notifications"]',
    
    // Message selectors
    MESSAGE_COMPOSE: '.msg-form__contenteditable, div[role="textbox"]',
    MESSAGE_SEND: 'button.msg-form__send-button, button[type="submit"]',
    
    // Job search selectors
    JOB_SEARCH_INPUT: 'input[aria-label="Search job titles or companies"], input.jobs-search-box__text-input',
    JOB_SEARCH_LOCATION: 'input[aria-label="Location"], input.jobs-search-box__location-input',
    JOB_SEARCH_BUTTON: 'button.jobs-search-box__submit, button[data-control-name="job_search_button"]',
    
    // Company page selectors
    COMPANY_FOLLOW_BUTTON: 'button.follow, button.org-company-follow-button, button[data-control-name="follow"]',
};

/**
 * Wait time constants in milliseconds
 */
export const WAIT_TIMES = {
    // Short wait for UI elements to respond
    ACTION: 2000,
    
    // Longer wait for page navigation
    NAVIGATION: 10000,
    
    // Wait for specific elements to appear
    ELEMENT: 5000,
    
    // Typing delay to simulate human input (ms between keystrokes)
    TYPING: 50,
    
    // Wait after login
    LOGIN_COMPLETION: 8000,
    
    // Wait for security challenge
    SECURITY_CHALLENGE: 20000,
    
    // Detection timeout - how long to wait before assuming something failed
    DETECTION_TIMEOUT: 15000,
};

/**
 * LinkedIn URLs
 */
export const URLS = {
    LOGIN: 'https://www.linkedin.com/login',
    FEED: 'https://www.linkedin.com/feed/',
    MESSAGING: 'https://www.linkedin.com/messaging/',
    NOTIFICATIONS: 'https://www.linkedin.com/notifications/',
    JOBS: 'https://www.linkedin.com/jobs/',
    MY_NETWORK: 'https://www.linkedin.com/mynetwork/',
    MY_PROFILE: 'https://www.linkedin.com/in/me/',
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
    LOGIN_FAILED: 'LinkedIn login failed. Please check your credentials.',
    SECURITY_CHALLENGE: 'LinkedIn security challenge detected. Verification required.',
    PROFILE_NOT_FOUND: 'LinkedIn profile not found. Please check the URL.',
    NOT_LOGGED_IN: 'Not logged into LinkedIn. Please run the login operation first.',
    CONNECTION_ALREADY_SENT: 'Connection request already sent to this user.',
    ALREADY_CONNECTED: 'You are already connected with this user.',
};