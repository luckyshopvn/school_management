import { generateTokenKeyPair } from './common/token-keys.js';

// In hai dòng để chép vào tệp .env; khóa bí mật chỉ đặt ở dịch vụ định danh
const { privateKeyPem, publicKeyPem } = await generateTokenKeyPair();
console.log(`IDENTITY_TOKEN_PRIVATE_KEY=${Buffer.from(privateKeyPem).toString('base64')}`);
console.log(`TOKEN_PUBLIC_KEY=${Buffer.from(publicKeyPem).toString('base64')}`);
