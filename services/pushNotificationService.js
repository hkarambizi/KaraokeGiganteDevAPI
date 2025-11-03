// services/pushNotificationService.js
import { Expo } from "expo-server-sdk";
import logger from "../utils/logger.js";

// Initialize Expo SDK
const expo = new Expo({
	accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export const sendPushNotification = async (clerkUserId, notification) => {
	try {
		// Get user from database (you'll need to import User model)
		const User = require("../server.js").User; // This is a bit hacky, better to pass it as parameter

		const user = await User.findOne({ clerkUserId });

		if (!user?.pushToken) {
			logger.warn("No push token found for user", { clerkUserId });
			return { success: false, error: "No push token" };
		}

		if (!Expo.isExpoPushToken(user.pushToken)) {
			logger.warn("Invalid push token", {
				clerkUserId,
				pushToken: user.pushToken,
			});
			return { success: false, error: "Invalid push token" };
		}

		const message = {
			to: user.pushToken,
			sound: "default",
			title: notification.title,
			body: notification.body,
			data: notification.data || {},
		};

		const chunks = expo.chunkPushNotifications([message]);

		for (const chunk of chunks) {
			try {
				const receipts = await expo.sendPushNotificationsAsync(chunk);
				logger.info("Push notification sent", {
					clerkUserId,
					receipts,
				});
				return { success: true, receipts };
			} catch (error) {
				logger.error("Failed to send push notification", {
					clerkUserId,
					error: error.message,
				});
				return { success: false, error: error.message };
			}
		}
	} catch (error) {
		logger.error("Push notification service error", {
			clerkUserId,
			error: error.message,
		});
		return { success: false, error: error.message };
	}
};

export default { sendPushNotification };
