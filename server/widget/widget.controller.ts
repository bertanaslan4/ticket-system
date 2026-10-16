import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from "@nestjs/common";
import { Public } from "../auth/public.decorator.js";
import { WidgetService } from "./widget.service.js";

@Controller("widget")
export class WidgetController {
  constructor(private readonly service: WidgetService) {}

  @Public()
  @Get("config")
  async getConfig(@Query("tenant") tenant?: string) {
    return this.service.getConfig(tenant);
  }

  @Public()
  @Get("kb")
  async searchKb(
    @Query("tenant") tenant?: string,
    @Query("q") q?: string,
  ) {
    return this.service.searchKb(tenant, q);
  }

  @Public()
  @Post("tickets")
  async createTicket(@Body() body: any) {
    return this.service.createTicket(body);
  }

  @Public()
  @Get("track")
  async trackTicket(
    @Query("tenant") tenant: string,
    @Query("number") number: string,
    @Query("email") email: string,
  ) {
    return this.service.trackTicket({ tenant, number, email });
  }
}
