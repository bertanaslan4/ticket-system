import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { AutomationsService } from "./automations.service.js";
import { AdminGuard } from "../auth/admin.guard.js";

@Controller("automations")
@UseGuards(AdminGuard)
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  async listRules(@Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.listRules(tenantId);
  }

  @Post()
  @HttpCode(200)
  async createRule(@Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.createRule(tenantId, body);
  }

  @Put(":id")
  async updateRule(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.updateRule(Number(id), tenantId, body);
  }

  @Patch(":id/toggle")
  async toggleRule(@Param("id") id: string, @Body() body: any, @Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.toggleRule(Number(id), tenantId, Boolean(body.is_active));
  }

  @Delete(":id")
  async deleteRule(@Param("id") id: string, @Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.deleteRule(Number(id), tenantId);
  }

  @Post("test")
  @HttpCode(200)
  async testRule(@Body() body: any) {
    return this.automationsService.testRule(body.rule || {}, body.sample_ticket || {});
  }

  @Get("logs")
  async listLogs(@Req() req: any) {
    const tenantId = req.user?.tenant_id || 1;
    return this.automationsService.listLogs(tenantId);
  }
}
