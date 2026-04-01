// User Feedback System - Community Intelligence without ML
// Collects and processes user feedback to improve scoring

import { cache } from './cache.js';
import logger from './logger.js';

// Feedback storage (in production, use database)
const feedbackStore = new Map();

// Community scoring weights
const FEEDBACK_WEIGHTS = {
  false_positive: -0.2,  // Reduce risk score for false positives
  confirmed_threat: 0.3, // Increase risk score for confirmed threats
  user_blocked: 0.1,      // Slight increase if users block
  user_allowed: -0.1     // Slight decrease if users allow
};

export async function submitFeedback(url, feedbackType, userId, comment = '') {
  try {
    const feedback = {
      url: url.toLowerCase(),
      type: feedbackType,
      userId,
      comment,
      timestamp: new Date().toISOString(),
      verified: false
    };
    
    // Store feedback
    if (!feedbackStore.has(feedback.url)) {
      feedbackStore.set(feedback.url, []);
    }
    feedbackStore.get(feedback.url).push(feedback);
    
    // Update cache with new community score
    await updateCommunityScore(feedback.url);
    
    logger.info({ url, type: feedbackType, userId }, 'Feedback submitted');
    
    return { success: true, message: 'Feedback recorded successfully' };
    
  } catch (error) {
    logger.error({ error: error.message, url, feedbackType }, 'Feedback submission failed');
    return { success: false, error: error.message };
  }
}

export async function getCommunityScore(url) {
  const normalizedUrl = url.toLowerCase();
  const cacheKey = `community:${normalizedUrl}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Calculate community score from feedback
  const feedback = feedbackStore.get(normalizedUrl) || [];
  if (feedback.length === 0) {
    return { score: 50, confidence: 0, totalReports: 0 };
  }
  
  let communityScore = 50; // Neutral starting point
  let totalWeight = 0;
  let verifiedReports = 0;
  
  feedback.forEach(report => {
    const weight = FEEDBACK_WEIGHTS[report.type] || 0;
    const userWeight = report.verified ? 2 : 1; // Verified users have more weight
    
    communityScore += (weight * 10 * userWeight); // Scale to 0-100 range
    totalWeight += userWeight;
    
    if (report.verified) verifiedReports++;
  });
  
  // Normalize score
  communityScore = Math.max(0, Math.min(100, communityScore));
  
  // Calculate confidence based on number of reports
  const confidence = Math.min(1, feedback.length / 10); // Max confidence at 10 reports
  
  const result = {
    score: Math.round(communityScore),
    confidence: Math.round(confidence * 100),
    totalReports: feedback.length,
    verifiedReports,
    breakdown: {
      threats: feedback.filter(f => f.type === 'confirmed_threat').length,
      falsePositives: feedback.filter(f => f.type === 'false_positive').length,
      userBlocks: feedback.filter(f => f.type === 'user_blocked').length,
      userAllows: feedback.filter(f => f.type === 'user_allowed').length
    }
  };
  
  // Cache for 1 hour
  cache.set(cacheKey, result, 3600);
  
  return result;
}

async function updateCommunityScore(url) {
  await getCommunityScore(url); // This will update the cache
}

export async function getFeedbackSummary(url) {
  const feedback = feedbackStore.get(url.toLowerCase()) || [];
  
  const summary = {
    total: feedback.length,
    byType: {},
    recent: feedback.slice(-5).reverse(), // Last 5 reports
    verifiedUsers: feedback.filter(f => f.verified).length
  };
  
  // Count by type
  feedback.forEach(report => {
    summary.byType[report.type] = (summary.byType[report.type] || 0) + 1;
  });
  
  return summary;
}

export async function verifyUser(userId, trusted = true) {
  // In production, this would verify user through various means
  // For now, we'll simulate user verification
  
  const userStore = cache.get('verified_users') || new Map();
  userStore.set(userId, { verified: trusted, timestamp: new Date().toISOString() });
  cache.set('verified_users', userStore, 86400); // Cache for 24 hours
  
  logger.info({ userId, trusted }, 'User verification status updated');
}

export function isUserVerified(userId) {
  const userStore = cache.get('verified_users') || new Map();
  return userStore.get(userId)?.verified || false;
}

// Advanced feedback analysis
export async function analyzeFeedbackPatterns(url) {
  const feedback = feedbackStore.get(url.toLowerCase()) || [];
  
  if (feedback.length < 5) {
    return { reliable: false, reason: 'insufficient_data' };
  }
  
  // Analyze consensus
  const threatReports = feedback.filter(f => f.type === 'confirmed_threat').length;
  const falsePositiveReports = feedback.filter(f => f.type === 'false_positive').length;
  const totalReports = feedback.length;
  
  const threatRatio = threatReports / totalReports;
  const falsePositiveRatio = falsePositiveReports / totalReports;
  
  let consensus = 'neutral';
  let reliability = 'medium';
  
  if (threatRatio > 0.7) {
    consensus = 'threat';
    reliability = 'high';
  } else if (falsePositiveRatio > 0.7) {
    consensus = 'safe';
    reliability = 'high';
  } else if (threatRatio > 0.4) {
    consensus = 'suspicious';
    reliability = 'medium';
  } else if (falsePositiveRatio > 0.4) {
    consensus = 'likely_safe';
    reliability = 'medium';
  }
  
  // Check for manipulation (multiple reports from same user in short time)
  const userReports = {};
  feedback.forEach(report => {
    userReports[report.userId] = (userReports[report.userId] || 0) + 1;
  });
  
  const suspiciousUsers = Object.entries(userReports).filter(([userId, count]) => count > 3);
  if (suspiciousUsers.length > 0) {
    reliability = 'low';
  }
  
  return {
    consensus,
    reliability,
    threatRatio: Math.round(threatRatio * 100),
    falsePositiveRatio: Math.round(falsePositiveRatio * 100),
    totalReports,
    suspiciousUsers: suspiciousUsers.length,
    reliable: reliability !== 'low'
  };
}

// Feedback quality scoring
export function calculateFeedbackQuality(feedback) {
  let quality = 50; // Base quality
  
  // Length of comment (more detailed = higher quality)
  if (feedback.comment && feedback.comment.length > 20) {
    quality += 10;
  }
  
  // User verification status
  if (feedback.verified) {
    quality += 20;
  }
  
  // Time-based relevance (recent feedback more relevant)
  const daysSinceReport = (Date.now() - new Date(feedback.timestamp)) / (1000 * 60 * 60 * 24);
  if (daysSinceReport < 7) {
    quality += 10;
  } else if (daysSinceReport < 30) {
    quality += 5;
  }
  
  // Type specificity (some types are more valuable)
  if (feedback.type === 'confirmed_threat') {
    quality += 15;
  } else if (feedback.type === 'false_positive') {
    quality += 10;
  }
  
  return Math.min(100, quality);
}
