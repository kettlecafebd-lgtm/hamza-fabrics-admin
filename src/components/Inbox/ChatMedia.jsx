import { useState } from 'react';
import { Download, ImageOff } from 'lucide-react';
import { getMediaSrc, isAudio, isImage, isVideo, refreshMediaUrl } from '../../lib/chatMedia';

/**
 * Renders an inbound/outbound chat attachment.
 *
 * Refactor context: attachments used to be `<img src="/api/chat/media/:id">`
 * backed by bytes in Postgres. Now the backend returns a CDN URL (or a signed
 * proxy URL). If the link has expired we silently ask
 * /api/chat/refresh-media/:id once, then give up gracefully — a broken image
 * must never take down the thread.
 */
export default function ChatMedia({ message, isOutbound, isDark }) {
  if (!message?.has_media) return null;

  // Keying on the message id resets internal state when the row changes,
  // without a setState-in-effect cascade.
  return (
    <ChatMediaBody
      key={`${message.id}:${message.media_url ?? ''}`}
      message={message}
      isOutbound={isOutbound}
      isDark={isDark}
    />
  );
}

function ChatMediaBody({ message, isOutbound, isDark }) {
  const [src, setSrc] = useState(() => getMediaSrc(message));
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleError = async () => {
    if (refreshing || failed) return;
    setRefreshing(true);
    try {
      const fresh = await refreshMediaUrl(message.id);
      if (fresh && fresh !== src) {
        setSrc(fresh);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const media = message.media;
  const label = media?.kind || message.media_type || 'file';

  if (!src || failed) {
    return (
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 my-1 text-xs ${
        isOutbound ? 'bg-white/15 text-white/80' : isDark ? 'bg-gray-600/50 text-gray-300' : 'bg-gray-200 text-gray-500'
      }`}>
        <ImageOff size={14} />
        <span>{refreshing ? 'Refreshing attachment…' : 'Attachment unavailable'}</span>
      </div>
    );
  }

  if (isImage(message, media)) {
    return (
      <a href={src} target="_blank" rel="noreferrer noopener" className="block my-1">
        <img
          src={src}
          alt="Chat attachment"
          onError={handleError}
          loading="lazy"
          className="max-w-full rounded-lg max-h-64 object-cover"
        />
      </a>
    );
  }

  if (isVideo(message, media)) {
    return (
      <video src={src} controls preload="metadata" onError={handleError} className="max-w-full rounded-lg my-1 max-h-64">
        Your browser does not support video playback.
      </video>
    );
  }

  if (isAudio(message, media)) {
    return (
      <audio src={src} controls preload="none" onError={handleError} className="my-1 w-56">
        Your browser does not support audio playback.
      </audio>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer noopener"
      className={`flex items-center gap-2 rounded-lg px-3 py-2 my-1 text-xs underline ${
        isOutbound ? 'bg-white/15 text-white' : isDark ? 'bg-gray-600/50 text-gray-200' : 'bg-gray-200 text-gray-700'
      }`}
    >
      <Download size={14} />
      <span className="truncate">{label === 'file' ? 'Download attachment' : `Open ${label}`}</span>
    </a>
  );
}
