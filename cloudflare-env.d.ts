declare namespace Cloudflare {
  interface Env {
    GOOGLE_ROUTES_API_KEY?: string;
    APP_ORIGIN?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    RESEND_API_KEY?: string;
    RECOVERY_FROM_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
