import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/backend/config/prisma';
import { handleError, successResponse } from '@/backend/utils/errorHandler';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true
      }
    });

    if (!reservation) {
      return NextResponse.json({ error: 'Reservation not found' }, { status: 404 });
    }

    // Map to expected frontend structure
    const result = {
      ...reservation,
      _id: reservation.id,
      productId: {
        ...reservation.product,
        _id: reservation.product.id
      },
      warehouseId: {
        ...reservation.warehouse,
        _id: reservation.warehouse.id
      }
    };

    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
