import { NextResponse } from 'next/server';
import prisma from '@/backend/config/prisma';
import { handleError, successResponse } from '@/backend/utils/errorHandler';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        inventory: {
          include: {
            warehouse: true
          }
        }
      }
    });

    const result = products.map(product => {
      const inventory = product.inventory.map(inv => ({
        warehouse: {
          ...inv.warehouse,
          _id: inv.warehouse.id
        },
        totalStock: inv.totalStock,
        reservedStock: inv.reservedStock,
        availableStock: inv.totalStock - inv.reservedStock
      }));

      // Map back to the expected frontend structure
      return {
        _id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        inventory
      };
    });

    return successResponse(result);
  } catch (error) {
    return handleError(error);
  }
}
