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
import { UsersService } from "./users.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
@Controller("admin/users")
@UseGuards(AdminGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @Get() list(@Req() req: any) {
    return this.service.list(req.user);
  }
  @Post(":id/delete") @HttpCode(200) remove(@Param("id") id: string, @Req() req: any) {
    return this.service.remove(id, req.user);
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
