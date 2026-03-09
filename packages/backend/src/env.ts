export interface AppEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  POSTHOG_API_KEY?: string;
  POSTHOG_HOST?: string;
  LMS_UPLOADS: R2Bucket;
  LMS_QUEUE: Queue;
}
