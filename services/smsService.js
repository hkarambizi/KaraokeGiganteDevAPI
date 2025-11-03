// services/smsService.js
import axios from "axios";
import logger from "../utils/logger.js";

// Base SMS service interface
class BaseSMSService {
	async sendSMS(phoneNumber, message) {
		throw new Error("sendSMS method must be implemented by subclass");
	}
}

// SimpleTexting SMS provider
class SimpleTextingService extends BaseSMSService {
	constructor() {
		super();
		this.apiKey = process.env.SIMPLETEXTING_API_KEY;
		this.baseUrl = "https://api2.simpletexting.com/v1";
	}

	async sendSMS(phoneNumber, message) {
		try {
			logger.info("Sending SMS via SimpleTexting", { phoneNumber });

			const response = await axios.post(
				`${this.baseUrl}/send`,
				{
					contact: phoneNumber,
					message: message,
				},
				{
					headers: {
						Authorization: `Bearer ${this.apiKey}`,
						"Content-Type": "application/json",
					},
				}
			);

			logger.info("SMS sent successfully via SimpleTexting", {
				phoneNumber,
				messageId: response.data.id,
			});

			return {
				success: true,
				messageId: response.data.id,
				provider: "SimpleTexting",
			};
		} catch (error) {
			logger.error("Failed to send SMS via SimpleTexting", {
				phoneNumber,
				error: error.message,
				status: error.response?.status,
			});
			throw new Error(`SMS sending failed: ${error.message}`);
		}
	}
}

// Twilio SMS provider (alternative)
class TwilioService extends BaseSMSService {
	constructor() {
		super();
		this.accountSid = process.env.TWILIO_ACCOUNT_SID;
		this.authToken = process.env.TWILIO_AUTH_TOKEN;
		this.fromNumber = process.env.TWILIO_FROM_NUMBER;
		this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
	}

	async sendSMS(phoneNumber, message) {
		try {
			logger.info("Sending SMS via Twilio", { phoneNumber });

			const response = await axios.post(
				`${this.baseUrl}/Messages.json`,
				new URLSearchParams({
					From: this.fromNumber,
					To: phoneNumber,
					Body: message,
				}),
				{
					headers: {
						Authorization: `Basic ${Buffer.from(
							`${this.accountSid}:${this.authToken}`
						).toString("base64")}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
				}
			);

			logger.info("SMS sent successfully via Twilio", {
				phoneNumber,
				messageId: response.data.sid,
			});

			return {
				success: true,
				messageId: response.data.sid,
				provider: "Twilio",
			};
		} catch (error) {
			logger.error("Failed to send SMS via Twilio", {
				phoneNumber,
				error: error.message,
				status: error.response?.status,
			});
			throw new Error(`SMS sending failed: ${error.message}`);
		}
	}
}

// SMS Service Factory
class SMSServiceFactory {
	static createService(provider = "SimpleTexting") {
		switch (provider.toLowerCase()) {
			case "simpletexting":
				return new SimpleTextingService();
			case "twilio":
				return new TwilioService();
			default:
				throw new Error(`Unsupported SMS provider: ${provider}`);
		}
	}
}

// Main SMS service that can switch providers
class SMSService {
	constructor(provider = null) {
		this.provider = provider || process.env.SMS_PROVIDER || "SimpleTexting";
		this.service = SMSServiceFactory.createService(this.provider);
	}

	async sendSMS(phoneNumber, message) {
		return await this.service.sendSMS(phoneNumber, message);
	}

	// Method to switch providers at runtime
	switchProvider(newProvider) {
		this.provider = newProvider;
		this.service = SMSServiceFactory.createService(newProvider);
		logger.info("SMS provider switched", { newProvider });
	}
}

// Export singleton instance
export const smsService = new SMSService();

// Export classes for testing
export { SMSService, SMSServiceFactory, SimpleTextingService, TwilioService };
