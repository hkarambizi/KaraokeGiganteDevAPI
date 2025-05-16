// server.js
import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import logger from "./utils/logger.js";

import spotifyRouter from "./controllers/spotifyController.js";
import { exchangeCustomTokenForIdToken } from "./utils/tokenExchange.js";

dotenv.config(); // loads AUTH, MONGO_URI, FIREBASE_* from .env
logger.info("Environment configuration loaded");

// ─── FIREBASE ADMIN INIT ───────────────────────────────────────────────────────

logger.info("Initializing Firebase Admin SDK");
admin.initializeApp({
	credential: admin.credential.cert({
		projectId: process.env.FIREBASE_PROJECT_ID,
		clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
		privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
	}),
});
logger.info("Firebase Admin SDK initialized successfully");

// ─── AUTH MIDDLEWARE ────────────────────────────────────────────────────────────
async function authenticate(req, res, next) {
	// If auth is disabled, skip verification
	if (process.env.AUTH !== "ACTIVE") {
		logger.info("Authentication bypassed - AUTH is not active");
		return next();
	}

	const header = req.headers.authorization || "";
	if (!header.startsWith("Bearer ")) {
		logger.warn("Authentication failed - Missing Bearer token");
		return res.status(401).json({ error: "Missing Bearer token" });
	}

	const idToken = header.split(" ")[1];
	try {
		const decoded = await admin.auth().verifyIdToken(idToken);
		req.user = decoded;
		logger.debug("User authenticated successfully", { uid: decoded.uid });
		next();
	} catch (err) {
		logger.warn("Authentication failed - Invalid token", {
			error: err.message,
		});
		res.status(401).json({ error: "Invalid ID token" });
	}
}

// ─── MONGOOSE MODELS ────────────────────────────────────────────────────────────
const { Schema } = mongoose;

