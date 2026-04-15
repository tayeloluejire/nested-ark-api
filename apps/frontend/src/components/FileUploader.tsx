'use client';
/**
 * FileUploader — Nested Ark OS
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable Cloudinary Upload Widget component.
 *
 * WHY CLOUDINARY (not direct server upload):
 * - Files go direct from the user's device → Cloudinary CDN (never through Render)
 * - Render free tier has limited bandwidth and no persistent disk storage
 * - Cloudinary free tier: 25 credits/month (~25,000 images), global CDN
 * - Automatic image optimisation — a 4K site photo from Lagos loads fast in London
 * - Returns a permanent, secure HTTPS URL we can store in our DB
 * - Supports: jpg, png, pdf, mp4, and all common formats
 *
 * SETUP (one-time, in Render environment variables):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = your_cloud_name
 *   CLOUDINARY_API_KEY                = your_api_key       (backend only)
 *   CLOUDINARY_API_SECRET             = your_api_secret    (backend only — NEVER expose)
 *   CLOUDINARY_UPLOAD_PRESET          = nested_ark_secure  (set to "signed" in dashboard)
 *
 * USAGE:
 *   <FileUploader
 *     label="ID Document"
 *     hint="Photo of your NIN, Passport, or Driver's Licence"
 *     accept="image,pdf"
 *     folder="kyc-documents"
 *     onUpload={(url) => setForm({ ...form, id_document_url: url })}
 *   />
 */

import { useState, useCallback } from 'react';
import {
  Upload, Camera, FileText, CheckCircle2,
  AlertCircle, Loader2, X, ExternalLink, Image as ImageIcon
} from 'lucide-react';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type AcceptType = 'image' | 'pdf' | 'video' | 'image,pdf' | 'image,video' | 'all';

