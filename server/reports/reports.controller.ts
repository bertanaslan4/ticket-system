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
import { ReportsService } from "./reports.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
@Controller("admin/reports")
@UseGuards(AdminGuard)
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get() list(@Query() query: any, @Req() req: any) {
    return this.service.list(query, req.user);
  }
}
