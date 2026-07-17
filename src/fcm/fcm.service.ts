import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import * as path from 'path';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: Messaging;

  onModuleInit() {
    let app: App;

    if (getApps().length === 0) {
      const serviceAccountPath = path.join(
        process.cwd(),
        'src/config/firebase/firebase-service-account.json',
      );

      app = initializeApp({
        credential: cert(serviceAccountPath),
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