interface FileUploaderProps {
  /** Label shown above the button */
  label: string;
  /** Secondary hint text */
  hint?: string;
  /** What file types to allow */
  accept?: AcceptType;
  /** Cloudinary folder to organise uploads */
  folder?: string;
  /** Called with the final secure URL when upload succeeds */
  onUpload: (url: string) => void;
  /** Current value — if set, shows the existing URL as "already uploaded" */
  value?: string;
  /** Disable the uploader (e.g. during form submission) */
  disabled?: boolean;
  /** Whether this field is required */
  required?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMimeTypes(accept: AcceptType): string {
  switch (accept) {
    case 'image':       return 'image/jpeg,image/png,image/webp,image/heic';
    case 'pdf':         return 'application/pdf';
    case 'video':       return 'video/mp4,video/quicktime,video/webm';
    case 'image,pdf':   return 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
    case 'image,video': return 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';
    case 'all':
    default:            return 'image/*,application/pdf,video/*';
  }
}

function getAcceptLabel(accept: AcceptType): string {
  switch (accept) {
    case 'image':       return 'JPG, PNG, WEBP, HEIC';
    case 'pdf':         return 'PDF only';
    case 'video':       return 'MP4, MOV, WEBM';
    case 'image,pdf':   return 'JPG, PNG or PDF';
    case 'image,video': return 'JPG, PNG or MP4';
    case 'all':
    default:            return 'Image, PDF or Video';
  }
}

function isImage(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|heic)(\?|$)/i.test(url);
}

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url) || url.includes('/raw/upload/');
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function FileUploader({
  label,
  hint,
  accept = 'image,pdf',
  folder = 'nested-ark-uploads',
  onUpload,
  value,
  disabled = false,
  required = false,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState('');
  const [localUrl,  setLocalUrl]  = useState(value || '');

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setError('');
    setProgress(0);

    // Client-side size check (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large — maximum size is 10 MB');
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get a signed upload signature from our backend
      // This means only authenticated Nested Ark users can upload
      const sigRes = await api.post('/api/upload/signature', {
        folder,
        resource_type: file.type.startsWith('video/') ? 'video' : 'auto',
      });
      const { signature, timestamp, cloud_name, api_key, upload_preset } = sigRes.data;

      // Step 2: Upload directly to Cloudinary (file goes device → CDN, not through Render)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', String(timestamp));
      formData.append('api_key', api_key);
      formData.append('folder', folder);
      if (upload_preset) formData.append('upload_preset', upload_preset);

      // Use XMLHttpRequest to track upload progress
      const secureUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const resourceType = file.type.startsWith('video/') ? 'video' : 'auto';
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/${resourceType}/upload`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            resolve(data.secure_url);
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });

      setLocalUrl(secureUrl);
      onUpload(secureUrl);
      setProgress(100);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err?.response?.data?.error ?? err?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [folder, onUpload]);

  // ── File input change ──────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  // ── Clear uploaded file ────────────────────────────────────────────────────
  const handleClear = () => {
    setLocalUrl('');
    setProgress(0);
    setError('');
    onUpload('');
  };

  const inputId = `file-uploader-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const hasFile = Boolean(localUrl);
  const mimeTypes = getMimeTypes(accept);
  const acceptLabel = getAcceptLabel(accept);

  return (
    <div className="space-y-2">
      {/* Label */}
      <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest block">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {/* ── Already uploaded — show preview ── */}
      {hasFile ? (
        <div className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-3">
          {/* Preview */}
          {isImage(localUrl) ? (
            <div className="relative w-full max-h-48 overflow-hidden rounded-lg border border-zinc-800 bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={localUrl} alt="Uploaded document" className="max-h-48 object-contain" />
            </div>
          ) : isPdf(localUrl) ? (
            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-zinc-800">
              <FileText size={28} className="text-red-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">PDF Document</p>
                <p className="text-[9px] text-zinc-500 truncate font-mono">{localUrl.split('/').pop()}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-zinc-800">
              <ImageIcon size={28} className="text-zinc-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">File Uploaded</p>
                <p className="text-[9px] text-zinc-500 truncate font-mono">{localUrl.split('/').pop()}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-teal-500">
              <CheckCircle2 size={13} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Uploaded</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={localUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all"
              >
                <ExternalLink size={10} /> View
              </a>
              {!disabled && (
                <label
                  htmlFor={inputId}
                  className="flex items-center gap-1 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-teal-500 hover:border-teal-500/40 text-[9px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer"
                >
                  <Upload size={10} /> Replace
                  <input id={inputId} type="file" accept={mimeTypes} onChange={handleChange} className="sr-only" capture={accept === 'image' ? 'environment' : undefined} />
                </label>
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/30 rounded-lg transition-all"
                  title="Remove file"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

      ) : uploading ? (
        /* ── Uploading — show progress ── */
        <div className="p-5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-teal-500 flex-shrink-0" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Uploading…</p>
              <p className="text-[9px] text-zinc-500">{progress}% · Uploading to secure cloud storage</p>
            </div>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

      ) : (
        /* ── No file — show upload button ── */
        <label
          htmlFor={inputId}
          className={`flex items-start gap-4 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer group
            ${disabled
              ? 'border-zinc-800 opacity-50 cursor-not-allowed'
              : 'border-zinc-700 hover:border-teal-500/60 hover:bg-teal-500/5 active:scale-[0.99]'
            }`}
        >
          {/* Icon area */}
          <div className={`p-3 rounded-xl border flex-shrink-0 transition-all
            ${disabled ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-700 bg-zinc-900 group-hover:border-teal-500/40 group-hover:bg-teal-500/10'}`}>
            <Camera
              size={22}
              className={disabled ? 'text-zinc-700' : 'text-zinc-400 group-hover:text-teal-500 transition-colors'}
            />
          </div>

          {/* Text */}
          <div className="flex-1 space-y-1 min-w-0">
            <p className={`text-sm font-bold transition-colors ${disabled ? 'text-zinc-600' : 'text-zinc-300 group-hover:text-white'}`}>
              Tap to upload or take a photo
            </p>
            {hint && <p className="text-[10px] text-zinc-600 leading-relaxed">{hint}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[9px] text-zinc-700 font-mono uppercase">{acceptLabel}</span>
              <span className="text-[9px] text-zinc-800">·</span>
              <span className="text-[9px] text-zinc-700 font-mono uppercase">Max 10 MB</span>
            </div>
          </div>

          <input
            id={inputId}
            type="file"
            accept={mimeTypes}
            onChange={handleChange}
            disabled={disabled}
            className="sr-only"
            // On mobile, "camera" opens the camera directly for image uploads
            // On desktop, it shows the standard file picker
            capture={accept === 'image' ? 'environment' : undefined}
          />
        </label>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
