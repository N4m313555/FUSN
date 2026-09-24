/* 解開有密碼嘅 Office 檔案（ECMA-376 Agile Encryption，即 Excel 2010 以後嘅「以密碼加密」）。
 * 純瀏覽器實作：用 SheetJS 嘅 CFB 解析器讀容器，WebCrypto 做 SHA-512／AES-CBC。
 * 用法：const buf = await OfficeDecrypt.decrypt(arrayBuffer, password, XLSX.CFB); // 回傳解密後嘅 xlsx ArrayBuffer
 * 只支援 Agile（AES + SHA-1/256/384/512）；舊式 Standard 加密會拋錯。
 */
(function (root) {
  'use strict';
  const subtle = (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);
  const te = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); b[i * 2] = c & 255; b[i * 2 + 1] = c >> 8; } return b; };
  const b64 = (s) => { const bin = (typeof atob === 'function') ? atob(s) : Buffer.from(s, 'base64').toString('binary'); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const cat = (...arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0); const out = new Uint8Array(n); let o = 0; arrs.forEach((x) => { out.set(x, o); o += x.length; }); return out; };
  const u32le = (n) => new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
  const HASH = { 'SHA1': 'SHA-1', 'SHA-1': 'SHA-1', 'SHA256': 'SHA-256', 'SHA-256': 'SHA-256', 'SHA384': 'SHA-384', 'SHA-384': 'SHA-384', 'SHA512': 'SHA-512', 'SHA-512': 'SHA-512' };
  const digest = async (alg, data) => new Uint8Array(await subtle.digest(alg, data));
  // WebCrypto AES-CBC 一定會剝 PKCS#7 padding；加密資料本身冇 padding，所以補一個「假 padding block」畀佢剝。
  async function aesCbcDecryptNoPad(keyBytes, iv, data) {
    const key = await subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    const lastBlock = data.slice(data.length - 16);
    const padBlock = new Uint8Array(16).fill(16);
    const encPad = new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv: lastBlock }, key, padBlock)).slice(0, 16);
    const plain = await subtle.decrypt({ name: 'AES-CBC', iv }, key, cat(data, encPad));
    return new Uint8Array(plain);
  }
  function attrs(xml, tag) { const m = xml.match(new RegExp('<(?:[a-zA-Z]+:)?' + tag + '\\b([^>]*)/?>')); if (!m) return null; const o = {}; m[1].replace(/([a-zA-Z]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; return ''; }); return o; }
  // 密碼雜湊迴圈（spinCount 次，通常 100000）只計一次，三個 block key 共用
  async function spunHash(pw, salt, hashAlg, spin, onProgress) {
    let h = await digest(hashAlg, cat(salt, te(pw)));
    for (let i = 0; i < spin; i++) { h = await digest(hashAlg, cat(u32le(i), h)); if (onProgress && (i & 8191) === 0) onProgress(i / spin); }
    return h;
  }
  async function blockKeyFrom(h, hashAlg, blockKey, keyBytes) {
    const k = await digest(hashAlg, cat(h, blockKey));
    const out = new Uint8Array(keyBytes); out.set(k.slice(0, keyBytes)); if (k.length < keyBytes) out.fill(0x36, k.length); return out;
  }
  async function decrypt(arrayBuffer, password, CFB, onProgress) {
    if (!subtle) throw new Error('呢個瀏覽器唔支援 WebCrypto');
    const cfb = CFB.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const find = (name) => { const e = CFB.find(cfb, name) || CFB.find(cfb, '/' + name); if (!e) throw new Error('唔係加密 Office 檔案（搵唔到 ' + name + '）'); return new Uint8Array(e.content); };
    const info = find('EncryptionInfo'); const pkg = find('EncryptedPackage');
    const vMajor = info[0] | (info[1] << 8), vMinor = info[2] | (info[3] << 8);
    if (!(vMajor === 4 && vMinor === 4)) throw new Error('只支援 Agile 加密（Excel 2010 以後）；呢個檔案係舊式加密，請用 Excel 另存一次');
    const xml = new TextDecoder('utf-8').decode(info.slice(8));
    const kd = attrs(xml, 'keyData'); const ek = attrs(xml, 'encryptedKey');
    if (!kd || !ek) throw new Error('讀唔到加密資料');
    if (!/AES/i.test(ek.cipherAlgorithm) || !/CBC/i.test(ek.cipherChaining)) throw new Error('唔支援嘅加密方式：' + ek.cipherAlgorithm + ' ' + ek.cipherChaining);
    const hAlg = HASH[ek.hashAlgorithm], spin = Number(ek.spinCount), salt = b64(ek.saltValue), keyBytes = Number(ek.keyBits) / 8;
    if (!hAlg) throw new Error('唔支援嘅雜湊：' + ek.hashAlgorithm);
    const BK_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
    const BK_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
    const BK_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);
    // 密碼核對
    const h = await spunHash(password, salt, hAlg, spin, onProgress);
    const kIn = await blockKeyFrom(h, hAlg, BK_INPUT, keyBytes);
    const vIn = await aesCbcDecryptNoPad(kIn, salt, b64(ek.encryptedVerifierHashInput));
    const kVal = await blockKeyFrom(h, hAlg, BK_VALUE, keyBytes);
    const vVal = await aesCbcDecryptNoPad(kVal, salt, b64(ek.encryptedVerifierHashValue));
    const hIn = await digest(hAlg, vIn.slice(0, Number(ek.saltSize)));
    const hs = Number(ek.hashSize);
    for (let i = 0; i < hs; i++) if (hIn[i] !== vVal[i]) throw new Error('密碼唔啱');
    // 攞真正嘅檔案密鑰
    const kKey = await blockKeyFrom(h, hAlg, BK_KEY, keyBytes);
    const secret = (await aesCbcDecryptNoPad(kKey, salt, b64(ek.encryptedKeyValue))).slice(0, Number(kd.keyBits) / 8);
    // 逐 4096 bytes 段解密
    const kdHash = HASH[kd.hashAlgorithm]; const kdSalt = b64(kd.saltValue); const blockSize = Number(kd.blockSize);
    const total = Number(pkg[0] | (pkg[1] << 8) | (pkg[2] << 16)) + (pkg[3] >>> 0) * 16777216 + (pkg[4] + pkg[5] * 256 + pkg[6] * 65536 + pkg[7] * 16777216) * 4294967296;
    const body = pkg.slice(8); const out = new Uint8Array(total); const SEG = 4096; let pos = 0;
    for (let i = 0; pos < total; i++) {
      const iv = (await digest(kdHash, cat(kdSalt, u32le(i)))).slice(0, blockSize);
      const chunk = body.slice(i * SEG, Math.min((i + 1) * SEG, body.length));
      const plain = await aesCbcDecryptNoPad(secret, iv, chunk);
      const n = Math.min(plain.length, total - pos); out.set(plain.slice(0, n), pos); pos += n;
    }
    return out.buffer;
  }
  const api = { decrypt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.OfficeDecrypt = api;
})(typeof window !== 'undefined' ? window : globalThis);
