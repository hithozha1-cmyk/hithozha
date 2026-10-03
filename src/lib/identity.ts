import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export const ID_TYPES = ['aadhaar', 'pan', 'voter', 'driving_licence', 'passport'] as const;
export type IdType = (typeof ID_TYPES)[number];

export type IdentityCheck = {
  id: string;
  id_type: IdType;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  files_deleted_at: string | null;
};

export type PhotoKind = 'id' | 'selfie';
export type PhotoResult = { status: 'ok'; path: string } | { status: 'cancelled' } | { status: 'denied' } | { status: 'error' };

const MAX_SIDE = 1600;

/**
 * Pick (or take) a photo, shrink it, and upload it to the PRIVATE identity bucket in the
 * person's own folder. Nobody but an admin can read it back, and admins delete it after review.
 */
export async function pickIdentityPhoto(kind: PhotoKind, userId: string): Promise<PhotoResult> {
  const selfie = kind === 'selfie';
  const permission = selfie ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const picked = selfie
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], cameraType: ImagePicker.CameraType.front, quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

  try {
    const asset = picked.assets[0];
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    if (asset.width > MAX_SIDE || asset.height > MAX_SIDE) {
      context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const rendered = await context.renderAsync();
    const compressed = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
    const blob = await (await fetch(compressed.uri)).blob();

    const path = `${userId}/${Date.now()}-${kind}.jpg`;
    const { error } = await supabase.storage.from('identity').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    return error ? { status: 'error' } : { status: 'ok', path };
  } catch {
    return { status: 'error' };
  }
}

export async function submitIdentity(idType: IdType, idPath: string, selfiePath: string): Promise<boolean> {
  const { error } = await supabase.rpc('submit_identity_verification', { p_id_type: idType, p_id_path: idPath, p_selfie_path: selfiePath });
  return !error;
}

/** The person's latest check (status and reason only; the file paths are never readable here). */
export async function fetchMyIdentity(userId: string): Promise<IdentityCheck | null> {
  const { data } = await supabase
    .from('identity_verifications')
    .select('id, id_type, status, rejection_reason, submitted_at, reviewed_at, files_deleted_at')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as IdentityCheck | null) ?? null;
}
