// controllers/spotifyController.js
import express from "express";
import axios from "axios";
import qs from "querystring";
import logger from "../utils/logger.js";

const router = express.Router();

// In-memory cache for the app-level token
let spotifyToken = null;
let tokenExpiry = 0;

async function getSpotifyToken() {
	const now = Date.now();
	if (spotifyToken && now < tokenExpiry) {
		logger.debug("Using cached Spotify token");
		return spotifyToken;
	}

	logger.info("Requesting new Spotify access token");
	try {
		const creds = Buffer.from(
			`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
		).toString("base64");

		const { data } = await axios.post(
			"https://accounts.spotify.com/api/token",
			qs.stringify({ grant_type: "client_credentials" }),
			{
				headers: {
					Authorization: `Basic ${creds}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
			}
		);

		spotifyToken = data.access_token;
		// expire a minute before actual expiry
		tokenExpiry = now + data.expires_in * 1000 - 60 * 1000;
		logger.info("Successfully obtained new Spotify token", {
			expiresIn: data.expires_in,
		});
		return spotifyToken;
	} catch (error) {
		logger.error("Failed to obtain Spotify token", { error: error.message });
		throw error;
	}
}

// GET /spotify/search?q=<>&page=<>&limit=<>
router.get("/search", async (req, res) => {
	const { q = "", page = 1, limit = 20 } = req.query;
	logger.info("Spotify search request received", { query: q, page, limit });

	try {
		const size = Math.min(parseInt(limit, 10), 50);
		const offset = size * (Math.max(parseInt(page, 10), 1) - 1);

		const token = await getSpotifyToken();
		logger.debug("Making request to Spotify API", {
			endpoint: "/search",
			offset,
			size,
		});

		const response = await axios.get("https://api.spotify.com/v1/search", {
			headers: { Authorization: `Bearer ${token}` },
			params: { q, type: "track", limit: size, offset },
		});

		const { items, total, next } = response.data.tracks;
		logger.info("Spotify search successful", {
			query: q,
			resultsCount: items.length,
			totalResults: total,
		});

		res.json({
			page: parseInt(page, 10),
			limit: size,
			total,
			nextPage: next ? page + 1 : null,
			tracks: items.map(t => ({
				id: t.id,
				title: t.name,
				artists: t.artists.map(a => a.name),
				album: t.album.name,
				coverArt: t.album.images[0]?.url || null,
				durationMs: t.duration_ms,
			})),
		});
	} catch (err) {
		const status = err.response?.status || 500;
		logger.error("Spotify search failed", {
			query: q,
			status,
			error: err.message,
			stack: err.stack,
		});
		res.status(status).json({ error: err.message });
	}
});

export default router;
