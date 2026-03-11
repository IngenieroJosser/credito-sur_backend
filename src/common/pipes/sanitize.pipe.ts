import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value === 'object' && value !== null) {
      this.sanitizeObject(value);
    } else if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    return value;
  }

  private sanitizeObject(obj: any) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.sanitizeObject(obj[key]);
      }
    }
  }

  private sanitizeString(value: string): string {
    return sanitizeHtml(value, {
      allowedTags: [], // Strip all HTML tags
      allowedAttributes: {}, // Strip all attributes
      disallowedTagsMode: 'discard', // Totally remove the tags
    });
  }
}
