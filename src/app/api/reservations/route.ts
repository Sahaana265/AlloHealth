import { NextRequest } from 'next/server';
import { ReservationService } from '@/backend/services/reservation.service';
import { handleError, successResponse } from '@/backend/utils/errorHandler';
import { IdempotencyManager } from '@/backend/utils/idempotency';
import { z } from 'zod';

const ReserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get('idempotency-key');
    
    // 1. Idempotency Check
    if (idempotencyKey) {
      const cachedResponse = await IdempotencyManager.check(idempotencyKey);
      if (cachedResponse) return cachedResponse;
    }

    // 2. Validate Body
    const body = await req.json();
    const parsed = ReserveSchema.parse(body);

    // 3. Process Reservation (Handles Postgres Transaction)
    const reservation = await ReservationService.reserve(
      parsed.productId, 
      parsed.warehouseId, 
      parsed.quantity,
      idempotencyKey || undefined
    );

    const result = {
      ...reservation,
      _id: reservation.id // Map id for frontend compatibility
    };

    // 4. Cache Success Response
    if (idempotencyKey) {
      await IdempotencyManager.cacheResponse(idempotencyKey, result, 201);
    }

    return successResponse(result, 201);

  } catch (error) {
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      await IdempotencyManager.clear(idempotencyKey); // Clear lock to allow retry
    }
    return handleError(error);
  }
}
