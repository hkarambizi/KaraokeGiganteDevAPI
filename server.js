// server.js
import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./utils/logger.js";

import spotifyRouter from "./controllers/spotifyController.js";
import {
	verifyTokenWithCache,
	clearUserCache,
	getCacheStats,
} from "./middleware/tokenCache.js";
import { syncUser } from "./middleware/userSync.js";
import { smsService } from "./services/smsService.js";

dotenv.config(); // loads AUTH, MONGO_URI, CLERK_* from .env
logger.info("Environment configuration loaded");

// ─── CLERK CONFIGURATION ───────────────────────────────────────────────────────

logger.info("Clerk authentication configured", {
	domain: process.env.CLERK_DOMAIN,
	applicationId: process.env.CLERK_APPLICATION_ID,
});

// ─── AUTH MIDDLEWARE ────────────────────────────────────────────────────────────
// Note: authenticate function is now imported from middleware/auth.js

// ─── MONGOOSE MODELS ────────────────────────────────────────────────────────────
const { Schema } = mongoose;

const userSchema = new Schema(
	{
		clerkUserId: { type: String, unique: true, required: true }, // Clerk's user ID
		email: String,
		firstName: String,
		lastName: String,
		username: String,
		phoneNumber: String,
		displayName: String,
		profileImage: String,
		avatar: Buffer,
		lastLoginCode: String, // 6-digit verification code
		codeExpiry: Date, // When the verification code expires
		pushToken: String, // Expo push token for notifications
		// App-specific fields
		queuePosition: { type: Number, default: 0 },
		songsRequested: { type: Number, default: 0 },
		achievements: [String],
		preferences: { type: Object, default: {} },
	},
	{ timestamps: true }
);

const songSchema = new Schema(
	{
		songId: String,
		title: String,
		artist: String,
		coverArt: String,
		position: Number,
	},
	{ timestamps: true }
);

