import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '@/lib/supabase';

// Keep this list and the size limit in sync with the chat-attachments bucket
// (supabase/migrations/20261016000002_chat_attachments.sql).
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export type PickedFile = { uri: string; name: string; size: number; mimeType: string };

export type PickResult =
  | { status: 'ok'; file: PickedFile }
  | { status: 'cancelled' }
  | { status: 'tooLarge' }
  | { status: 'error'; reason: string };

const shorten = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 56);

/** Opens the system file picker. Nothing is uploaded yet. */
export async function pickChatFile(): Promise<PickResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({ type: ALLOWED_MIME_TYPES, copyToCacheDirectory: true, multiple: false });
    if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };
    const asset = picked.assets[0];
    if (typeof asset.size === 'number' && asset.size > MAX_FILE_BYTES) return { status: 'tooLarge' };
    return {
      status: 'ok',
      file: { uri: asset.uri, name: asset.name || 'file', size: asset.size ?? 0, mimeType: asset.mimeType || 'application/octet-stream' },
    };
  } catch (error) {
    return { status: 'error', reason: shorten(error) };
  }
}

const sanitizeName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';

export type FileUploadResult =
  | { status: 'ok'; path: string; name: string; size: number; mime: string }
  | { status: 'error'; reason: string };

/** Uploads a picked file into the private chat-attachments bucket, scoped to this conversation. */
export async function uploadChatFile(conversationId: string, file: PickedFile): Promise<FileUploadResult> {
  let bytes: ArrayBuffer;
  try {
    const response = await fetch(file.uri);
    bytes = await response.arrayBuffer();
  } catch (error) {
    return { status: 'error', reason: `read: ${shorten(error)}` };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) return { status: 'error', reason: 'too_large' };

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${conversationId}/${unique}-${sanitizeName(file.name)}`;
  const { error } = await supabase.storage.from('chat-attachments').upload(path, bytes, { contentType: file.mimeType, upsert: false });
  if (error) return { status: 'error', reason: `storage: ${shorten(error)}` };
  return { status: 'ok', path, name: file.name.slice(0, 255), size: bytes.byteLength, mime: file.mimeType };
}

/** A short-lived link to view or download an attachment. */
export async function chatFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 60);
  return error ? null : (data?.signedUrl ?? null);
}
