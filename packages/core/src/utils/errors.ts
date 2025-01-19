export class AppError extends Error {
  constructor(
    public statusCode: number,
    public status: string,
    message: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.status = status;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, 'error', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'error', message);
  }
}