const requestSchema = new Schema(
	{
		clerkUserId: { type: String, required: true }, // Clerk user ID
		firstName: String,
		displayName: String,
		phoneNumber: String,
		songId: String,
		title: String,
		artist: String,
		position: Number,
		fulfilled: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Song = mongoose.model("Song", songSchema);
const Request = mongoose.model("Request", requestSchema);

// ─── EXPRESS SETUP ─────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "5mb" }));

// Make User model available to middleware
app.locals.User = User;

logger.info("Connecting to MongoDB...");
const mongoUri =
	process.env.NODE_ENV !== "development"
		? process.env.MONGO_URI
		: "mongodb://localhost:27017/karaoke-gigante";
mongoose
	.connect(mongoUri, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	})
	.then(() => {
		logger.info("MongoDB connection established successfully");
	})
	.catch(err => {
		logger.error("MongoDB connection error", { error: err.message });
	});

// ─── TEST AUTH ENDPOINT (development only) ─────────────────────────────────────
if (["development", "ci"].includes(process.env.NODE_ENV)) {
	logger.warn("Development mode detected - exposing test auth endpoint");
	app.get("/api/test/auth", verifyTokenWithCache, syncUser, (req, res) => {
		res.json({
			message: "Authentication successful",
			clerkUserId: req.clerkUserId,
			userDoc: {
				_id: req.userDoc._id,
				clerkUserId: req.userDoc.clerkUserId,
				email: req.userDoc.email,
			},
		});
	});
}

// ─── PROTECT ROUTES ─────────────────────────────────────────────────────────────
logger.info("Setting up protected routes");
app.use(["/user", "/requests"], verifyTokenWithCache, syncUser);

// ─── SPOTIFY ROUTES ────────────────────────────────────────────────────────────
logger.info("Setting up Spotify routes");
app.use("/spotify", spotifyRouter);

// ─── USER ROUTES ───────────────────────────────────────────────────────────────
app.get("/user", async (req, res) => {
	logger.info("User data requested", { clerkUserId: req.clerkUserId });

	try {
		// User is already synced by middleware, just return the user document
		logger.debug("User data retrieved successfully", {
			userId: req.userDoc._id,
			clerkUserId: req.userDoc.clerkUserId,
		});
		res.json(req.userDoc);
	} catch (err) {
		logger.error("Error fetching user data", {
			clerkUserId: req.clerkUserId,
			error: err.message,
		});
		res.status(500).json({ error: err.message });
	}
});

app.put("/user", async (req, res) => {
	logger.info("Updating user data", { clerkUserId: req.clerkUserId });

	try {
		const update = (({
			firstName,
			lastName,
			phoneNumber,
			displayName,
			avatar,
			pushToken,
			preferences,
		}) => ({
			firstName,
			lastName,
			phoneNumber,
			displayName,
			avatar,
			pushToken,
			preferences,
			updatedAt: new Date(),
		}))(req.body);

		const user = await User.findOneAndUpdate(
			{ clerkUserId: req.clerkUserId },
			update,
			{ new: true }
		);

		if (!user) {
			logger.warn("User not found for update", {
				clerkUserId: req.clerkUserId,
			});
			return res.status(404).json({ error: "User not found" });
		}

		logger.info("User data updated successfully", {
			clerkUserId: req.clerkUserId,
			userId: user._id,
		});
		res.json(user);
	} catch (err) {
		logger.error("Error updating user data", {
			clerkUserId: req.clerkUserId,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: err.message });
	}
});

// ─── CATALOG ROUTES ────────────────────────────────────────────────────────────
app.get("/catalog", async (req, res) => {
	logger.info("Catalog data requested");

	try {
		const songs = await Song.find().sort("position").limit(10);
		logger.debug("Catalog retrieved successfully", { count: songs.length });
		res.json(songs);
	} catch (err) {
		logger.error("Error fetching catalog data", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

app.post("/catalog", async (req, res) => {
	const { songId, title, artist, coverArt } = req.body;
	logger.info("Adding new song to catalog", { songId, title, artist });
	if (!songId || !title || !artist) {
		logger.warn("Invalid catalog addition", req.body);
		return res
			.status(400)
			.json({ error: "Song ID and title are required", ...req.body });
	}
	try {
		const existingSong = await Song.find({ songId });
		if (existingSong.length > 0) {
			logger.warn("Song already exists in catalog", { songId, title });
			return res.status(400).json({ error: "Song already exists in catalog" });
		} else {
			const count = await Song.countDocuments();
			const song = await Song.create({
				songId,
				title,
				artist,
				coverArt,
				position: count + 1,
			});
			logger.info("Song added to catalog successfully", {
				songId,
				position: count + 1,
			});
			const songs = await Song.find().sort("position");
			res.status(201).json(songs);
		}
	} catch (err) {
		logger.error("Error adding song to catalog", {
			songId,
			title,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: err.message });
	}
});

// ─── REQUEST ROUTES ────────────────────────────────────────────────────────────
app.get("/requests", async (req, res) => {
	logger.info("Song requests list requested");

	try {
		const requests = await Request.find().sort("position");
		logger.debug("Song requests retrieved successfully", {
			count: requests.length,
		});
		res.json(requests);
	} catch (err) {
		logger.error("Error fetching song requests", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

// ─── REQUEST ROUTES ────────────────────────────────────────────────────────────
app.get("/requests/active", async (req, res) => {
	logger.info("Song requests list requested");

	try {
		const requests = await Request.find({ fulfilled: false || undefined }).sort(
			"position"
		);
		logger.debug("Active Song Queue requests retrieved successfully", {
			count: requests.length,
		});
		res.json(requests);
	} catch (err) {
		logger.error("Error fetching active song queue", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});
app.post("/requests", async (req, res) => {
	const { songId, title, artist } = req.body;

	if (!songId || !title) {
		logger.warn("Invalid song request data", req.body);
		return res.status(400).json({ error: "Song ID and title are required" });
	}

	try {
		// Get user data from the authenticated user
		const user = req.userDoc;
		const { firstName, displayName, phoneNumber } = user;

		// Check if the user already has an active request
		const existingUserRequest = await Request.findOne({
			clerkUserId: req.clerkUserId,
			fulfilled: { $ne: true },
		});
		if (existingUserRequest) {
			logger.warn("User already has an active request", {
				clerkUserId: req.clerkUserId,
				displayName,
			});
			return res.status(200).json({
				error: "You already have an active song request",
				request: existingUserRequest,
			});
		}

		// Check if the song already has been requested
		const existingRequest = await Request.findOne({
			songId,
			fulfilled: { $ne: true },
		});
		if (existingRequest) {
			logger.warn("Song already requested", { songId });
			return res.status(200).json({
				error: "Song has already been requested by another user",
				request: existingRequest,
			});
		}

		logger.info("New song request received", {
			songId,
			title,
			clerkUserId: req.clerkUserId,
			displayName,
		});

		const count = await Request.countDocuments();
		const request = await Request.create({
			clerkUserId: req.clerkUserId,
			firstName,
			displayName,
			phoneNumber,
			songId,
			title,
			artist,
			position: count + 1,
		});

		logger.info("Song request created successfully", {
			songId,
			title,
			position: count + 1,
			clerkUserId: req.clerkUserId,
		});
		res.status(201).json(request);
	} catch (err) {
		logger.error("Error creating song request", {
			songId,
			title,
			clerkUserId: req.clerkUserId,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: err.message });
	}
});

app.put("/requests/:id", async (req, res) => {
	const { id } = req.params;
	logger.info("Updating song request", { requestId: id });

	try {
		const request = await Request.findByIdAndUpdate(id, req.body, {
			new: true,
		});

		if (!request) {
			logger.warn("Song request not found for update", { requestId: id });
			return res.status(404).json({ error: "Request not found" });
		}

		logger.info("Song request updated successfully", { requestId: id });
		res.json(request);
	} catch (err) {
		logger.error("Error updating song request", {
			requestId: id,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: err.message });
	}
});

app.delete("/requests/:id/fulfill", async (req, res) => {
	const { id } = req.params;
	logger.info("Fulfilling song request", { requestId: id });

	try {
		const request = await Request.findByIdAndUpdate(
			id,
			{ fulfilled: true },
			{
				new: true,
			}
		);

		if (!request) {
			logger.warn("Song request not found for update", { requestId: id });
			return res.status(404).json({ error: "Request not found" });
		}

		logger.info("Song request updated successfully", { requestId: id });
		res.json(request);
	} catch (err) {
		logger.error("Error updating song request", {
			requestId: id,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: err.message });
	}
});

// ─── USER SIGNUP ENDPOINT ─────────────────────────────────────────────────────────
app.post("/signup", async (req, res) => {
	const { phoneNumber, displayName, firstName, lastName } = req.body;
	logger.info("User signup requested", { phoneNumber, displayName });

	// Validate required fields
	if (!phoneNumber || !displayName) {
		logger.warn("Missing required fields for signup", req.body);
		return res.status(400).json({
			error: "Phone number and display name are required",
		});
	}

	// Validate phone number format (10 digits, no dashes or spaces)
	if (!/^\d{10}$/.test(phoneNumber)) {
		logger.warn("Invalid phone number format", { phoneNumber });
		return res.status(400).json({
			error: "Phone number must be 10 digits with no dashes or spaces",
		});
	}

	try {
		// Check if user already exists with this phone number
		const existingUser = await User.findOne({ phoneNumber });
		if (existingUser) {
			logger.warn("User already exists with this phone number", {
				phoneNumber,
			});
			return res.status(400).json({ error: "User already exists" });
		}

		// Create new user
		const newUser = await User.create({
			phoneNumber,
			displayName,
			firstName,
			lastName,
			// Any other fields from req.body can be added here
		});

		logger.info("New user created successfully", {
			userId: newUser._id,
			phoneNumber,
			displayName,
		});

		// Return the new user (excluding sensitive fields if any)
		res.status(201).json({
			user: {
				id: newUser._id,
				phoneNumber: newUser.phoneNumber,
				displayName: newUser.displayName,
				firstName: newUser.firstName,
				lastName: newUser.lastName,
			},
		});
	} catch (err) {
		logger.error("Error creating new user", {
			phoneNumber,
			displayName,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: "Failed to create new user" });
	}
});

// ─── PHONE VERIFICATION ENDPOINTS ────────────────────────────────────────────────
app.post("/start-phone-verification", async (req, res) => {
	const { phoneNumber } = req.body;
	logger.info("Phone verification requested", { phoneNumber });

	// Validate phone number format (10 digits, no dashes)
	if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
		logger.warn("Invalid phone number format", { phoneNumber });
		return res.status(400).json({
			error: "Please provide a valid 10-digit phone number with no dashes",
		});
	}

	try {
		// Check if user exists
		let user = await User.findOne({ phoneNumber });

		if (!user) {
			logger.warn("No user found with provided phone number", { phoneNumber });
			return res
				.status(404)
				.json({ error: "No user found with this phone number" });
		}

		// Generate random 6-digit code
		const verificationCode = Math.floor(
			100000 + Math.random() * 900000
		).toString();

		// Set code expiration (10 minutes from now)
		const codeExpiry = new Date();
		codeExpiry.setMinutes(codeExpiry.getMinutes() + 10);

		// Save code to user
		user.lastLoginCode = verificationCode;
		user.codeExpiry = codeExpiry;
		await user.save();

		logger.info("Verification code generated", {
			phoneNumber,
			userId: user._id,
		});

		// Send SMS with verification code
		try {
			const message = `Your Karaoke Gigante verification code is: ${verificationCode}. This code expires in 10 minutes.`;
			await smsService.sendSMS(phoneNumber, message);
			logger.info("Verification code sent via SMS", { phoneNumber });
		} catch (smsError) {
			logger.error("Failed to send SMS", {
				phoneNumber,
				error: smsError.message,
			});
			// Still return the code for development/testing
		}

		// Return the code and user (in development, also return the code)
		const response = {
			user: {
				_id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				phoneNumber: user.phoneNumber,
				displayName: user.displayName,
			},
		};

		// In development, also return the code for testing
		if (process.env.NODE_ENV === "development") {
			response.code = verificationCode;
		}

		res.json(response);
	} catch (err) {
		logger.error("Error generating verification code", {
			phoneNumber,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: "Failed to generate verification code" });
	}
});

app.post("/verify-phone-code", async (req, res) => {
	const { phoneNumber, code } = req.body;
	logger.info("Phone code verification requested", { phoneNumber });

	if (!phoneNumber || !code) {
		logger.warn("Missing required parameters", { phoneNumber, code });
		return res
			.status(400)
			.json({ error: "Phone number and verification code are required" });
	}

	try {
		// Find user by phone number
		const user = await User.findOne({ phoneNumber });

		if (!user) {
			logger.warn("No user found with provided phone number", { phoneNumber });
			return res
				.status(404)
				.json({ error: "No user found with this phone number" });
		}

		// Check if code matches and is not expired
		const now = new Date();
		if (user.lastLoginCode !== code) {
			logger.warn("Invalid verification code", { phoneNumber });
			return res.status(400).json({ error: "Invalid verification code" });
		}

		if (!user.codeExpiry || now > user.codeExpiry) {
			logger.warn("Verification code expired", { phoneNumber });
			return res.status(400).json({ error: "Verification code has expired" });
		}

		// Clear the verification code after successful verification
		user.lastLoginCode = null;
		user.codeExpiry = null;
		await user.save();

		logger.info("Phone verification successful", {
			userId: user._id,
			clerkUserId: user.clerkUserId,
		});

		// Return user data (authentication is now handled by Clerk on the frontend)
		res.json({
			message: "Phone verification successful",
			user: {
				_id: user._id,
				clerkUserId: user.clerkUserId,
				firstName: user.firstName,
				lastName: user.lastName,
				phoneNumber: user.phoneNumber,
				displayName: user.displayName,
			},
		});
	} catch (err) {
		logger.error("Error verifying phone code", {
			phoneNumber,
			error: err.message,
			stack: err.stack,
		});
		res.status(500).json({ error: "Failed to verify phone code" });
	}
});

// ─── PUSH NOTIFICATION ENDPOINTS ─────────────────────────────────────────────
app.post(
	"/user/push-token",
	verifyTokenWithCache,
	syncUser,
	async (req, res) => {
		try {
			const { pushToken } = req.body;

			await User.findOneAndUpdate(
				{ clerkUserId: req.clerkUserId },
				{
					pushToken,
					updatedAt: new Date(),
				}
			);

			logger.info("Push token stored successfully", {
				clerkUserId: req.clerkUserId,
			});
			res.json({ success: true });
		} catch (error) {
			logger.error("Failed to store push token", {
				clerkUserId: req.clerkUserId,
				error: error.message,
			});
			res.status(500).json({ error: "Failed to store push token" });
		}
	}
);

// ─── CACHE MANAGEMENT ENDPOINTS (development only) ──────────────────────────
if (["development", "ci"].includes(process.env.NODE_ENV)) {
	// Get cache statistics
	app.get("/api/cache/stats", (req, res) => {
		const stats = getCacheStats();
		res.json({
			message: "Token cache statistics",
			stats,
		});
	});

	// Clear cache for a specific user
	app.post("/api/cache/clear", (req, res) => {
		const { clerkUserId } = req.body;
		if (!clerkUserId) {
			return res.status(400).json({ error: "clerkUserId is required" });
		}
		clearUserCache(clerkUserId);
		res.json({ message: "Cache cleared for user", clerkUserId });
	});

	// Clear all cache
	app.post("/api/cache/clear-all", (req, res) => {
		// This would require implementing a clearAll function
		res.json({ message: "Clear all cache endpoint - implement if needed" });
	});
}

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	logger.info(`🚀 Server running on port ${PORT}`, {
		port: PORT,
		auth: process.env.AUTH,
	});
});
