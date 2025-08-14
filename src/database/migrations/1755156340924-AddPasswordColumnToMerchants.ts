import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPasswordColumnToMerchants1755156340924 implements MigrationInterface {
    name = 'AddPasswordColumnToMerchants1755156340924'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_payment_methods_merchant"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_merchant"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_payment_method"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_parent"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_methods_merchant_default"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payment_methods_type_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merchants_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_merchants_business_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_reference"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_merchant_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_status_created"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_gateway_external"`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD "password" character varying(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "created_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "updated_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TYPE "public"."payment_methods_cardtype_enum" RENAME TO "payment_methods_cardtype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_methods_card_type_enum" AS ENUM('visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners')`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "card_type" TYPE "public"."payment_methods_card_type_enum" USING "card_type"::"text"::"public"."payment_methods_card_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payment_methods_cardtype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "created_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "updated_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "UQ_7682193bcf281285d0a459c4b1e" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TABLE "merchants" ADD CONSTRAINT "UQ_6ae69198789779faf7368dfcd1e" UNIQUE ("business_id")`);
        await queryRunner.query(`ALTER TYPE "public"."merchants_merchanttype_enum" RENAME TO "merchants_merchanttype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."merchants_merchant_type_enum" AS ENUM('individual', 'business', 'enterprise')`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" TYPE "public"."merchants_merchant_type_enum" USING "merchant_type"::"text"::"public"."merchants_merchant_type_enum"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" SET DEFAULT 'individual'`);
        await queryRunner.query(`DROP TYPE "public"."merchants_merchanttype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "created_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "updated_at" SET DEFAULT ('now'::text)::timestamp(6) with time zone`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "UQ_866ddee0e17d9385b4e3b86851d" UNIQUE ("reference")`);
        await queryRunner.query(`ALTER TYPE "public"."payments_paymenttype_enum" RENAME TO "payments_paymenttype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."payments_payment_type_enum" AS ENUM('payment', 'refund', 'chargeback', 'adjustment')`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" TYPE "public"."payments_payment_type_enum" USING "payment_type"::"text"::"public"."payments_payment_type_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" SET DEFAULT 'payment'`);
        await queryRunner.query(`DROP TYPE "public"."payments_paymenttype_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_c157a7f9d43f7dbce42d0313e6" ON "payment_methods" ("type", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_aaca1462f0d18dafffb5ecc872" ON "payment_methods" ("merchant_id", "is_default") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_63f8ea073901f05aa63efd7470" ON "merchants" ("business_id") WHERE business_id IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7682193bcf281285d0a459c4b1" ON "merchants" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_29357857e952377bb9235a592a" ON "payments" ("gateway", "external_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_58620d2791557a4d0f44e87744" ON "payments" ("status", "created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3fe054c32b5c59fa6a95deb86" ON "payments" ("merchant_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_866ddee0e17d9385b4e3b86851" ON "payments" ("reference") `);
        await queryRunner.query(`ALTER TABLE "payment_methods" ADD CONSTRAINT "FK_1587438684caed519da64364541" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_c4a9a77d8ec9c37d3654a0d2ebc" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_12fd861c33c885f01b9a7da7d93" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_4691059fc188678be1599a138e9" FOREIGN KEY ("parent_payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_4691059fc188678be1599a138e9"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_12fd861c33c885f01b9a7da7d93"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_c4a9a77d8ec9c37d3654a0d2ebc"`);
        await queryRunner.query(`ALTER TABLE "payment_methods" DROP CONSTRAINT "FK_1587438684caed519da64364541"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_866ddee0e17d9385b4e3b86851"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3fe054c32b5c59fa6a95deb86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_58620d2791557a4d0f44e87744"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_29357857e952377bb9235a592a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7682193bcf281285d0a459c4b1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63f8ea073901f05aa63efd7470"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aaca1462f0d18dafffb5ecc872"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c157a7f9d43f7dbce42d0313e6"`);
        await queryRunner.query(`CREATE TYPE "public"."payments_paymenttype_enum_old" AS ENUM('payment', 'refund', 'chargeback', 'adjustment')`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" TYPE "public"."payments_paymenttype_enum_old" USING "payment_type"::"text"::"public"."payments_paymenttype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_type" SET DEFAULT 'payment'`);
        await queryRunner.query(`DROP TYPE "public"."payments_payment_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payments_paymenttype_enum_old" RENAME TO "payments_paymenttype_enum"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "UQ_866ddee0e17d9385b4e3b86851d"`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`CREATE TYPE "public"."merchants_merchanttype_enum_old" AS ENUM('individual', 'business', 'enterprise')`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" TYPE "public"."merchants_merchanttype_enum_old" USING "merchant_type"::"text"::"public"."merchants_merchanttype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "merchant_type" SET DEFAULT 'individual'`);
        await queryRunner.query(`DROP TYPE "public"."merchants_merchant_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."merchants_merchanttype_enum_old" RENAME TO "merchants_merchanttype_enum"`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "UQ_6ae69198789779faf7368dfcd1e"`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP CONSTRAINT "UQ_7682193bcf281285d0a459c4b1e"`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "merchants" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`CREATE TYPE "public"."payment_methods_cardtype_enum_old" AS ENUM('visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners')`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "card_type" TYPE "public"."payment_methods_cardtype_enum_old" USING "card_type"::"text"::"public"."payment_methods_cardtype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."payment_methods_card_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."payment_methods_cardtype_enum_old" RENAME TO "payment_methods_cardtype_enum"`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "updated_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ALTER COLUMN "created_at" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "password"`);
        await queryRunner.query(`CREATE INDEX "IDX_payments_gateway_external" ON "payments" ("external_id", "gateway") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_status_created" ON "payments" ("created_at", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_merchant_status" ON "payments" ("merchant_id", "status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_payments_reference" ON "payments" ("reference") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_business_id" ON "merchants" ("business_id") WHERE (business_id IS NOT NULL)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_merchants_email" ON "merchants" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_methods_type_status" ON "payment_methods" ("status", "type") `);
        await queryRunner.query(`CREATE INDEX "IDX_payment_methods_merchant_default" ON "payment_methods" ("is_default", "merchant_id") `);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_parent" FOREIGN KEY ("parent_payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_payment_method" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payment_methods" ADD CONSTRAINT "FK_payment_methods_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
