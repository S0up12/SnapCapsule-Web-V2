import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AppSettings = {
  dark_mode: boolean;
  autoplay_videos_in_grid: boolean;
  show_memory_overlays: boolean;
  default_grid_size: "small" | "medium" | "large";
  enable_debug_logging: boolean;
  storage: {
    raw_media_dir: string;
    thumbnail_dir: string;
  };
};

export type AppSettingsUpdate = Partial<
  Pick<
    AppSettings,
    "dark_mode" | "autoplay_videos_in_grid" | "show_memory_overlays" | "default_grid_size" | "enable_debug_logging"
  >
>;

function persistLocalSettings(settings: Pick<AppSettings, "dark_mode" | "show_memory_overlays">) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem("snapcapsule:dark-mode", String(settings.dark_mode));
  window.localStorage.setItem("snapcapsule:show-memory-overlays", String(settings.show_memory_overlays));
}

async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch("/api/settings");
  if (!response.ok) {
    throw new Error(`Settings request failed with ${response.status}`);
  }

  const settings = (await response.json()) as AppSettings;
  persistLocalSettings(settings);
  return settings;
}

async function saveSettings(payload: AppSettingsUpdate): Promise<AppSettings> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Settings save failed with ${response.status}`);
  }

  return (await response.json()) as AppSettings;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      persistLocalSettings(data);
    },
  });

  return {
    ...query,
    saveSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
