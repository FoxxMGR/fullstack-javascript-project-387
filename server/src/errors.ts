import type { ValidationError } from './types.ts';

/**
 * Ошибка обработки запроса: HTTP-статус + тело в формате ValidationError
 * из контракта (code, message, details).
 */
export class ApiError extends Error {
  readonly status: number;

  readonly code: string;

  readonly details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Приводит ApiError к телу ответа ValidationError из контракта. */
export function toValidationError(err: ApiError): ValidationError {
  const body: ValidationError = { code: err.code, message: err.message };
  if (err.details) {
    body.details = err.details;
  }
  return body;
}