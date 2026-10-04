import { NextResponse } from 'next/server';
import { createPayPalEscrowAuthorization } from '@/lib/paypal';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency = 'USD', token, missionId } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    const result = await createPayPalEscrowAuthorization(amount, currency, token, missionId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to authorize escrow';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
