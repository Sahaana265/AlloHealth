'use client';

import { useEffect, useState, use } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { differenceInSeconds } from 'date-fns';

export default function CheckoutPage({ params }: { params: Promise<{ reservationId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const reservationId = resolvedParams.reservationId;
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { data: reservation, isLoading, error } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      const res = await fetch(`/api/reservations/${reservationId}`);
      if (!res.ok) throw new Error('Failed to fetch reservation details');
      return res.json();
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return (data && data.status === 'PENDING') ? false : false;
    }
  });

  useEffect(() => {
    if (!reservation || reservation.status !== 'PENDING') return;

    const interval = setInterval(() => {
      const expiresAt = new Date(reservation.expiresAt);
      const diff = differenceInSeconds(expiresAt, new Date());
      
      if (diff <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservation]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const idempotencyKey = uuidv4();
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to confirm reservation');
      return data;
    },
    onSuccess: () => {
      toast.success('Payment successful! Reservation confirmed.');
      router.push('/');
    },
    onError: (error: any) => {
      toast.error(error.message);
      // If 410 Gone, it means expired. UI should react.
    }
  });

  const releaseMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to release reservation');
    },
    onSuccess: () => {
      toast.info('Reservation cancelled.');
      router.push('/');
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  if (isLoading) return <div className="p-8 text-center">Loading checkout...</div>;
  if (error || !reservation) return <div className="p-8 text-center text-destructive">Could not load reservation.</div>;

  const isExpired = timeLeft === 0 || reservation.status !== 'PENDING';

  return (
    <div className="container mx-auto p-8 max-w-xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center pb-8 border-b">
          <CardTitle className="text-3xl">Checkout</CardTitle>
          <CardDescription className="text-lg mt-2">
            Complete your payment to confirm the order.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-8 flex flex-col items-center">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-semibold mb-2">{reservation.productId?.name || 'Product'}</h3>
            <p className="text-muted-foreground">Warehouse: {reservation.warehouseId?.name || 'N/A'}</p>
            <div className="mt-4 text-3xl font-bold">
              Total: ₹{(reservation.productId?.price * reservation.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className={`text-center p-6 rounded-lg w-full ${isExpired ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted/50'}`}>
            <p className={`text-sm font-medium mb-2 ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
              {isExpired ? 'RESERVATION EXPIRED' : 'RESERVATION EXPIRES IN'}
            </p>
            {!isExpired && timeLeft !== null && (
              <div className={`text-5xl font-mono font-bold tracking-tight ${timeLeft < 60 ? 'text-orange-500 animate-pulse' : 'text-primary'}`}>
                {formatTime(timeLeft)}
              </div>
            )}
            {isExpired && (
              <p className="text-destructive font-semibold">Your hold on this item has been released.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col-reverse sm:flex-row gap-4 pt-6 border-t bg-muted/20">
          <Button 
            variant="outline" 
            className="w-full sm:w-1/2 h-14 text-lg font-medium" 
            onClick={() => releaseMutation.mutate()}
            disabled={confirmMutation.isPending || releaseMutation.isPending || isExpired}
          >
            Cancel
          </Button>
          <Button 
            className="w-full sm:w-1/2 h-14 text-lg font-medium bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || releaseMutation.isPending || isExpired}
          >
            {confirmMutation.isPending ? 'Processing...' : 'Confirm Purchase'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
