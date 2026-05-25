import { NextResponse } from 'next/server';
import prisma from '@/backend/config/prisma';

export async function POST() {
  try {
    // 1. Clear existing data
    await prisma.reservation.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.warehouse.deleteMany({});

    // 2. Create Warehouses
    const w1 = await prisma.warehouse.create({ data: { name: 'NY Primary', location: 'New York, NY' } });
    const w2 = await prisma.warehouse.create({ data: { name: 'CA Secondary', location: 'Los Angeles, CA' } });

    // 3. Create Products
    const p1 = await prisma.product.create({ data: { sku: 'PS5-CONSOLE', name: 'PlayStation 5 Console', price: 499.99 } });
    const p2 = await prisma.product.create({ data: { sku: 'MAC-M3-PRO', name: 'MacBook Pro M3', price: 1999.00 } });
    const p3 = await prisma.product.create({ data: { sku: 'NINTENDO-SW', name: 'Nintendo Switch OLED', price: 349.99 } });

    // 4. Create Inventory
    await prisma.inventory.createMany({
      data: [
        // PS5 is only in NY, limited stock
        { productId: p1.id, warehouseId: w1.id, totalStock: 3, reservedStock: 0 },
        // Mac is in both
        { productId: p2.id, warehouseId: w1.id, totalStock: 10, reservedStock: 0 },
        { productId: p2.id, warehouseId: w2.id, totalStock: 5, reservedStock: 0 },
        // Switch is only in CA
        { productId: p3.id, warehouseId: w2.id, totalStock: 20, reservedStock: 0 },
      ]
    });

    return NextResponse.json({ message: 'Database seeded successfully with PostgreSQL/Prisma!' });
  } catch (error: any) {
    console.error('Seeding failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
