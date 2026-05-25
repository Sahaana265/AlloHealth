import { NextRequest } from 'next/server';
import { ReservationService } from '@/backend/services/reservation.service';
import { handleError, successResponse } from '@/backend/utils/errorHandler';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Process Release
    const reservation = await ReservationService.release(id);

    return successResponse({
      ...reservation,
      _id: reservation.id
    }, 200);

  } catch (error) {
    return handleError(error);
  }
}
