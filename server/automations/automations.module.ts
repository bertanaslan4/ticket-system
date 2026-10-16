import { Module, forwardRef } from "@nestjs/common";
import { AutomationsService } from "./automations.service.js";
import { AutomationsController } from "./automations.controller.js";
import { DatabaseModule } from "../database/database.module.js";

@Module({
  imports: [DatabaseModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
