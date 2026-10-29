import { createHmac, timingSafeEqual } from 'node:crypto';

// Mã liên kết hồ sơ con ở chợ với trường (DT-27 phần 27f, YCTD-256; tài liệu 47 mục 19.5 "liên kết với trường"). Cha mẹ đăng nhập ở
// ứng dụng phụ huynh của trường, chọn con, đồng ý; máy chủ API (trong ngữ cảnh trường) ký mã gồm mã trường, mã học sinh dạng băm, cấp,
// lớp, hạn 10 phút bằng MARKET_LINK_SECRET. Cha mẹ dán mã ở chợ; chợ kiểm chữ ký và hạn rồi chỉ giữ ba giá trị đó. Chợ không gọi vào
// trường, không đọc cơ sở dữ liệu của trường
export const MARKET_LINK_LIFETIME_MS = 10 * 60 * 1000;

export interface MarketLinkClaims {
  schoolCode: string;
  studentHash: string;
  schoolLevel: 'TH' | 'THCS' | 'THPT';
  grade: number;
  expiresAt: number;
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(`market-link:${payload}`).digest('base64url');
}

export function signMarketLinkCode(secret: string, claims: MarketLinkClaims): string {
  const payload = Buffer.from(
    JSON.stringify({
      s: claims.schoolCode,
      h: claims.studentHash,
      l: claims.schoolLevel,
      g: claims.grade,
      e: claims.expiresAt,
    }),
  ).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

// Mã sai chữ ký, sai dạng hoặc hết hạn trả null
export function verifyMarketLinkCode(secret: string, code: string, now: Date): MarketLinkClaims | null {
  const [payload, signature] = code.trim().split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  const level = raw.l;
  if (
    typeof raw.s !== 'string' ||
    typeof raw.h !== 'string' ||
    (level !== 'TH' && level !== 'THCS' && level !== 'THPT') ||
    typeof raw.g !== 'number' ||
    !Number.isInteger(raw.g) ||
    raw.g < 1 ||
    raw.g > 12 ||
    typeof raw.e !== 'number' ||
    raw.e <= now.getTime()
  ) {
    return null;
  }
  return { schoolCode: raw.s, studentHash: raw.h, schoolLevel: level, grade: raw.g, expiresAt: raw.e };
}
