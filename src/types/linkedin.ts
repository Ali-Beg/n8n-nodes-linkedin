/**
 * Type definitions for LinkedIn entities
 */

/**
 * LinkedIn Profile information
 */
export interface LinkedInProfile {
  name?: string;
  headline?: string;
  location?: string;
  connections?: string;
  about?: string;
  currentPosition?: string;
  company?: string;
  education?: string[];
  profileUrl?: string;
  imageUrl?: string;
  isConnected?: boolean;
  isPremium?: boolean;
  isCompanyProfile?: boolean;
}

/**
 * LinkedIn Post information
 */
export interface LinkedInPost {
  authorName?: string;
  authorHeadline?: string;
  authorProfileUrl?: string;
  postUrl: string;
  postText?: string;
  postDate?: string;
  likeCount?: string;
  commentCount?: string;
  shareCount?: string;
  isLiked?: boolean;
  isShared?: boolean;
}

/**
 * LinkedIn Connection Request options
 */
export interface ConnectionRequestOptions {
  profileUrl: string;
  message?: string;
  includePremiumText?: boolean;
}

/**
 * LinkedIn API Error
 */
export interface LinkedInError {
  message: string;
  details?: string;
  code?: string;
  screenshot?: string;
}