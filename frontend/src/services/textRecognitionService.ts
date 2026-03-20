export type RecognizedTextResult = {
  text: string;
  blocks?: Array<{
    text: string;
  }>;
};

export async function recognizeTextFromImage(imagePath: string): Promise<RecognizedTextResult> {
  try {
    const module = require('@infinitered/react-native-mlkit-text-recognition') as {
      recognizeText?: (path: string) => Promise<RecognizedTextResult>;
    };

    if (typeof module.recognizeText !== 'function') {
      throw new Error('Modulo de OCR indisponivel.');
    }

    return await module.recognizeText(imagePath);
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : '';
    const isMissingNativeModule =
      !message ||
      /cannot find module|native module|unimplemented|not available|indisponivel/i.test(message);

    if (isMissingNativeModule) {
      throw new Error('OCR indisponivel no ambiente atual. Gere um development build apos instalar o ML Kit.');
    }

    throw error;
  }
}
