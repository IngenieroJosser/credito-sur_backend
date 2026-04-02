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
    // Early-return lineal O(n): si no hay ningún '<' no puede haber etiqueta HTML.
    // Se evita la regex `/<[\w\/]+[^>]*>/` que era vulnerable a ReDoS por backtracking
    // cuando el input contiene '<' sin '>' correspondiente (p.ej. `<aaaaaaa...`).
    if (!value.includes('<')) {
      return value;
    }

    const sanitized = sanitizeHtml(value, {
      allowedTags: [], // Strip all HTML tags
      allowedAttributes: {}, // Strip all attributes
      disallowedTagsMode: 'discard', // Totally remove the tags
    });

    // Como medida adicional en caso de que quede algo codificado
    return sanitized
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/gi, ' ');
  }
}
