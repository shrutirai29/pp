import { NextResponse } from 'next/server';
import { executePayPalPayout } from '@/lib/paypal';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recipientEmail, amount, note, currency = 'USD', token } = body;

    if (!recipientEmail || !amount) {
      return NextResponse.json({ success: false, error: 'Missing required payout fields' }, { status: 400 });
    }

    const result = await executePayPalPayout(
      recipientEmail,
      amount,
      note || 'PayAgent Milestone Settlement',
      currency,
      token
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute payout';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
