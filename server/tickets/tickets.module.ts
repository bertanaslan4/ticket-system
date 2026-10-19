import { AttachmentStorage } from "./attachments.js";
import { Module } from "@nestjs/common";
import { TicketsService } from "./tickets.service.js";
import { TicketsController } from "./tickets.controller.js";
import { AiModule } from "../ai/ai.module.js";
import { AutomationsModule } from "../automations/automations.module.js";
import { RealtimeModule } from "../realtime/realtime.module.js";
@Module({
  imports: [AiModule, AutomationsModule, RealtimeModule],
  controllers: [TicketsController],
  providers: [TicketsService, AttachmentStorage],
})
export class TicketsModule {}
