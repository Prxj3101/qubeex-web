// Client-side file validation — must mirror backend limits in storage.service.ts

export const ATTACHMENT_ACCEPT =
  'image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo,' +
  'application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/plain';

const LIMITS = {
  image: { max: 5  * 1024 * 1024, label: '5 MB'  },
  video: { max: 50 * 1024 * 1024, label: '50 MB' },
  pdf:   { max: 10 * 1024 * 1024, label: '10 MB' },
  file:  { max: 15 * 1024 * 1024, label: '15 MB' },
} as const;

function getCategory(file: File): keyof typeof LIMITS {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type === 'application/pdf') return 'pdf';
  return 'file';
}

/** Returns an error string if invalid, null if ok. */
export function validateAttachment(file: File): string | null {
  const cat   = getCategory(file);
  const limit = LIMITS[cat];
  if (file.size > limit.max) {
    const label = cat === 'image' ? 'Image' : cat === 'video' ? 'Video' : cat === 'pdf' ? 'PDF' : 'File';
    return `${label} must be ${limit.label} or smaller`;
  }
  return null;
}
