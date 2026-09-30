import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import * as sanitizeHtml from 'sanitize-html';

/**
 * Un objeto por el que se puede indexar.
 *
 * La guarda existe para que el pipe no necesite `any`: la comprobacion se escribe una
 * vez, aqui, en vez de repartir `obj[key]` sin tipo por todo el recorrido.
 */
const esObjetoIndexable = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null;

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (esObjetoIndexable(value)) {
      this.sanitizeObject(value);
    } else if (typeof value === 'string') {
      return this.sanitizeString(value);
    }
    return value;
  }

  // `Record<string, unknown>` y no `any`: el pipe muta el objeto que recibe, y con `any`
  // ni la lectura ni la escritura de `obj[key]` se comprobaban.
  private sanitizeObject(obj: Record<string, unknown>) {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = this.sanitizeString(obj[key]);
      } else if (esObjetoIndexable(obj[key])) {
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
