import { Module } from "@nestjs/common";
import { AiService } from "./ai.service.js";
import { AiController } from "./ai.controller.js";
import { DatabaseModule } from "../database/database.module.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
