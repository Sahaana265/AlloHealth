import { NextResponse } from 'next/server';
import prisma from '@/backend/config/prisma';
import { handleError, successResponse } from '@/backend/utils/errorHandler';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany();
    
    // Map to expected frontend structure
    const result = warehouses.map(w => ({
      ...w,
      _id: w.id
    }));

    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
