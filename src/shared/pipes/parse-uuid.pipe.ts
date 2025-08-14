import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { validate as isUuid } from 'uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!isUuid(value)) {
      throw new BadRequestException({
        message: `Invalid UUID format for parameter '${metadata.data}'`,
        errorCode: 'INVALID_UUID',
        details: {
          parameter: metadata.data,
          value,
          expectedFormat: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        },
      });
    }
    return value;
  }
}