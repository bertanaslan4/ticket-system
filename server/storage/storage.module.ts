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
import { PlatformAdminGuard } from "../auth/platform-admin.guard.js";
import { StorageSettings } from "./storage.service.js";
// Storage settings are shared by every tenant, so only platform admins may change them.
@Controller("admin/storage")
@UseGuards(PlatformAdminGuard)
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
