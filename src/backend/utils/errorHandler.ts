import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const handleError = (error: any) => {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  // Handle Prisma Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint failed
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Duplicate record error (Idempotency Key / Unique Constraint)' }, { status: 409 });
    }
    // Record not found
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
  }

  return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
};

export const successResponse = (data: any, status = 200) => {
  return NextResponse.json(data, { status });
};
