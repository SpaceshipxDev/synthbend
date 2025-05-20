// utils.ts

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { type Blob } from '@google/genai'; // 'type' ensures it's a type-only import

/**
 * Encodes a Uint8Array into a base64 string.
 */
export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string into a Uint8Array.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates a Blob object for audio data, typically for sending to an API.
 * This function is exported but not directly used by the main app.ts you provided.
 */
export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // convert float32 -1 to 1 to int16 -32768 to 32767
    int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768)); // Clamp to int16 range
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000', // Note: sample rate is 16kHz here
  };
}

/**
 * Decodes raw PCM audio data (Uint8Array) into an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number, // app.ts passes 48000
  numChannels: number,  // app.ts passes 2
): Promise<AudioBuffer> {
  // Calculate frameCount. If numChannels is 0 or 1, it's straightforward.
  // The original code's (data.length / 2 / numChannels) would fail if numChannels is 0.
  // Assuming numChannels will be at least 1 if audio data exists.
  if (numChannels <= 0) {
    console.warn('decodeAudioData: numChannels is 0 or negative, defaulting to 1 channel.');
    numChannels = 1;
  }
  const bytesPerSample = 2; // Data is Int16
  const frameCount = data.length / bytesPerSample / numChannels;

  const buffer = ctx.createBuffer(
    numChannels,
    frameCount,
    sampleRate,
  );

  // Create an Int16Array view of the Uint8Array's buffer.
  // Important: Use data.byteOffset and data.length to correctly map the view
  // if `data` is a Uint8Array view over a larger ArrayBuffer.
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.length / bytesPerSample);

  // Convert Int16 data to Float32 data (range -1.0 to 1.0)
  const dataFloat32 = new Float32Array(dataInt16.length);
  for (let i = 0; i < dataInt16.length; i++) {
    dataFloat32[i] = dataInt16[i] / 32768.0;
  }

  // De-interleave channels if necessary
  if (numChannels === 1) {
    buffer.copyToChannel(dataFloat32, 0);
  } else {
    for (let i = 0; i < numChannels; i++) {
      const channelData = new Float32Array(frameCount);
      for (let j = 0; j < frameCount; j++) {
        channelData[j] = dataFloat32[j * numChannels + i];
      }
      buffer.copyToChannel(channelData, i);
    }
  }
  return buffer;
}
