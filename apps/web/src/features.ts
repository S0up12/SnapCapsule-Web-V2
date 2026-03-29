import { useMemo } from "react";

import { resolveAppSettings, useSettings } from "./hooks/useSettings";
import { useStories } from "./hooks/useStories";

export function useStoriesWorkspaceVisibility() {
  const settingsQuery = useSettings();
  const storiesQuery = useStories();
  const settings = resolveAppSettings(settingsQuery.data);

  const showStoriesWorkspace = settings.show_stories_workspace;
  const showStoryActivity = settings.show_story_activity;

  const visibility = useMemo(() => {
    const hasStoryMedia = (storiesQuery.data?.total_story_items ?? 0) > 0;
    const hasStoryActivity =
      (storiesQuery.data?.activity.spotlight_history_count ?? 0) > 0 ||
      (storiesQuery.data?.activity.shared_story_count ?? 0) > 0;

    return showStoriesWorkspace && (hasStoryMedia || (showStoryActivity && hasStoryActivity));
  }, [
    showStoriesWorkspace,
    showStoryActivity,
    storiesQuery.data?.activity.shared_story_count,
    storiesQuery.data?.activity.spotlight_history_count,
    storiesQuery.data?.total_story_items,
  ]);

  return {
    isVisible: visibility,
    isLoading: settingsQuery.isLoading || storiesQuery.isLoading,
  };
}
