// middleware/userSync.js
import logger from "../utils/logger.js";

// User sync middleware to sync Clerk users with MongoDB
export const syncUser = async (req, res, next) => {
	try {
		const { clerkUserId } = req;
		const clerkUserData = req.user; // Decoded JWT payload

		if (!clerkUserId) {
			logger.warn("No Clerk user ID found in request");
			return res.status(401).json({ error: "No user ID found" });
		}

		// Get the User model from the request (will be attached by server.js)
		const User = req.app.locals.User;

		// Check if user exists in MongoDB
		let user = await User.findOne({ clerkUserId });

		if (!user) {
			// Create new user in MongoDB
			user = new User({
				clerkUserId,
				email: clerkUserData.email,
				firstName: clerkUserData.given_name,
				lastName: clerkUserData.family_name,
				username: clerkUserData.username,
				phoneNumber: clerkUserData.phone_number,
				profileImage: clerkUserData.picture,
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			await user.save();
			logger.info("New user created", { clerkUserId });
		} else {
			// Update existing user with latest Clerk data
			user.email = clerkUserData.email;
			user.firstName = clerkUserData.given_name;
			user.lastName = clerkUserData.family_name;
			user.username = clerkUserData.username;
			user.phoneNumber = clerkUserData.phone_number;
			user.profileImage = clerkUserData.picture;
			user.updatedAt = new Date();

			await user.save();
			logger.debug("User data updated", { clerkUserId });
		}

		req.userDoc = user; // MongoDB user document
		next();
	} catch (error) {
		logger.error("User sync error", {
			error: error.message,
			stack: error.stack,
		});
		res.status(500).json({ error: "User sync failed" });
	}
};

export default { syncUser };
