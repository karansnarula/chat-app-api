import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: Messaging;

  onModuleInit() {
    let app: App;

    if (getApps().length === 0) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

      if (!serviceAccountJson) {
        this.logger.error(
          'FIREBASE_SERVICE_ACCOUNT environment variable is not set',
        );
        return;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);

      app = initializeApp({
        credential: cert(serviceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized');
    } else {
      app = getApps()[0];
    }

    this.messaging = getMessaging(app);
  }

  async sendPushNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ) {
    try {
      await this.messaging.send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
      this.logger.log(
        `Push notification sent to token: ${fcmToken.substring(0, 20)}...`,
      );
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
    }
  }
}
