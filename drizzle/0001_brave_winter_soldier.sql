CREATE TABLE IF NOT EXISTS "ai-app-template_user_request" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"request_type" varchar(255) DEFAULT 'chat' NOT NULL,
	"metadata" json
);
--> statement-breakpoint
DROP TABLE "ai-app-template_request";--> statement-breakpoint
ALTER TABLE "ai-app-template_message" DROP CONSTRAINT "ai-app-template_message_chat_id_ai-app-template_chat_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "chat_user_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "message_chat_id_idx";--> statement-breakpoint
ALTER TABLE "ai-app-template_chat" ALTER COLUMN "title" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "ai-app-template_chat" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "order" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "parts" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai-app-template_message" ALTER COLUMN "role" SET DATA TYPE varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_user_request" ADD CONSTRAINT "ai-app-template_user_request_user_id_ai-app-template_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."ai-app-template_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ai-app-template_message" ADD CONSTRAINT "ai-app-template_message_chat_id_ai-app-template_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."ai-app-template_chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "ai-app-template_message" DROP COLUMN IF EXISTS "content";