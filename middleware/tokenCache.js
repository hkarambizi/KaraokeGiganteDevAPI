// middleware/tokenCache.js
import jwt from "jsonwebtoken";
import jwksClient from "jwks-client";
import logger from "../utils/logger.js";

// In-memory cache for verified tokens
const tokenCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Initialize JWKS client for Clerk
const client = jwksClient({
	jwksUri: `https://${process.env.CLERK_DOMAIN}/.well-known/jwks.json`,
	cache: true,
	rateLimit: true,
	jwksRequestsPerMinute: 5,
});

function getKey(header, callback) {
	client.getSigningKey(header.kid, (err, key) => {
		if (err) {
			logger.error("Error getting signing key", { error: err.message });
			return callback(err);
		}
		const signingKey = key.publicKey || key.rsaPublicKey;
		callback(null, signingKey);
	});
}

// Verify token with caching
export const verifyTokenWithCache = (req, res, next) => {
	// If auth is disabled, skip verification
	if (process.env.AUTH !== "ACTIVE") {
		logger.info("Authentication bypassed - AUTH is not active");
		return next();
	}

	const token = req.headers.authorization?.replace("Bearer ", "");

	if (!token) {
		logger.warn("Authentication failed - Missing Bearer token");
		return res.status(401).json({ error: "No token provided" });
	}

	// Check cache first
	const cacheKey = token.substring(0, 20); // Use first 20 chars as cache key
	const cached = tokenCache.get(cacheKey);

	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		// Use cached token data
		req.user = cached.decoded;
		req.clerkUserId = cached.decoded.sub;
		logger.debug("Using cached token", { clerkUserId: req.clerkUserId });
		return next();
	}

	// Verify token with Clerk
	jwt.verify(
		token,
		getKey,
		{
			audience: process.env.CLERK_APPLICATION_ID,
			issuer: `https://${process.env.CLERK_DOMAIN}`,
			algorithms: ["RS256"],
		},
		(err, decoded) => {
			if (err) {
				logger.warn("Authentication failed - Invalid token", {
					error: err.message,
				});
				return res.status(401).json({ error: "Invalid token" });
			}

			// Cache the verified token
			tokenCache.set(cacheKey, {
				decoded,
				timestamp: Date.now(),
			});

			// Clean up old cache entries periodically
			if (tokenCache.size > 100) {
				cleanupCache();
			}

			req.user = decoded;
			req.clerkUserId = decoded.sub;
			logger.debug("Token verified and cached", {
				clerkUserId: req.clerkUserId,
			});
			next();
		}
	);
};

// Clean up old cache entries
function cleanupCache() {
	const now = Date.now();
	for (const [key, value] of tokenCache.entries()) {
		if (now - value.timestamp > CACHE_DURATION) {
			tokenCache.delete(key);
		}
	}
	logger.info("Token cache cleaned up", { size: tokenCache.size });
}

// Clear cache for a specific user (useful when user data changes)
export const clearUserCache = clerkUserId => {
	let cleared = 0;
	for (const [key, value] of tokenCache.entries()) {
		if (value.decoded.sub === clerkUserId) {
			tokenCache.delete(key);
			cleared++;
		}
	}
	logger.info("User cache cleared", { clerkUserId, cleared });
};

// Get cache stats
export const getCacheStats = () => ({
	size: tokenCache.size,
	entries: Array.from(tokenCache.entries()).map(([key, value]) => ({
		key,
		clerkUserId: value.decoded.sub,
		age: Date.now() - value.timestamp,
	})),
});

export default { verifyTokenWithCache, clearUserCache, getCacheStats };
