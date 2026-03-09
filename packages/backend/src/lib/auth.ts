import { SignJWT, jwtVerify } from "jose";
import type { AppEnv } from "../env";

const encoder = new TextEncoder();

function getJwtSecretBytes(env: AppEnv) {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET is missing or empty in backend environment.");
  }
  return encoder.encode(secret);
}

export async function signAccessToken(env: AppEnv, payload: { sub: string; role: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretBytes(env));
}

export async function verifyAccessToken(env: AppEnv, token: string) {
  const { payload } = await jwtVerify(token, getJwtSecretBytes(env));
  return payload;
}
