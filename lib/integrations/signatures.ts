import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

function digest(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload, "utf8").digest();
}

export function signPayload(payload: string, secret: string): string {
  return `${SIGNATURE_PREFIX}${digest(payload, secret).toString("hex")}`;
}

export function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature?.startsWith(SIGNATURE_PREFIX) || !secret) return false;

  const suppliedHex = signature.slice(SIGNATURE_PREFIX.length);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;

  const expected = digest(payload, secret);
  const supplied = Buffer.from(suppliedHex, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function isFreshTimestamp(
  timestamp: string,
  toleranceSeconds = 300
): boolean {
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - seconds) <= toleranceSeconds;
}

export function safeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
