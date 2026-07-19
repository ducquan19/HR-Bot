import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  
  constructor(private readonly config: ConfigService) {}

  async generateToken(roomName: string, participantName: string, participantIdentity: string) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY') || 'devkey';
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET') || 'devsecret';

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: participantName,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }
}
