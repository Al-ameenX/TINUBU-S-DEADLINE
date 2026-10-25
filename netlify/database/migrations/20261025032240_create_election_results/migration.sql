CREATE TABLE "election_results" (
	"id" text PRIMARY KEY,
	"state" text NOT NULL,
	"lga" text NOT NULL,
	"registered" integer NOT NULL,
	"accredited" integer NOT NULL,
	"rejected" integer NOT NULL,
	"votes" jsonb NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploader" text NOT NULL,
	"reviewer" text,
	"notes" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_reviews" (
	"id" serial PRIMARY KEY,
	"result_id" text NOT NULL,
	"version" integer NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"notes" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
