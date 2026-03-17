import { Copy, Download, Expand, PencilLine, Star } from "lucide-react";

type AssetContextMenuProps = {
  x: number;
  y: number;
  isFavorite: boolean;
  onViewFullSize: () => void;
  onToggleFavorite: () => void;
  onEditTags: () => void;
  onDownloadOriginal: () => void;
  onCopyShareableLink: () => void;
};

function MenuButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Expand;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[0.95rem] px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export default function AssetContextMenu({
  x,
  y,
  isFavorite,
  onViewFullSize,
  onToggleFavorite,
  onEditTags,
  onDownloadOriginal,
  onCopyShareableLink,
}: AssetContextMenuProps) {
  return (
    <div
      className="fixed z-50 w-[15rem] rounded-[1.25rem] border border-slate-200/90 bg-white/96 p-2 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur dark:border-white/10 dark:bg-slate-950/94 dark:shadow-black/40"
      style={{ left: x, top: y }}
    >
      <MenuButton icon={Expand} label="View Full Size" onClick={onViewFullSize} />
      <MenuButton icon={Star} label={isFavorite ? "Unfavorite" : "Favorite"} onClick={onToggleFavorite} />
      <MenuButton icon={PencilLine} label="Edit Tags" onClick={onEditTags} />
      <MenuButton icon={Download} label="Download Original" onClick={onDownloadOriginal} />
      <MenuButton icon={Copy} label="Copy Shareable Link" onClick={onCopyShareableLink} />
    </div>
  );
}
