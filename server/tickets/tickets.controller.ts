import { FilesInterceptor } from "@nestjs/platform-express";
import { UploadedFiles, UseInterceptors, Res } from "@nestjs/common";
import { pipeline } from "node:stream/promises";
import { uploadOptions, cleanup } from "./attachments.js";
import { fail } from "../common/domain.js";
function payload(body: any) {
  if (body.payload === undefined) return body;
  try {
    const value = JSON.parse(body.payload);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    fail(400, "invalid_json_data");
  }
}
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
import { TicketsService } from "./tickets.service.js";
import { AdminGuard } from "../auth/admin.guard.js";
@Controller("tickets")
export class TicketsController {
  constructor(private readonly service: TicketsService) {}
  @Get() list(@Req() req: any) {
    return this.service.list(req.user);
  }
  @Get(":id") detail(@Param("id") id: string, @Req() req: any) {
    return this.service.detail(id, req.user);
  }
  @Post()
  @UseInterceptors(FilesInterceptor("files", 5, uploadOptions))
  async create(
    @Body() body: any,
    @Req() req: any,
    @UploadedFiles() files: any[] = [],
  ) {
    try {
      const data = payload(body);
      return await this.service.withFiles(files, (items) =>
        this.service.create(data, req.user, items),
      );
    } finally {
      await cleanup(files);
    }
  }
  @Get(":id/attachments/:attachmentId") async download(
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const { attachment, stream } = await this.service.download(
      id,
      attachmentId,
      req.user,
    );
    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Length": String(attachment.size),
      "Content-Disposition":
        "attachment; filename*=UTF-8''" + encodeURIComponent(attachment.name),
      "X-Content-Type-Options": "nosniff",
    });
    try {
      await pipeline(stream, res);
    } catch {
      res.destroy();
    }
  }
  @Post(":id/actions")
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor("files", 5, uploadOptions))
  async action(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any,
    @UploadedFiles() files: any[] = [],
  ) {
    try {
      const data = payload(body);
      return await this.service.withFiles(files, (items) =>
        this.service.action(id, data, req.user, items),
      );
    } finally {
      await cleanup(files);
    }
  }
  @Post(":id/csat")
  @HttpCode(200)
  async submitCsat(
    @Param("id") id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.submitCsat(id, req.user, body);
  }
}

