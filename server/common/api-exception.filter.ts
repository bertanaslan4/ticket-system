import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const status =
      error instanceof HttpException ? error.getStatus() : error.status || 500;
    const key =
      error instanceof HttpException &&
      /file|multipart|part count|field/i.test(error.message)
        ? "attachment_limit"
        : error.type === "entity.parse.failed"
          ? "invalid_json_data"
          : error.type === "entity.too.large"
            ? "request_payload_is_too_large"
            : error instanceof HttpException
              ? status === 404
                ? "endpoint_not_found"
                : "invalid_selection"
              : error.status
                ? error.message
                : "the_action_could_not_be_completed_please_try_again";
    if (status >= 500) console.error(error);
    res.status(status).json({ error: key, errorParams: error.params || {} });
  }
}
