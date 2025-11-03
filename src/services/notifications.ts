import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { User } from '../models/User.js';

const expo = new Expo();

export interface PushNotification {
    title: string;
    body: string;
    data?: any;
    sound?: 'default' | null;
}

export async function sendPushNotification(
    clerkId: string,
    notification: PushNotification
): Promise<boolean> {
    try {
        const user = await User.findOne({ clerkId });

        if (!user || !user.pushToken) {
            console.warn(`No push token for user ${clerkId}`);
            return false;
        }

        if (!Expo.isExpoPushToken(user.pushToken)) {
            console.error(`Invalid push token for user ${clerkId}: ${user.pushToken}`);
            return false;
        }

        const message: ExpoPushMessage = {
            to: user.pushToken,
            sound: notification.sound || 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
        };

        const chunks = expo.chunkPushNotifications([message]);
        const tickets = [];

        for (const chunk of chunks) {
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                console.error('Error sending push notification chunk:', error);
            }
        }

        return true;
    } catch (error) {
        console.error('Error sending push notification:', error);
        return false;
    }
}

export async function sendBroadcastNotification(
    notification: PushNotification,
    filter?: any
): Promise<number> {
    try {
        const users = await User.find({
            pushToken: { $exists: true, $ne: null },
            ...filter,
        });

        let sentCount = 0;
        const messages: ExpoPushMessage[] = [];

        for (const user of users) {
            if (!user.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
                continue;
            }

            messages.push({
                to: user.pushToken,
                sound: notification.sound || 'default',
                title: notification.title,
                body: notification.body,
                data: notification.data || {},
            });
        }

        const chunks = expo.chunkPushNotifications(messages);

        for (const chunk of chunks) {
            try {
                await expo.sendPushNotificationsAsync(chunk);
                sentCount += chunk.length;
            } catch (error) {
                console.error('Error sending broadcast chunk:', error);
            }
        }

        return sentCount;
    } catch (error) {
        console.error('Error sending broadcast notification:', error);
        return 0;
    }
}
