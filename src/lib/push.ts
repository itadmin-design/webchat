import webpush from "web-push";
import { connectDB } from "./db";
import { PushSubscription } from "@/models/PushSubscription";

let initialized = false;

function initVapid() {
  if (initialized) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) {
    webpush.setVapidDetails("mailto:admin@chatplatform.com", publicKey, privateKey);
    initialized = true;
  }
}

export async function sendPushNotification(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  initVapid();
  if (!initialized) return;

  await connectDB();
  const subscriptions = await PushSubscription.find({ userId });

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
        JSON.stringify(payload)
      );
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.deleteOne({ _id: sub._id });
      }
    }
  }
}
