import { openCredentials, sealCredentials, credentialsConfigured } from "@/server/security/credentials-crypto";

export { credentialsConfigured, sealCredentials };

export async function loadSupplierCredentials(credentialsJson: string): Promise<Record<string, unknown>> {
  try {
    return await openCredentials(credentialsJson);
  } catch {
    throw new Error("SUPPLIER_CREDENTIALS_INVALID");
  }
}
