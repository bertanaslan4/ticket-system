import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard.js";
import { IntegrationsService } from "./integrations.service.js";

@Controller("admin/integrations")
@UseGuards(AdminGuard)
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get("smtp")
  getSmtpConfig(@Req() req: any) {
    return this.service.getSmtpConfig(req.user);
  }

  @Post("smtp")
  saveSmtpConfig(@Req() req: any, @Body() body: any) {
    return this.service.saveSmtpConfig(req.user, body);
  }

  @Post("smtp/test")
  testSmtp(@Req() req: any, @Body() body: any) {
    return this.service.testSmtp(req.user, body);
  }

  @Get("webhooks")
  getWebhooksConfig(@Req() req: any) {
    return this.service.getWebhooksConfig(req.user);
  }

  @Post("webhooks")
  saveWebhooksConfig(@Req() req: any, @Body() body: any) {
    return this.service.saveWebhooksConfig(req.user, body);
  }

  @Post("webhooks/test")
  testWebhook(@Req() req: any, @Body() body: any) {
    return this.service.testWebhook(req.user, body);
  }
}
