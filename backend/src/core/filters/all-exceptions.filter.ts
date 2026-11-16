import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      // Preserve the existing contract exactly — do not reshape known errors.
      return response
        .status(exception.getStatus())
        .json(exception.getResponse());
    }

    this.logger.error(
      `Unhandled ${request.method} ${request.url} (user: ${request.user?.sub ?? 'anon'})`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return response.status(500).json({
      statusCode: 500,
      message: 'Une erreur interne est survenue.',
      error: 'E_INTERNAL',
    });
  }
}
