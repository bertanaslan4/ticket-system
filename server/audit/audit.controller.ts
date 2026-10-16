import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  UseGuards,
} from "@nestjs/common";
import { AuditService } from "./audit.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
@Controller("admin/audit")
@UseGuards(AdminGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}
  @Get() list(@Req() req: any) {
    return this.service.list(req.user);
  }
}
