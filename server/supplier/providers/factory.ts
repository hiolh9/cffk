import {
  acgCredentialsSchema,
  dujiaoNextCredentialsSchema,
  moogoldCredentialsSchema,
  normalizeLegacyProtocolVersion,
  type SupplierProvider,
} from "../schema";
import { loadSupplierCredentials } from "../credentials";
import { AcgAdapter } from "./acg";
import { AcgV311Adapter } from "./acg-v3.1.1";
import { DujiaoNextAdapter } from "./dujiao-next";
import { MoogoldAdapter } from "./moogold";
import type { SupplierAdapter } from "./types";

export function createSupplierAdapter(input: {
  provider: SupplierProvider;
  protocolVersion: string;
  baseUrl: string;
  credentials: unknown;
  currency: string;
  currencyDecimals: number;
  fetcher?: typeof fetch;
  now?: () => number;
}): SupplierAdapter {
  if (input.provider === "acg") {
    const credentials = acgCredentialsSchema.parse(input.credentials);
    if (input.protocolVersion === "acg_v3.1.2_plus") return new AcgAdapter({ ...input, ...credentials });
    if (input.protocolVersion === "acg_v3.1.1") return new AcgV311Adapter({ ...input, ...credentials });
    throw new Error("supplier_protocol_version_invalid");
  }
  if (input.provider === "moogold") {
    if (input.protocolVersion !== "moogold_v1") throw new Error("supplier_protocol_version_invalid");
    const credentials = moogoldCredentialsSchema.parse(input.credentials);
    return new MoogoldAdapter({
      ...input,
      baseUrl: input.baseUrl || "https://moogold.com",
      partnerId: credentials.partnerId,
      secretKey: credentials.secretKey,
      categoryIds: credentials.categoryIds,
    });
  }
  if (input.protocolVersion !== "dujiao_next_v1") throw new Error("supplier_protocol_version_invalid");
  const credentials = dujiaoNextCredentialsSchema.parse(input.credentials);
  return new DujiaoNextAdapter({ ...input, ...credentials });
}

/** Build adapter from a DB account row (handles encrypted credentials at rest). */
export async function createSupplierAdapterFromAccount(account: {
  provider: SupplierProvider;
  protocolVersion: string;
  baseUrl: string;
  credentialsJson: string;
  currency: string;
  currencyDecimals: number;
}, options?: { fetcher?: typeof fetch; now?: () => number }) {
  return createSupplierAdapter({
    provider: account.provider,
    protocolVersion: normalizeLegacyProtocolVersion(account.provider, account.protocolVersion),
    baseUrl: account.baseUrl,
    credentials: await loadSupplierCredentials(account.credentialsJson),
    currency: account.currency,
    currencyDecimals: account.currencyDecimals,
    fetcher: options?.fetcher,
    now: options?.now,
  });
}
