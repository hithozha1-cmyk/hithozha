const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = new Map<string, number>([...ALPHABET].map((char, index) => [char, index]));

/**
 * Turns base64 text into bytes. Written by hand so it works the same on the website and on phones,
 * and needs no Blob (phones can hand back an empty Blob for a local file).
 */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/^data:[^,]*,/, '').replace(/[\s=]+/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const char of clean) {
    const value = LOOKUP.get(char);
    if (value === undefined) throw new Error('invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = (buffer >> bits) & 0xff;
    }
  }
  return out.slice(0, written);
}
