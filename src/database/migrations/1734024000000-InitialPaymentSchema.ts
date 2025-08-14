import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPaymentSchema1734024000000 implements MigrationInterface {
  name = 'InitialPaymentSchema1734024000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure uuid-ossp extension exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums first
    await queryRunner.query(`CREATE TYPE "public"."merchants_merchanttype_enum" AS ENUM('individual', 'business', 'enterprise')`);
    await queryRunner.query(`CREATE TYPE "public"."merchants_status_enum" AS ENUM('active', 'inactive', 'suspended', 'pending')`);
    await queryRunner.query(`CREATE TYPE "public"."payment_methods_type_enum" AS ENUM('card', 'bank_account', 'mobile_money', 'crypto', 'paypal', 'stripe')`);
    await queryRunner.query(`CREATE TYPE "public"."payment_methods_status_enum" AS ENUM('active', 'inactive', 'expired', 'blocked')`);
    await queryRunner.query(`CREATE TYPE "public"."payment_methods_cardtype_enum" AS ENUM('visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners')`);
    await queryRunner.query(`CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed', 'expired')`);
    await queryRunner.query(`CREATE TYPE "public"."payments_paymenttype_enum" AS ENUM('payment', 'refund', 'chargeback', 'adjustment')`);
    await queryRunner.query(`CREATE TYPE "public"."payments_currency_enum" AS ENUM('USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR', 'BTC', 'ETH')`);
    await queryRunner.query(`CREATE TYPE "public"."payments_gateway_enum" AS ENUM('paystack', 'flutterwave', 'stripe', 'paypal', 'square', 'razorpay', 'internal')`);

    // Create merchants table
    await queryRunner.query(`
      CREATE TABLE "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" character varying(50) NOT NULL DEFAULT 'system',
        "updated_by" character varying(50) NOT NULL DEFAULT 'system',
        "name" character varying(100) NOT NULL,
        "email" character varying(150) NOT NULL,
        "phone" character varying(20),
        "address" text,
        "business_name" character varying(100),
        "business_id" character varying(50),
        "merchant_type" "public"."merchants_merchanttype_enum" NOT NULL DEFAULT 'individual',
        "status" "public"."merchants_status_enum" NOT NULL DEFAULT 'pending',
        "webhook_url" character varying(255),
        "webhook_secret" character varying(100),
        "api_settings" json,
        "total_processed_amount" numeric(15,2) NOT NULL DEFAULT '0',
        "total_transactions" integer NOT NULL DEFAULT '0',
        "last_transaction_at" TIMESTAMP,
        "verified_at" TIMESTAMP,
        "verified_by" character varying(50),
        CONSTRAINT "PK_merchants" PRIMARY KEY ("id")
      )
    `);

    // Create payment_methods table
    await queryRunner.query(`
      CREATE TABLE "payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" character varying(50) NOT NULL DEFAULT 'system',
        "updated_by" character varying(50) NOT NULL DEFAULT 'system',
        "name" character varying(50) NOT NULL,
        "type" "public"."payment_methods_type_enum" NOT NULL,
        "status" "public"."payment_methods_status_enum" NOT NULL DEFAULT 'active',
        "is_default" boolean NOT NULL DEFAULT false,
        "encrypted_data" text,
        "masked_number" character varying(20),
        "card_type" "public"."payment_methods_cardtype_enum",
        "card_holder_name" character varying(50),
        "expiry_date" character varying(7),
        "bank_name" character varying(100),
        "account_holder_name" character varying(20),
        "provider_name" character varying(50),
        "phone_number" character varying(20),
        "external_id" character varying(100),
        "external_provider" character varying(50),
        "metadata" json,
        "last_used_at" TIMESTAMP,
        "verified_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "merchant_id" uuid NOT NULL,
        CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_methods_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        "created_by" character varying(50) NOT NULL DEFAULT 'system',
        "updated_by" character varying(50) NOT NULL DEFAULT 'system',
        "reference" character varying(100) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "currency" "public"."payments_currency_enum" NOT NULL DEFAULT 'USD',
        "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
        "payment_type" "public"."payments_paymenttype_enum" NOT NULL DEFAULT 'payment',
        "gateway" "public"."payments_gateway_enum" NOT NULL DEFAULT 'internal',
        "description" character varying(255),
        "external_id" character varying(100),
        "gateway_reference" character varying(100),
        "gateway_response" json,
        "gateway_fee" numeric(10,2) NOT NULL DEFAULT '0',
        "platform_fee" numeric(10,2) NOT NULL DEFAULT '0',
        "net_amount" numeric(15,2),
        "customer_email" character varying(150),
        "customer_name" character varying(100),
        "customer_phone" character varying(20),
        "initiated_at" TIMESTAMP,
        "processed_at" TIMESTAMP,
        "completed_at" TIMESTAMP,
        "failed_at" TIMESTAMP,
        "expires_at" TIMESTAMP,
        "failure_code" character varying(100),
        "failure_reason" text,
        "metadata" json,
        "webhook_attempts" integer NOT NULL DEFAULT '0',
        "last_webhook_at" TIMESTAMP,
        "webhook_delivered" boolean NOT NULL DEFAULT false,
        "merchant_id" uuid NOT NULL,
        "payment_method_id" uuid,
        "parent_payment_id" uuid,
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payments_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_payments_payment_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_payments_parent" FOREIGN KEY ("parent_payment_id") REFERENCES "payments"("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_email" ON "merchants" ("email")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_business_id" ON "merchants" ("business_id") WHERE "business_id" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_methods_merchant_default" ON "payment_methods" ("merchant_id", "is_default")`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_methods_type_status" ON "payment_methods" ("type", "status")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payments_reference" ON "payments" ("reference")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_merchant_status" ON "payments" ("merchant_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status_created" ON "payments" ("status", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_gateway_external" ON "payments" ("gateway", "external_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_gateway_external"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_status_created"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_merchant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payments_reference"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_methods_type_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_methods_merchant_default"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_merchants_business_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_merchants_email"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "payment_methods"`);
    await queryRunner.query(`DROP TABLE "merchants"`);
    await queryRunner.query(`DROP TYPE "public"."payments_gateway_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_currency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_paymenttype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_methods_cardtype_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_methods_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_methods_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."merchants_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."merchants_merchanttype_enum"`);
  }
}
