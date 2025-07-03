// app/utils/crypto.client.ts

/**
 * 将PEM格式的公钥字符串导入为CryptoKey对象
 */
async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = pem.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    const binaryDer = window.atob(pemContents);
    const binaryDerArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryDerArray[i] = binaryDer.charCodeAt(i);
    }
    return window.crypto.subtle.importKey(
      "spki",
      binaryDerArray.buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );
  }
  
  /**
   * 使用混合加密来加密文件
   * @param file 要加密的文件
   * @param publicKeyPem 接收方的PEM格式公钥
   * @returns 加密后的数据和加密后的对称密钥
   */
  export async function encryptFile(file: File, publicKeyPem: string) {
    // 1. 生成一个随机的AES对称密钥
    const symmetricKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  
    // 2. 使用AES密钥加密文件内容
    const fileBuffer = await file.arrayBuffer();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 初始化向量
    const encryptedFileBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      symmetricKey,
      fileBuffer
    );
  
    // 3. 导入接收方的RSA公钥
    const rsaPublicKey = await importRsaPublicKey(publicKeyPem);
  
    // 4. 使用RSA公钥加密AES密钥
    const exportedSymmetricKey = await window.crypto.subtle.exportKey("raw", symmetricKey);
    const encryptedSymmetricKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      rsaPublicKey,
      exportedSymmetricKey
    );
  
    return {
      encryptedFile: new Blob([iv, new Uint8Array(encryptedFileBuffer)]), // 将iv和加密内容合并
      encryptedKey: new Blob([new Uint8Array(encryptedSymmetricKey)]),
    };
  }
  