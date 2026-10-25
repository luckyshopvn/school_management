import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exportPKCS8, exportSPKI, generateKeyPair, SignJWT } from 'jose';
import { AccessTokenVerifier, TOKEN_AUDIENCE, TOKEN_ISSUER, TOKEN_SIGNING_ALGORITHM } from './access-token.js';

// Xoay khóa ký mã phiên (DT-SaaS phần S8b, YCTD-201): bên kiểm tra nhận cả khóa mới và khóa cũ trong thời gian xoay
async function keyPair() {
  const { publicKey, privateKey } = await generateKeyPair(TOKEN_SIGNING_ALGORITHM, { extractable: true });
  return { publicPem: await exportSPKI(publicKey), privateKey, privatePem: await exportPKCS8(privateKey) };
}

async function sign(privateKey: Awaited<ReturnType<typeof keyPair>>['privateKey'], now: Date) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sid: 'phien-1', channel: 'portal' })
    .setProtectedHeader({ alg: TOKEN_SIGNING_ALGORITHM })
    .setSubject('nguoi-dung-1')
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 900)
    .sign(privateKey);
}

describe('xoay khóa ký mã phiên', () => {
  it('nhận mã ký bằng khóa cũ khi còn khai khóa cũ, từ chối khi đã gỡ', async () => {
    const now = new Date();
    const oldPair = await keyPair();
    const newPair = await keyPair();
    const oldToken = await sign(oldPair.privateKey, now);
    const newToken = await sign(newPair.privateKey, now);

    const rotating = new AccessTokenVerifier(newPair.publicPem, oldPair.publicPem);
    assert.equal((await rotating.verify(oldToken, now)).userId, 'nguoi-dung-1');
    assert.equal((await rotating.verify(newToken, now)).userId, 'nguoi-dung-1');

    const finished = new AccessTokenVerifier(newPair.publicPem);
    assert.equal((await finished.verify(newToken, now)).sessionId, 'phien-1');
    await assert.rejects(() => finished.verify(oldToken, now), /Phiên đăng nhập/);
  });

  it('khóa lạ không được nhận, mã hết hạn bị từ chối', async () => {
    const now = new Date();
    const known = await keyPair();
    const stranger = await keyPair();
    const verifier = new AccessTokenVerifier(known.publicPem, known.publicPem);
    const foreign = await sign(stranger.privateKey, now);
    await assert.rejects(() => verifier.verify(foreign, now));
    const token = await sign(known.privateKey, now);
    await assert.rejects(() => verifier.verify(token, new Date(now.getTime() + 20 * 60_000)));
  });
});
