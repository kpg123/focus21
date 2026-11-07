/** Find the primary playback element on supported sites. */
export function findMediaElement(): HTMLVideoElement | null {
  const videos = [...document.querySelectorAll("video")].filter(
    (v) => v instanceof HTMLVideoElement,
  ) as HTMLVideoElement[];
  if (!videos.length) return null;

  // Prefer the largest visible player (main content, not tiny previews).
  return videos.sort((a, b) => {
    const area = (el: HTMLVideoElement) => el.clientWidth * el.clientHeight;
    return area(b) - area(a);
  })[0];
}

export function isMediaPlaying(media: HTMLVideoElement | null = findMediaElement()): boolean {
  if (!media) return false;
  return (
    !media.paused &&
    !media.ended &&
    media.readyState >= 2 &&
    media.playbackRate > 0
  );
}
