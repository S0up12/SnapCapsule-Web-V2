import { useQuery } from "@tanstack/react-query";

export type ProfileEventLabel = {
  date: string | null;
  label: string | null;
};

export type ProfileEventValue = {
  date: string | null;
  value: string | null;
};

export type ProfileSecurityDownload = {
  date: string | null;
  label: string | null;
  value: string | null;
};

export type ProfileData = {
  generated_at: string | null;
  account: {
    username: string | null;
    display_name: string | null;
    country: string | null;
    created_at: string | null;
    account_creation_country: string | null;
    in_app_language: string | null;
    platform_version: string | null;
    registration_ip: string | null;
  };
  current_device: {
    make: string | null;
    model_name: string | null;
    os_type: string | null;
    language: string | null;
  };
  device_history: Array<{
    make: string | null;
    model: string | null;
    device_type: string | null;
    start_time: string | null;
  }>;
  friends: {
    friends_count: number;
    friend_requests_sent_count: number;
    blocked_count: number;
    deleted_count: number;
    ignored_count: number;
    pending_count: number;
    top_friends: Array<{
      username: string | null;
      display_name: string | null;
      added_at: string | null;
      source: string | null;
    }>;
  };
  bitmoji: {
    email: string | null;
    phone_number: string | null;
    account_created_at: string | null;
    avatar_gender: string | null;
    app_open_count: number;
    outfit_save_count: number;
    share_count: number;
  };
  engagement: {
    application_opens: number;
    story_views: number;
    discover_channels_viewed_count: number;
    ads_interacted_count: number;
    breakdown_of_time_spent: string[];
    interest_categories: string[];
    content_categories: string[];
  };
  security: {
    login_count: number;
    latest_login_at: string | null;
    latest_login_country: string | null;
    latest_login_status: string | null;
    password_change_count: number;
    connected_permissions_count: number;
    two_factor_events: ProfileEventLabel[];
    download_reports: ProfileSecurityDownload[];
  };
  history: {
    display_name_changes: ProfileEventValue[];
    email_changes: ProfileEventValue[];
    mobile_number_changes: ProfileEventValue[];
  };
  public_profile: {
    created_at: string | null;
    title: string | null;
    location: string | null;
    website: string | null;
  };
};

async function fetchProfile(): Promise<ProfileData> {
  const response = await fetch("/api/profile");
  if (!response.ok) {
    let detail = `Profile request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch {
      // Ignore non-JSON error bodies.
    }
    throw new Error(detail);
  }

  return (await response.json()) as ProfileData;
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 60_000,
  });
}
