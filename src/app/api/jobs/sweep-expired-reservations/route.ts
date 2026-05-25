import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/backend/config/prisma';
import { ReservationService } from '@/backend/services/reservation.service';

export async function POST(req: NextRequest) {
  try {
    // 1. Authorization check
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Find all expired PENDING reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() }
      }
    });

    let successCount = 0;
    let failCount = 0;

    // 3. Process releases
    for (const reservation of expiredReservations) {
      try {
        await ReservationService.release(reservation.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to release reservation ${reservation.id}:`, error);
        failCount++;
      }
    }

    return NextResponse.json({
      message: 'Sweep completed',
      processed: expiredReservations.length,
      successCount,
      failCount
    });

  } catch (error: any) {
    console.error('Sweep Job Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
