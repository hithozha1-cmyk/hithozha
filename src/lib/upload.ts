import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type UploadKind = 'avatar' | 'portfolio' | 'company_logo';

export type PickResult =
  | { status: 'ok'; url: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

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

  try {
    const asset = picked.assets[0];
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    if (asset.width > config.maxDimension || asset.height > config.maxDimension) {
      context.resize(asset.width >= asset.height ? { width: config.maxDimension } : { height: config.maxDimension });
    }
    const rendered = await context.renderAsync();
    const compressed = await rendered.saveAsync({ format: config.format, compress: 0.8 });

    const blob = await (await fetch(compressed.uri)).blob();

    const { data, error } = await supabase.functions.invoke<PresignResponse>('r2-presign', {
      body: { kind, contentType: config.contentType, size: blob.size },
    });
    if (error || !data) return { status: 'error' };

    const put = await fetch(data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': config.contentType },
      body: blob,
    });
    if (!put.ok) return { status: 'error' };

    return { status: 'ok', url: data.publicUrl };
  } catch {
    return { status: 'error' };
  }
}
