import { NextResponse } from 'next/server';
import { getPayPalAccessToken } from '@/lib/paypal';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientId, clientSecret, mode } = body;

    if (mode === 'simulation' || !clientId || !clientSecret) {
      return NextResponse.json({
        success: true,
        mode: 'simulation',
        token: `mock_token_${Date.now()}`,
        expires_in: 32400,
        message: 'Running in high-fidelity PayPal Sandbox Simulation Mode',
      });
    }

    const authResult = await getPayPalAccessToken(clientId, clientSecret);
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: 'live_sandbox',
      token: authResult.token,
      message: 'Successfully authenticated with Live PayPal Sandbox API',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
