import { AttachmentStorage } from "./attachments.js";
import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service.js";
import { TicketsController } from "./tickets.controller.js";
import { AiModule } from "../ai/ai.module.js";
@Module({
  imports: [AiModule],
  controllers: [TicketsController],
  providers: [TicketsService, AttachmentStorage],
})
export class TicketsModule {}
