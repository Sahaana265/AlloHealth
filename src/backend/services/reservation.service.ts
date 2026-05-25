import prisma from '../config/prisma';
import { AppError } from '../utils/errorHandler';

export class ReservationService {
  /**
   * Creates a reservation with concurrency control using PostgreSQL row-level locking.
   * `SELECT ... FOR UPDATE` ensures no other transaction can read or write the inventory
   * row until this transaction completes, preventing any race conditions.
   */
  static async reserve(productId: string, warehouseId: string, quantity: number, idempotencyKey?: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Acquire row-level lock on the specific inventory record
      // We use $queryRaw because Prisma does not natively support FOR UPDATE in findUnique.
      const inventoryRows = await tx.$queryRaw<
        { id: string; totalStock: number; reservedStock: number }[]
      >`
        SELECT id, "totalStock", "reservedStock"
        FROM "Inventory"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId}
        FOR UPDATE
      `;

      if (inventoryRows.length === 0) {
        throw new AppError('Inventory not found for this product and warehouse', 404);
      }

      const inventory = inventoryRows[0];
      const availableStock = inventory.totalStock - inventory.reservedStock;

      // 2. Validate stock availability
      if (availableStock < quantity) {
        throw new AppError('Not enough stock available', 409);
      }

      // 3. Atomic decrement of available stock (via updating reservedStock)
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          reservedStock: { increment: quantity }
        }
      });

      // 4. Create the reservation
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt,
          idempotencyKey
        }
      });

      return reservation;
    }, {
      maxWait: 15000, // Wait up to 15s for a connection/lock
      timeout: 30000  // Maximum 30s for the entire transaction
    });
  }

  /**
   * Confirms a reservation (payment succeeded)
   */
  static async confirm(reservationId: string) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId }
      });

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'PENDING') {
        throw new AppError(`Reservation is already ${reservation.status}`, 400);
      }

      // Lazy expiration check
      if (new Date() > reservation.expiresAt) {
        // Automatically release it
        await this.releaseInner(reservation, tx);
        throw new AppError('Reservation has expired', 410);
      }

      // Update reservation status
      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CONFIRMED' }
      });

      // Permanently decrement both totalStock and reservedStock
      await tx.inventory.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId
          }
        },
        data: {
          totalStock: { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity }
        }
      });

      return updatedReservation;
    }, {
      maxWait: 15000,
      timeout: 30000
    });
  }

  /**
   * Releases a reservation (payment failed or user cancelled)
   */
  static async release(reservationId: string) {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId }
      });

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'PENDING') {
        throw new AppError(`Reservation is already ${reservation.status}`, 400);
      }

      return await this.releaseInner(reservation, tx);
    }, {
      maxWait: 15000,
      timeout: 30000
    });
  }

  /**
   * Internal reusable release logic used by both release() and confirm() when expired
   */
  private static async releaseInner(reservation: any, tx: any) {
    const updatedReservation = await tx.reservation.update({
      where: { id: reservation.id },
      data: { status: 'RELEASED' }
    });

    // Decrement reserved stock, making it available again
    await tx.inventory.update({
      where: {
        productId_warehouseId: {
          productId: reservation.productId,
          warehouseId: reservation.warehouseId
        }
      },
      data: {
        reservedStock: { decrement: reservation.quantity }
      }
    });

    return updatedReservation;
  }
}
