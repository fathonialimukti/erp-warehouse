/**
 * Validate required environment variables at boot.
 * Throws immediately if any are missing.
 */
export const validateEnv = () => {
  const required = ["JWT_SECRET", "DATABASE_URL"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
};
