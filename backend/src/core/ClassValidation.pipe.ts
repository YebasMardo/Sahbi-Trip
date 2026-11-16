import {
  BadRequestException,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';

function flattenErrors(
  errors: ValidationError[],
  parentPath = '',
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const err of errors) {
    const path = parentPath ? `${parentPath}.${err.property}` : err.property;
    if (err.constraints) {
      out[path] = Object.values(err.constraints);
    }
    if (err.children?.length) {
      Object.assign(out, flattenErrors(err.children, path));
    }
  }
  return out;
}

export class ClassValidationPipe extends ValidationPipe {
  constructor(options_?: ValidationPipeOptions) {
    super({
      ...(options_ ?? {}),
      exceptionFactory(errors: ValidationError[]) {
        throw new BadRequestException({
          statusCode: 400,
          message:
            'Les données soumises sont incorrectes. Veuillez corriger les erreurs puis resoumettre.',
          errors: flattenErrors(errors),
        });
      },
    });
  }
}
