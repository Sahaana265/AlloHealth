import { NextRequest } from 'next/server';
import { ReservationService } from '@/backend/services/reservation.service';
import { handleError, successResponse } from '@/backend/utils/errorHandler';
import { IdempotencyManager } from '@/backend/utils/idempotency';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const idempotencyKey = req.headers.get('idempotency-key');
    
    // 1. Idempotency Check
    if (idempotencyKey) {
      const cachedResponse = await IdempotencyManager.check(idempotencyKey);
      if (cachedResponse) return cachedResponse;
    }

    // 2. Process Confirmation
    const reservation = await ReservationService.confirm(id);

    const result = {
      ...reservation,
      _id: reservation.id
    };

    // 3. Cache Success Response
    if (idempotencyKey) {
      await IdempotencyManager.cacheResponse(idempotencyKey, result, 200);
    }

    return successResponse(result, 200);

  } catch (error) {
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      await IdempotencyManager.clear(idempotencyKey); 
    }
    return handleError(error);
  }
}
