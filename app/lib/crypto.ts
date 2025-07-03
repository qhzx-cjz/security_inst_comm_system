import CryptoJS from 'crypto-js';

// 警告：在生产环境中，切勿硬编码密钥。
// 应该使用安全的方式来生成、存储和交换密钥。
const SECRET_KEY = 'your-super-secret-key-that-is-long-and-random';

/**
 * 使用 AES 加密文本
 * @param text 要加密的明文
 * @returns 加密后的文本 (Base64 编码)
 */
export function encryptMessage(text: string): string {
  const ciphertext = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
  return ciphertext;
}

/**
 * 使用 AES 解密文本
 * @param ciphertextBase64 要解密的密文 (Base64 编码)
 * @returns 解密后的明文
 */
export function decryptMessage(ciphertextBase64: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertextBase64, SECRET_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    if (!originalText) {
      console.error('Decryption failed: resulted in empty string.');
      return '无法解密此消息'; // 或者返回一个错误提示
    }
    return originalText;
  } catch (error) {
    console.error('Decryption error:', error);
    return '解密失败'; // 返回一个错误提示
  }
}
