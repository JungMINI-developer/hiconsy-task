import { Module } from '@nestjs/common';
import { StudyRoomsController } from './study-rooms.controller.js';
import { StudyRoomsService } from './study-rooms.service.js';

@Module({
  controllers: [StudyRoomsController],
  providers: [StudyRoomsService],
  exports: [StudyRoomsService],
})
export class StudyRoomsModule {}
