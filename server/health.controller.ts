import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/public.decorator.js";
import { DatabaseService } from "./database/database.service.js";
@Controller("health")
export class HealthController {
  constructor(private readonly db: DatabaseService) {}
  @Public() @Get() async health() {
    await this.db.query("SELECT 1");
    return { ok: true };
  }
}
