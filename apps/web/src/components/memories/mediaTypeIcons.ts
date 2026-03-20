import { Clapperboard, Image as ImageIcon, type LucideIcon } from "lucide-react";

import type { TimelineAsset } from "../../hooks/useTimeline";

const MEMORY_MEDIA_TYPE_ICONS: Record<TimelineAsset["media_type"], LucideIcon> = {
  image: ImageIcon,
  video: Clapperboard,
};

export function getMemoryMediaTypeIcon(mediaType: TimelineAsset["media_type"]): LucideIcon {
  return MEMORY_MEDIA_TYPE_ICONS[mediaType];
}
