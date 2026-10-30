export interface PayPalOrderParams {
  dealId: string;
  referenceId: string;
  description: string;
  amount: number;
  currency: string;
  idempotencyKey?: string;
}

export interface PayPalOrderResult {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
}

export interface PayPalCaptureResult {
  id: string;
  status: string;
  captureId?: string;
  payerEmail?: string;
  payerId?: string;
}

export interface PayPalClient {
  createOrder(params: PayPalOrderParams): Promise<PayPalOrderResult>;
  captureOrder(orderId: string, idempotencyKey?: string): Promise<PayPalCaptureResult>;
  getOrder(orderId: string): Promise<PayPalCaptureResult>;
}

export class HttpPayPalClient implements PayPalClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private baseUrl: string = 'https://api-m.sandbox.paypal.com'
  ) {}

  private async getAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('PayPal credentials missing: PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured.');
    }

    // Return cached token if valid (with 60-second grace window)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const tokenUrl = `${this.baseUrl}/v1/oauth2/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`PayPal authentication failed with HTTP ${response.status}: ${this.sanitizeError(errorText)}`);
      }

      const data = await response.json() as { access_token: string; expires_in: number };
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return this.accessToken;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown OAuth error';
      throw new Error(`PayPal OAuth failure: ${this.sanitizeError(msg)}`);
    }
  }

  public async createOrder(params: PayPalOrderParams): Promise<PayPalOrderResult> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/checkout/orders`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    if (params.idempotencyKey) {
      headers['PayPal-Request-Id'] = params.idempotencyKey;
    }

    // PayPal requires 2 decimal places for amounts in standard currencies
    const formattedAmount = params.amount.toFixed(2);
    // Currency fallback to USD if not standard ISO supported by merchant sandbox
    const currency = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(params.currency.toUpperCase())
      ? params.currency.toUpperCase()
      : 'USD';

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description.substring(0, 127),
          custom_id: params.dealId,
          amount: {
            currency_code: currency,
            value: formattedAmount,
          },
        },
      ],
      application_context: {
        brand_name: 'DealMind IntentLock',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`PayPal createOrder failed HTTP ${res.status}: ${this.sanitizeError(errBody)}`);
      }

      const data = await res.json() as { id: string; status: string; links?: { rel: string; href: string }[] };
      return {
        id: data.id,
        status: data.status,
        links: data.links,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown createOrder error';
      throw new Error(`PayPal order creation error: ${this.sanitizeError(msg)}`);
    }
  }

  public async captureOrder(orderId: string, idempotencyKey?: string): Promise<PayPalCaptureResult> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    if (idempotencyKey) {
      headers['PayPal-Request-Id'] = idempotencyKey;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`PayPal captureOrder failed HTTP ${res.status}: ${this.sanitizeError(errBody)}`);
      }

      const data = await res.json() as any;
      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      return {
        id: data.id,
        status: data.status || capture?.status || 'UNKNOWN',
        captureId: capture?.id,
        payerEmail: data.payer?.email_address,
        payerId: data.payer?.payer_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown captureOrder error';
      throw new Error(`PayPal order capture error: ${this.sanitizeError(msg)}`);
    }
  }

  public async getOrder(orderId: string): Promise<PayPalCaptureResult> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`PayPal getOrder failed HTTP ${res.status}: ${this.sanitizeError(errBody)}`);
      }

      const data = await res.json() as any;
      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      return {
        id: data.id,
        status: data.status || capture?.status || 'UNKNOWN',
        captureId: capture?.id,
        payerEmail: data.payer?.email_address,
        payerId: data.payer?.payer_id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown getOrder error';
      throw new Error(`PayPal getOrder error: ${this.sanitizeError(msg)}`);
    }
  }

  /**
   * Sanitizes any sensitive tokens, secrets, or internal keys from error strings
   */
  private sanitizeError(input: string): string {
    let sanitized = input;
    if (this.clientSecret) {
      sanitized = sanitized.replaceAll(this.clientSecret, '***REDACTED_SECRET***');
    }
    if (this.clientId) {
      sanitized = sanitized.replaceAll(this.clientId, '***REDACTED_CLIENT_ID***');
    }
    if (this.accessToken) {
      sanitized = sanitized.replaceAll(this.accessToken, '***REDACTED_TOKEN***');
    }
    // Also remove basic auth tokens or bearer patterns if present
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***REDACTED***');
    sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic ***REDACTED***');
    return sanitized;
  }
}
