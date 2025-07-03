// app/utils/crypto.client.ts

// --- Helper Functions ---

/**
 * 将ArrayBuffer转换为Base64字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * 将Base64字符串转换为ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}


/**
 * 导出CryptoKey为PEM格式的公钥字符串
 */
async function exportPublicKeyAsPem(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const exportedAsString = arrayBufferToBase64(exported);
  const pemExported = `-----BEGIN PUBLIC KEY-----\n${exportedAsString}\n-----END PUBLIC KEY-----`;
  return pemExported;
}

/**
 * 将PEM格式的公钥字符串导入为CryptoKey对象
 */
export async function importRsaPublicKey(pemKey: string): Promise<CryptoKey> {
  if (!pemKey || typeof pemKey !== 'string') {
    throw new Error("无效的公钥：公钥必须是一个非空的字符串。");
  }
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";
  const pemContents = pemKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
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
 * 从localStorage加载JWK格式的私钥并导入为CryptoKey对象
 */
async function getPrivateKey(): Promise<CryptoKey | null> {
    const jwk = localStorage.getItem("privateKey");
    if (!jwk) return null;
  
    try {
      const privateKeyJwk = JSON.parse(jwk);
      return await window.crypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
      );
    } catch (error) {
      console.error("Failed to load private key:", error);
      return null;
    }
}


// --- Public API ---

/**
 * 生成RSA密钥对，将私钥存储在localStorage中，并返回PEM格式的公钥。
 * @returns {Promise<string>} PEM格式的公钥
 */
export async function generateAndStoreKeys(): Promise<string> {
  // 1. 生成密钥对
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
      hash: "SHA-256",
    },
    true, // 可导出
    ["encrypt", "decrypt"]
  );

  // 2. 将私钥存储到localStorage (JWK格式)
  const privateKeyJwk = await window.crypto.subtle.exportKey("jwk", keyPair.privateKey);
  localStorage.setItem("privateKey", JSON.stringify(privateKeyJwk));

  // 3. 导出公钥为PEM格式并返回
  const publicKeyPem = await exportPublicKeyAsPem(keyPair.publicKey);
  return publicKeyPem;
}

/**
 * 使用对方的公钥加密消息
 * @param message 字符串消息
 * @param publicKeyPem 接收方的PEM格式公钥
 * @returns 加密后的Base64字符串
 */
export async function encryptMessage(text: string, publicKeyPem: string): Promise<string> {
    const publicKey = await importRsaPublicKey(publicKeyPem);
    const encodedMessage = new TextEncoder().encode(text);
    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      encodedMessage
    );
    return arrayBufferToBase64(encryptedBuffer);
}

/**
 * 使用自己的私钥解密消息
 * @param encryptedMessageBase64 Base64编码的加密消息
 * @returns 解密后的字符串
 */
export async function decryptMessage(encryptedMessageBase64: string): Promise<string> {
  try {
    const privateKey = await getPrivateKey();
    if (!privateKey) {
      throw new Error("无法加载私钥，解密失败");
    }
    const encryptedBuffer = base64ToArrayBuffer(encryptedMessageBase64);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedBuffer
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('解密失败:', error);
    return '无法解密此消息';
  }
}

/**
 * 使用混合加密来加密文件 (保留原有功能)
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

/**
 * [新增] 使用混合解密来解密文件。
 * 该函数是encryptFile的逆向操作，用于恢复加密文件。
 * @param encryptedFileBlob 包含初始化向量(IV)和加密内容的文件Blob。
 * @param encryptedKeyArrayBuffer 加密后的对称密钥，格式为ArrayBuffer。
 * @returns {Promise<Blob>} 返回一个包含解密后文件数据的Blob对象。
 */
export async function decryptFile(encryptedFileBlob: Blob, encryptedKeyArrayBuffer: ArrayBuffer): Promise<Blob> {
  // 步骤1：获取存储在本地的RSA私钥，用于解密对称密钥。
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    // 如果无法获取私钥，则抛出错误，终止解密过程。
    throw new Error("无法加载私钥，文件解密失败。");
  }

  // 步骤2：使用RSA私钥解密AES对称密钥。
  // 这是混合加密方案的关键步骤，用非对称加密来安全地传输对称密钥。
  const decryptedSymmetricKeyBuffer = await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKeyArrayBuffer
  );

  // 步骤3：将解密后的原始密钥数据导入为Web Crypto API可用的CryptoKey对象。
  // 这样我们就可以用它来执行AES解密操作。
  const symmetricKey = await window.crypto.subtle.importKey(
    "raw",
    decryptedSymmetricKeyBuffer,
    { name: "AES-GCM" }, // 指定算法为AES-GCM，与加密时保持一致。
    true, // 密钥可导出（虽然这里没用上，但通常设为true）。
    ["decrypt"] // 密钥用途声明为解密。
  );

  // 步骤4：从加密文件Blob中分离出IV和实际的加密数据。
  const encryptedFileBuffer = await encryptedFileBlob.arrayBuffer();
  const iv = encryptedFileBuffer.slice(0, 12); // 根据encryptFile的实现，IV是文件的前12个字节。
  const encryptedData = encryptedFileBuffer.slice(12); // 剩余部分是使用AES-GCM加密的文件内容。

  // 步骤5：使用AES对称密钥和IV来解密文件数据。
  const decryptedFileBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) }, // 提供与加密时相同的IV。
    symmetricKey, // 提供解密后的对称密钥。
    encryptedData // 提供要解密的加密数据。
  );

  // 步骤6：将解密后的ArrayBuffer数据包装成一个Blob对象并返回。
  // 这个Blob可以用于创建下载链接或在浏览器中显示。
  return new Blob([decryptedFileBuffer]);
}