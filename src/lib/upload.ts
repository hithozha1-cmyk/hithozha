import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { base64ToBytes } from '@/lib/base64';
import { supabase } from '@/lib/supabase';

export type UploadKind = 'avatar' | 'portfolio' | 'company_logo';

export type PickResult =
  | { status: 'ok'; url: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  /** `reason` is a short code naming the step that failed, so a problem can be traced. */
  | { status: 'error'; reason: string };

/** The message plus the short reason, e.g. "We could not upload the photo (upload 403)". */
export const failedWith = (message: string, result: { reason: string }): string => `${message} (${result.reason})`;

type KindConfig = {
  maxDimension: number;
  format: ImageManipulator.SaveFormat;
  contentType: 'image/jpeg' | 'image/png';
  square: boolean;
};

const CONFIG: Record<UploadKind, KindConfig> = {
  avatar: { maxDimension: 800, format: ImageManipulator.SaveFormat.JPEG, contentType: 'image/jpeg', square: true },
  portfolio: { maxDimension: 800, format: ImageManipulator.SaveFormat.JPEG, contentType: 'image/jpeg', square: false },
  // Logos stay PNG so transparent backgrounds survive.
  company_logo: { maxDimension: 400, format: ImageManipulator.SaveFormat.PNG, contentType: 'image/png', square: true },
};

type PresignResponse = { uploadUrl: string; publicUrl: string };

const shorten = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 48);

/** Shrinks a picked image and returns its bytes (no Blob involved, so it behaves the same on phones and the web). */
export async function shrinkToBytes(
  asset: { uri: string; width: number; height: number },
  maxDimension: number,
  format: ImageManipulator.SaveFormat,
  quality = 0.8,
): Promise<Uint8Array> {
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > maxDimension || asset.height > maxDimension) {
    context.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format, compress: quality, base64: true });
  if (!saved.base64) throw new Error('no image data');
  return base64ToBytes(saved.base64);
}

/**
 * Pick an image, shrink it, then upload it to R2 through a presigned URL
 * issued by the r2-presign Edge Function.
 */
export async function pickAndUploadImage(kind: UploadKind): Promise<PickResult> {
  const config = CONFIG[kind];

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: config.square,
    aspect: config.square ? [1, 1] : undefined,
    quality: 1,
  });
  if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

  let bytes: Uint8Array;
  try {
    bytes = await shrinkToBytes(picked.assets[0], config.maxDimension, config.format);
  } catch (error) {
    return { status: 'error', reason: `prepare: ${shorten(error)}` };
  }

  const { data, error } = await supabase.functions.invoke<PresignResponse>('r2-presign', {
    body: { kind, contentType: config.contentType, size: bytes.length },
  });
  if (error || !data) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    return { status: 'error', reason: `presign ${status ?? error?.name ?? 'failed'}` };
  }

  try {
    const put = await fetch(data.uploadUrl, { method: 'PUT', headers: { "Content-Type": config.contentType }, body: bytes.buffer as ArrayBuffer });
    if (!put.ok) return { status: 'error', reason: `upload ${put.status}` };
  } catch (putError) {
    return { status: 'error', reason: `upload: ${shorten(putError)}` };
  }

  return { status: 'ok', url: data.publicUrl };
}
