declare namespace Cloudflare {
  interface Env {
    GOOGLE_ROUTES_API_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
