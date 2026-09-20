declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OWNER_EMAIL?: string;
    OWNER_NAME?: string;
    OWNER_PASSWORD?: string;
    OWNER_USER_ID?: string;
    SESSION_SECRET?: string;
    MIGRATION_TOKEN?: string;
  }
}
