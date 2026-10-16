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
  async login(
    @Body() body: any,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const token = await this.auth.login(body || {});
    res.setHeader(
      "Set-Cookie",
      `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    if (body?.mobile === true || req?.headers?.["x-client"] === "mobile") {
      return { ok: true, token };
    }
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
  @Public()
  @Post("public/forgot-password")
  @HttpCode(200)
  forgotPassword(@Body() body: any) {
    return this.auth.forgotPassword(body || {});
  }
  @Public()
  @Post("public/reset-password")
  @HttpCode(200)
  resetPassword(@Body() body: any) {
    return this.auth.resetPassword(body || {});
  }
  @Public()
  @Post("public/verify-email")
  @HttpCode(200)
  verifyEmail(@Body() body: any) {
    return this.auth.verifyEmail(body || {});
  }
  @Post("me/verify-email/resend")
  @HttpCode(200)
  resendVerification(@Req() req: any) {
    return this.auth.resendVerification(req.user);
  }
  @Post("me/password")
  @HttpCode(200)
  changePassword(@Req() req: any, @Body() body: any) {
    return this.auth.changePassword(req.user, req.token, body || {});
  }
  @Post("me/push-token")
  @HttpCode(200)
  registerPushToken(@Req() req: any, @Body() body: any) {
    return this.auth.registerPushToken(req.user, body || {});
  }
  @Post("me/push-token/remove")
  @HttpCode(200)
  removePushToken(@Req() req: any, @Body() body: any) {
    return this.auth.removePushToken(req.user, body || {});
  }
  @Get("me/notifications")
  listNotifications(@Req() req: any) {
    return this.auth.listNotifications(req.user);
  }
}
