import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { TasksService } from "./tasks.service.js";

@Controller("tasks")
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    return this.service.list(req.user, query);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user, body);
  }

  @Get(":id")
  async getOne(@Req() req: any, @Param("id") id: string) {
    return this.service.getOne(req.user, id);
  }

  @Patch(":id")
  async update(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.service.update(req.user, id, body);
  }

  @Patch(":id/status")
  async updateStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(req.user, id, status);
  }

  @Delete(":id")
  async delete(@Req() req: any, @Param("id") id: string) {
    return this.service.delete(req.user, id);
  }

  @Post(":id/worklogs")
  async addWorklog(@Req() req: any, @Param("id") id: string, @Body() body: any) {
    return this.service.addWorklog(req.user, id, body);
  }
}
