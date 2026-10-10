import { randomBytes } from 'node:crypto';

// In hai dòng để chép vào tệp .env: khóa mã hóa và khóa băm số định danh của trẻ (BM-64)
console.log(`CHILD_DATA_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`);
console.log(`CHILD_DATA_HASH_KEY=${randomBytes(32).toString('base64')}`);
