import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

// Sinh cặp khóa Ed25519 để ký mã phiên (QĐ-22)
export async function generateTokenKeyPair(): Promise<{ privateKeyPem: string; publicKeyPem: string }> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  return { privateKeyPem: await exportPKCS8(privateKey), publicKeyPem: await exportSPKI(publicKey) };
}
