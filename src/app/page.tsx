'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Warehouse {
  _id: string;
  name: string;
  location: string;
}

interface Inventory {
  warehouse: Warehouse;
  totalStock: number;
  reservedStock: number;
  availableStock: number;
}

interface Product {
  _id: string;
  sku: string;
  name: string;
  price: number;
  inventory: Inventory[];
}

export default function ProductsPage() {
  const router = useRouter();

  const { data: products, isLoading, error, refetch } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    }
  });

  const reserveMutation = useMutation({
    mutationFn: async ({ productId, warehouseId }: { productId: string, warehouseId: string }) => {
      const idempotencyKey = uuidv4();
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reserve');
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success('Inventory reserved successfully!');
      router.push(`/checkout/${data._id}`);
    },
    onError: (error: any) => {
      toast.error(error.message);
      refetch(); // Refetch to show updated stock if it was a 409
    }
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading products...</div>;
  if (error) return <div className="p-8 text-center text-destructive">Failed to load products.</div>;

  return (
    <div className="container mx-auto p-8 max-w-5xl">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Allo Health Inventory</h1>
          <p className="text-muted-foreground mt-2">Select a product to reserve it for checkout.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {products?.map((product) => (
          <Card key={product._id} className="overflow-hidden shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                  <CardDescription>SKU: {product.sku}</CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg py-1 px-3">
                  ₹{product.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Available Stock</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.inventory.map((inv) => (
                    <TableRow key={inv.warehouse._id}>
                      <TableCell className="font-medium">{inv.warehouse.name}</TableCell>
                      <TableCell className="text-muted-foreground">{inv.warehouse.location}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={`font-semibold ${inv.availableStock > 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {inv.availableStock} units
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({inv.reservedStock} reserved)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          onClick={() => reserveMutation.mutate({ productId: product._id, warehouseId: inv.warehouse._id })}
                          disabled={inv.availableStock <= 0 || reserveMutation.isPending}
                        >
                          {reserveMutation.isPending ? 'Holding...' : 'Reserve'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {product.inventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No inventory available across any warehouse.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
        {products?.length === 0 && (
          <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            No products found. Please seed the database.
          </div>
        )}
      </div>
    </div>
  );
}
