// Minimal type declarations for the Shape Detection API BarcodeDetector,
// which is not part of the default TypeScript DOM lib.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorResultLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  static getSupportedFormats(): Promise<string[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
