declare module 'jsqr' {
  interface QRCode {
    data: string;
    version: number;
    location: any;
  }
  interface Options { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst'; }
  function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: Options): QRCode | null;
  export default jsQR;
}
