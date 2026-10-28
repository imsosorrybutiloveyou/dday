
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON environment variable is missing.");

  const parsed = JSON.parse(raw);
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount())
  });
}

export async function requireUser(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Authentication required.");
    error.statusCode = 401;
    throw error;
  }
  try {
    return await getAuth().verifyIdToken(match[1]);
  } catch {
    const error = new Error("Invalid login token.");
    error.statusCode = 401;
    throw error;
  }
}
