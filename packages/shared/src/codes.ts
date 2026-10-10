// Short codes for plain-text replies (BR-CH-3): 5 characters, no 0, 1, I, L, O.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 5;
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Uniform random code from crypto.getRandomValues (rejection sampling, no modulo bias). */
export function newCode(
  rand: (n: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (n) => crypto.getRandomValues(n),
): string {
  let out = "";
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < CODE_LENGTH) {
    for (const b of rand(new Uint8Array(8))) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}
