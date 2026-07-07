import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  emitCandidateUpdated(candidateId: string, payload: unknown) {
    this.server.emit('candidate.updated', { candidateId, payload });
  }

  emitCvProcessing(cvId: string, status: string, payload?: unknown) {
    this.server.emit('cv.processing', { cvId, status, payload });
  }
}
