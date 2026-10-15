import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
} from "@nestjs/common";
import { AuthService } from "./auth.service.js";
import { Public } from "./public.decorator.js";
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() body: any, @Res({ passthrough: true }) res: any) {
    const token = await this.auth.login(body || {});
    res.setHeader(
      "Set-Cookie",
      `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return { ok: true };
  }
  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.auth.logout(req.token);
    res.setHeader(
      "Set-Cookie",
      "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    );
    return result;
  }
  @Get("me") me(@Req() req: any) {
    return this.auth.me(req.user);
  }
  @Post("me/password")
  @HttpCode(200)
  changePassword(@Req() req: any, @Body() body: any) {
    return this.auth.changePassword(req.user, req.token, body || {});
  }
}
