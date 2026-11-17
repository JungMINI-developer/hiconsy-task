import { Module } from '@nestjs/common';
import { SeatsService } from '../seats/seats.service.js';
import { StudyRoomsController } from './study-rooms.controller.js';
import { StudyRoomsService } from './study-rooms.service.js';

@Module({
  controllers: [StudyRoomsController],
  providers: [StudyRoomsService, SeatsService],
  exports: [StudyRoomsService],
})
export class StudyRoomsModule {}
