import crypto from "node:crypto";
import { readLocalEnvValue } from "@/lib/server/local-env";

const defaultTokenDomain = "nls-meta.cn-shanghai.aliyuncs.com";
const defaultTokenVersion = "2019-02-28";
const tokenRefreshBufferSeconds = 120;

interface CachedToken {
  id: string;
  expireTime: number;
}

let cachedToken: CachedToken | null = null;

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function getAliyunAccessKeyId() {
  return readLocalEnvValue("ALIYUN_ACCESS_KEY_ID") || readLocalEnvValue("ALIBABA_CLOUD_ACCESS_KEY_ID");
}

function getAliyunAccessKeySecret() {
  return readLocalEnvValue("ALIYUN_ACCESS_KEY_SECRET") || readLocalEnvValue("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
}

function getStaticToken() {
  return readLocalEnvValue("ALIYUN_NLS_TOKEN");
}

function getTokenDomain() {
  return readLocalEnvValue("ALIYUN_NLS_TOKEN_DOMAIN") || defaultTokenDomain;
}

function buildSignedQuery(params: Record<string, string>, accessKeySecret: string) {
  const canonicalizedQueryString = Object.entries(params)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");

  const stringToSign = `GET&%2F&${percentEncode(canonicalizedQueryString)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  return `${canonicalizedQueryString}&Signature=${percentEncode(signature)}`;
}

function isCachedTokenValid(token: CachedToken | null) {
  if (!token) {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return token.expireTime - tokenRefreshBufferSeconds > now;
}

export function hasAliyunNlsDynamicTokenConfig() {
  return Boolean(getAliyunAccessKeyId() && getAliyunAccessKeySecret());
}

export function hasAliyunNlsTokenConfig() {
  return Boolean(getStaticToken() || hasAliyunNlsDynamicTokenConfig());
}

export async function resolveAliyunNlsToken() {
  const staticToken = getStaticToken();
  if (staticToken) {
    return staticToken;
  }

  const tokenInCache = cachedToken;
  if (tokenInCache && isCachedTokenValid(tokenInCache)) {
    return tokenInCache.id;
  }

  const accessKeyId = getAliyunAccessKeyId();
  const accessKeySecret = getAliyunAccessKeySecret();

  if (!accessKeyId || !accessKeySecret) {
    throw new Error("aliyun nls token is not configured");
  }

  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "CreateToken",
    Format: "JSON",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString(),
    Version: defaultTokenVersion,
  };

  const query = buildSignedQuery(params, accessKeySecret);
  const response = await fetch(`https://${getTokenDomain()}/?${query}`, {
    method: "GET",
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | {
        ErrCode?: number;
        ErrMsg?: string;
        Token?: {
          Id?: string;
          ExpireTime?: number;
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(data?.ErrMsg || `aliyun nls token http_${response.status}`);
  }

  const tokenId = data?.Token?.Id?.trim();
  const expireTime = data?.Token?.ExpireTime;

  if (!tokenId || !expireTime) {
    throw new Error(data?.ErrMsg || "aliyun nls token response is invalid");
  }

  cachedToken = {
    id: tokenId,
    expireTime,
  };

  return tokenId;
}
