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
import { OrganizationsService } from "./organizations.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
@Controller("admin/organizations")
@UseGuards(AdminGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}
  @Get() list() {
    return this.service.list();
  }
  @Post() create(@Body() body: any, @Req() req: any) {
    return this.service.save(undefined, body, req.user);
  }
  @Post(":id") @HttpCode(200) update(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.save(id, body, req.user);
  }
}
