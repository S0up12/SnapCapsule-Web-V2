import { BookOpen, Clapperboard, Image as ImageIcon, Images, LoaderCircle, Lock, Radio, Sparkles, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Lightbox from "../components/Lightbox";
import SettingsCard from "../components/settings/SettingsCard";
import { getThumbnailUrl } from "../hooks/useTimeline";
import { useShowMemoryOverlays } from "../hooks/useOverlayPreference";
import { useStories, type StoryAsset, type StoryCollection } from "../hooks/useStories";
import { useToggleFavorite } from "../hooks/useAssetActions";

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStoryTypeLabel(storyType: StoryCollection["story_type"]) {
  switch (storyType) {
    case "private":
      return "Private";
    case "public":
      return "Public";
    case "saved":
      return "Saved";
    default:
      return "Unknown";
  }
}

function getStoryTypeIcon(storyType: StoryCollection["story_type"]) {
  switch (storyType) {
    case "private":
      return Lock;
    case "public":
      return Radio;
    case "saved":
      return Sparkles;
    default:
      return BookOpen;
  }
}

function CollectionStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Images;
}) {
  return (
    <div className="relative rounded-[1.4rem] border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
      <Icon className="absolute right-4 top-4 h-5 w-5 text-slate-500 dark:text-slate-300" />
      <div className="pr-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function StoryCollectionCard({
  collection,
  selected,
  onSelect,
  showOverlays,
}: {
  collection: StoryCollection;
  selected: boolean;
  onSelect: () => void;
  showOverlays: boolean;
}) {
  const cover = collection.items[0] ?? null;
  const StoryTypeIcon = getStoryTypeIcon(collection.story_type);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "w-full rounded-[1.6rem] border p-3 text-left transition",
        selected
          ? "border-sky-300/35 bg-sky-50/75 shadow-[0_20px_45px_rgba(14,165,233,0.12)] dark:border-sky-300/20 dark:bg-sky-300/[0.08]"
          : "border-slate-200/70 bg-white/82 hover:border-slate-300/90 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/15 dark:hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <div className="relative overflow-hidden rounded-[1.25rem] border border-slate-200/70 bg-slate-100 dark:border-white/10 dark:bg-white/[0.04]">
        {cover ? (
          <img
            src={getThumbnailUrl(cover.id, cover.has_overlay ? 1 : 0, showOverlays)}
            alt={collection.title}
            className="aspect-[4/5] w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="aspect-[4/5] w-full bg-slate-100 dark:bg-white/[0.04]" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent px-3 pb-3 pt-8 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{collection.title}</p>
              <p className="mt-1 text-xs text-white/75">{collection.total_items} item{collection.total_items === 1 ? "" : "s"}</p>
            </div>
            <StoryTypeIcon className="h-4.5 w-4.5 shrink-0 text-white/85" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 px-1">
        <span className="inline-flex rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
          {formatStoryTypeLabel(collection.story_type)}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {formatDate(collection.latest_posted_at)}
        </span>
      </div>
    </button>
  );
}

function StoryTile({
  asset,
  showOverlays,
  onOpen,
}: {
  asset: StoryAsset;
  showOverlays: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden rounded-[1.4rem] border border-slate-200/70 bg-white/70 text-left transition hover:border-slate-300/90 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/15 dark:hover:bg-white/[0.05]"
    >
      <img
        src={getThumbnailUrl(asset.id, asset.has_overlay ? 1 : 0, showOverlays)}
        alt={formatDateTime(asset.taken_at)}
        className="aspect-[9/16] w-full object-cover"
        loading="lazy"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent px-3 pb-3 pt-10 text-white">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
            {asset.media_type === "video" ? "Video" : "Photo"}
          </p>
          <p className="mt-1 text-sm font-medium">{formatDateTime(asset.taken_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {asset.is_favorite ? <Star className="h-4.5 w-4.5 fill-amber-300 text-amber-300" /> : null}
          {asset.media_type === "video" ? <Clapperboard className="h-4.5 w-4.5 text-white/85" /> : <ImageIcon className="h-4.5 w-4.5 text-white/85" />}
        </div>
      </div>
    </button>
  );
}

export default function Stories() {
  const storiesQuery = useStories();
  const showOverlays = useShowMemoryOverlays();
  const toggleFavorite = useToggleFavorite();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const collections = storiesQuery.data?.items ?? [];
  const totals = useMemo(() => {
    const photos = collections.reduce(
      (count, collection) => count + collection.items.filter((item) => item.media_type === "image").length,
      0,
    );
    const videos = collections.reduce(
      (count, collection) => count + collection.items.filter((item) => item.media_type === "video").length,
      0,
    );

    return {
      photos,
      videos,
    };
  }, [collections]);

  useEffect(() => {
    if (collections.length === 0) {
      setSelectedCollectionId(null);
      return;
    }

    if (!selectedCollectionId || !collections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(collections[0]?.id ?? null);
    }
  }, [collections, selectedCollectionId]);

  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null;

  if (storiesQuery.isLoading) {
    return (
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[1700px] items-center justify-center rounded-[2rem] border border-slate-200/70 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.12] dark:text-sky-100">
            <LoaderCircle className="h-9 w-9 animate-spin" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">Loading</h2>
        </div>
      </section>
    );
  }

  if (storiesQuery.isError) {
    return (
      <section className="mx-auto flex w-full max-w-[1700px] flex-col gap-6">
        <div className="rounded-[1.6rem] border border-rose-300/40 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
          {storiesQuery.error instanceof Error ? storiesQuery.error.message : "Failed to load stories."}
        </div>
      </section>
    );
  }

  if (collections.length === 0) {
    return (
      <section className="mx-auto flex h-full min-h-0 w-full max-w-[1700px] items-center justify-center rounded-[2rem] border border-slate-200/70 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        <div className="max-w-lg text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100">
            <BookOpen className="h-9 w-9" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">No stories yet</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-400">
            Story media has not been imported from the current Snapchat archive yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto flex h-full min-h-0 w-full max-w-[1700px] flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CollectionStat label="Collections" value={storiesQuery.data?.total_collections ?? 0} icon={BookOpen} />
        <CollectionStat label="Story Items" value={storiesQuery.data?.total_story_items ?? 0} icon={Images} />
        <CollectionStat label="Photos" value={totals.photos} icon={ImageIcon} />
        <CollectionStat label="Videos" value={totals.videos} icon={Clapperboard} />
      </div>

      <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <SettingsCard title="Collections" description="Imported Snapchat stories grouped by story title and type.">
          <div className="max-h-full space-y-4 overflow-y-auto pr-1">
            {collections.map((collection) => (
              <StoryCollectionCard
                key={collection.id}
                collection={collection}
                selected={collection.id === selectedCollection?.id}
                onSelect={() => setSelectedCollectionId(collection.id)}
                showOverlays={showOverlays}
              />
            ))}
          </div>
        </SettingsCard>

        {selectedCollection ? (
          <SettingsCard
            title={selectedCollection.title}
            description={`${formatStoryTypeLabel(selectedCollection.story_type)} story · ${selectedCollection.total_items} item${selectedCollection.total_items === 1 ? "" : "s"} · ${formatDate(selectedCollection.earliest_posted_at)} to ${formatDate(selectedCollection.latest_posted_at)}`}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {selectedCollection.items.map((asset, index) => (
                <StoryTile
                  key={asset.id}
                  asset={asset}
                  showOverlays={showOverlays}
                  onOpen={() => setLightboxIndex(index)}
                />
              ))}
            </div>
          </SettingsCard>
        ) : null}
      </div>

      {selectedCollection && lightboxIndex !== null ? (
        <Lightbox
          assets={selectedCollection.items}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggleFavorite={async (asset) => {
            await toggleFavorite.mutateAsync(asset.id);
          }}
        />
      ) : null}
    </section>
  );
}
