export enum PaymentEventType {
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_PROCESSING = 'payment.processing',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_CANCELLED = 'payment.cancelled',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_DISPUTED = 'payment.disputed',
}

export interface PaymentEventData {
  paymentId: string;
  reference: string;
  merchantId: string;
  amount: number;
  currency: string;
  status: string;
  gateway: string;
  customerEmail?: string;
  customerName?: string;
  metadata?: Record<string, any>;
  failureCode?: string;
  failureReason?: string;
  gatewayReference?: string;
  timestamp: Date;
}

export interface PaymentEvent {
  eventType: PaymentEventType;
  eventId: string;
  timestamp: Date;
  version: string;
  source: string;
  data: PaymentEventData;
  correlationId?: string;
  retryCount?: number;
}

export interface SQSMessageAttributes {
  eventType: {
    DataType: 'String';
    StringValue: string;
  };
  merchantId: {
    DataType: 'String';
    StringValue: string;
  };
  paymentId: {
    DataType: 'String';
    StringValue: string;
  };
  timestamp: {
    DataType: 'String';
    StringValue: string;
  };
}