const userSchema = new Schema(
	{
		_id: { type: String, default: "1" },
		firstName: String,
		lastName: String,
		phoneNumber: String,
		displayName: String,
		avatar: Buffer,
		lastLoginCode: String, // 6-digit verification code
		codeExpiry: Date,      // When the verification code expires
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

// ─── AUTH-ENDPOINT (always available) ─────────────────────────────────────────
if (
	["development", "ci"].includes(process.env.NODE_ENV) &&
	!!process.env.FIREBASE_API_KEY
) {
	logger.warn("Development mode detected - exposing custom token endpoint");
	app.post("/auth/customToken", async (req, res) => {
		// Testing in development mode

		const { phoneNumber } = req.body;
		logger.info("Custom token requested with phoneNumber", { phoneNumber });
		const registeredUser = await User.findOne({ phoneNumber });
		if (!registeredUser) {
			logger.warn("No user found with provided phoneNumber", { phoneNumber });
			return res.status(400).json({ error: "User not found" });
		}
		try {
			const uid = registeredUser.displayName || registeredUser._id;
			const additionalClaims = { role: "admin" }; // Example additional claims
			const customToken = await admin
				.auth()
				.createCustomToken(uid, additionalClaims);
			const token = await exchangeCustomTokenForIdToken(
				customToken,
				process.env.FIREBASE_API_KEY
			);
			logger.info("Custom token created successfully", {
				user: registeredUser._id,
			});
			res.json({ token, user: registeredUser });
		} catch (err) {
			logger.error("Failed to create custom token", {
				uid,
				error: err.message,
				stack: err.stack,
			});
			res.status(500).json({ error: err.message });
		}
	});
}

// ─── PROTECT ROUTES ─────────────────────────────────────────────────────────────
logger.info("Setting up protected routes");
app.use(["/user", "/requests"], authenticate);

// ─── SPOTIFY ROUTES ────────────────────────────────────────────────────────────
logger.info("Setting up Spotify routes");
app.use("/spotify", spotifyRouter);

// ─── USER ROUTES ───────────────────────────────────────────────────────────────
app.get("/user", async (req, res) => {
	logger.info("First user data requested");

	try {
		let user = await User.findOne();
		if (!user) {
			logger.info("No user found, creating new user");
			user = await User.create({});
		}
		logger.debug("User data retrieved successfully", { userId: user._id });
		res.json(user);
	} catch (err) {
		logger.error("Error fetching user data", {
			error: err.message,
		});
		res.status(500).json({ error: err.message });
	}
});

app.put("/user", async (req, res) => {
	const id = req.query.id || "1";
	logger.info("Updating user data", { userId: id });

	try {
		const update = (({
			firstName,
			lastName,
			phoneNumber,
			displayName,
			avatar,
		}) => ({ firstName, lastName, phoneNumber, displayName, avatar }))(
			req.body
		);

		const user = await User.findByIdAndUpdate(id, update, {
			new: true,
			upsert: true,
		});

		logger.info("User data updated successfully", { userId: id });
		res.json(user);
	} catch (err) {
		logger.error("Error updating user data", {
			userId: id,
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
	const { firstName, displayName, phoneNumber, songId, title, artist } =
		req.body;
	if (!firstName || !displayName || !phoneNumber) {
		logger.warn("Invalid user data in song request", req.body);
		return res.status(400).json({
			error: "First name, display name, and phone number are required",
		});
	}
	if (!songId || !title) {
		logger.warn("Invalid song request data", req.body);
		return res.status(400).json({ error: "Song ID and title are required" });
	}
	try {
		// Check if the user already has an active request
		const existingUserRequest = await Request.findOne({
			displayName,
			fulfilled: false || undefined,
		});
		if (existingUserRequest) {
			logger.warn("User already has an active request", { displayName });
			return res.status(200).json({
				error: "You already have an active song request",
				request: existingUserRequest,
			});
		}
		// Check if the song already has been requested
		const existingRequest = await Request.findOne({
			songId,
		});
		if (existingRequest) {
			logger.warn("Song already requested", { songId });
			return res.status(200).json({
				error: "Song has already been requested by another user",
				request: existingRequest,
			});
		}
		logger.info("New song request received", { songId, title, displayName });
		const count = await Request.countDocuments();
		const request = await Request.create({
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
		});
		res.status(201).json(request);
	} catch (err) {
		logger.error("Error creating song request", {
			songId,
			title,
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

// ─── PHONE VERIFICATION ENDPOINTS ────────────────────────────────────────────────
app.post("/start-phone-verification", async (req, res) => {
  const { phoneNumber } = req.body;
  logger.info("Phone verification requested", { phoneNumber });
  
  // Validate phone number format (10 digits, no dashes)
  if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
    logger.warn("Invalid phone number format", { phoneNumber });
    return res.status(400).json({ error: "Please provide a valid 10-digit phone number with no dashes" });
  }
  
  try {
    // Check if user exists
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      logger.warn("No user found with provided phone number", { phoneNumber });
      return res.status(404).json({ error: "No user found with this phone number" });
    }
    
    // Generate random 6-digit code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set code expiration (10 minutes from now)
    const codeExpiry = new Date();
    codeExpiry.setMinutes(codeExpiry.getMinutes() + 10);
    
    // Save code to user
    user.lastLoginCode = verificationCode;
    user.codeExpiry = codeExpiry;
    await user.save();
    
    logger.info("Verification code generated", { phoneNumber, userId: user._id });
    
    // Return the code and user (in a real production app, the code would be sent via SMS)
    res.json({ 
      code: verificationCode, 
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName
      } 
    });
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
    return res.status(400).json({ error: "Phone number and verification code are required" });
  }
  
  try {
    // Find user by phone number
    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      logger.warn("No user found with provided phone number", { phoneNumber });
      return res.status(404).json({ error: "No user found with this phone number" });
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
    
    // Code is valid - following the same pattern as /auth/customToken endpoint
    try {
      const uid = user.displayName || user._id;
      const additionalClaims = { role: "user" };
      const customToken = await admin
        .auth()
        .createCustomToken(uid, additionalClaims);
      const token = await exchangeCustomTokenForIdToken(
        customToken,
        process.env.FIREBASE_API_KEY
      );
      
      // Clear the verification code after successful verification
      user.lastLoginCode = null;
      user.codeExpiry = null;
      await user.save();
      
      logger.info("Phone verification successful, token created", { userId: user._id });
      res.json({ token, user });
    } catch (err) {
      logger.error("Failed to create token after verification", {
        userId: user._id,
        error: err.message,
        stack: err.stack,
      });
      res.status(500).json({ error: "Failed to create authentication token" });
    }
  } catch (err) {
    logger.error("Error verifying phone code", {
      phoneNumber,
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Failed to verify phone code" });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	logger.info(`🚀 Server running on port ${PORT}`, {
		port: PORT,
		auth: process.env.AUTH,
	});
});
