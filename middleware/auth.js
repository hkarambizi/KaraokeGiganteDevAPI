// middleware/auth.js
import jwt from "jsonwebtoken";
import jwksClient from "jwks-client";
import logger from "../utils/logger.js";

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

// Clerk JWT token verification middleware
export const verifyToken = (req, res, next) => {
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

			req.user = decoded;
			req.clerkUserId = decoded.sub; // This is the Clerk user ID
			logger.debug("User authenticated successfully", {
				clerkUserId: req.clerkUserId,
			});
			next();
		}
	);
};

export default { verifyToken };
