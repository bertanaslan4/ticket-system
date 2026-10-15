import {
  Global,
  Module,
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { StorageSettings } from "./storage.service.js";
@Controller("admin/storage")
@UseGuards(AdminGuard)
class StorageController {
  constructor(private readonly settings: StorageSettings) {}
  @Get() status() {
    return this.settings.status();
  }
  @Post() save(@Body() body: any, @Req() req: any) {
    return this.settings.save(body, req.user);
  }
  @Post("test") test(@Body() body: any) {
    return this.settings.test(body);
  }
}
@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageSettings],
  exports: [StorageSettings],
})
export class StorageModule {}
