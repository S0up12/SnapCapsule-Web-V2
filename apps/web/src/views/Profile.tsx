import {
  BadgeCheck,
  ContactRound,
  LoaderCircle,
  LogIn,
  Palette,
  Shield,
  Smartphone,
  UsersRound,
} from "lucide-react";

import SettingsCard from "../components/settings/SettingsCard";
import { useProfile, type ProfileData, type ProfileEventLabel, type ProfileEventValue, type ProfileSecurityDownload } from "../hooks/useProfile";

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

function initialsFromProfile(profile: ProfileData) {
  const source = profile.account.display_name || profile.account.username || "SC";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? "")
    .join("");
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof UsersRound;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-slate-200/80 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function InfoList({ items }: { items: Array<{ label: string; value: string | null }> }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
          <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{item.label}</dt>
          <dd className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{item.value || "Not available"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No exported data here yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function EventList({ items }: { items: Array<ProfileEventLabel | ProfileEventValue | ProfileSecurityDownload> }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No exported history in this section.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const label = "label" in item ? item.label : item.value;
        const secondary = "value" in item && "label" in item ? item.value : null;

        return (
          <div
            key={`${item.date ?? "unknown"}-${label ?? "empty"}-${index}`}
            className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label || "Unknown event"}</p>
                {secondary ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{secondary}</p> : null}
              </div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {formatDateTime(item.date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Profile() {
  const profileQuery = useProfile();

  if (profileQuery.isLoading) {
    return (
      <section className="mx-auto flex min-h-[36rem] w-full max-w-[1600px] items-center justify-center rounded-[2rem] border border-slate-200/70 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.035] dark:shadow-none">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-sky-300/30 bg-sky-100 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/[0.12] dark:text-sky-100">
            <LoaderCircle className="h-9 w-9 animate-spin" />
          </div>
          <h2 className="mt-6 text-2xl font-semibold text-slate-950 dark:text-white">Loading</h2>
        </div>
      </section>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        <div className="rounded-[1.6rem] border border-rose-300/40 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-100">
          {profileQuery.error instanceof Error ? profileQuery.error.message : "Failed to load profile data."}
        </div>
      </section>
    );
  }

  const profile = profileQuery.data;

  return (
    <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_40%),linear-gradient(135deg,_rgba(255,255,255,0.95),_rgba(238,246,255,0.94))] p-6 shadow-[0_28px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(135deg,_rgba(10,18,28,0.92),_rgba(4,9,15,0.98))]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.7rem] border border-slate-200/80 bg-white/85 text-2xl font-semibold text-slate-900 shadow-inner shadow-white/50 dark:border-white/10 dark:bg-white/[0.07] dark:text-white">
              {initialsFromProfile(profile)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-sky-700/80 dark:text-sky-200/70">Imported Profile</p>
              <h2 className="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {profile.account.display_name || profile.account.username || "Snapchat Profile"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.06]">
                  @{profile.account.username || "unknown"}
                </span>
                <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.06]">
                  Joined {formatDate(profile.account.created_at)}
                </span>
                {profile.account.country ? (
                  <span className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.06]">
                    {profile.account.country}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Friends" value={profile.friends.friends_count} icon={UsersRound} />
            <StatCard label="Logins" value={profile.security.login_count} icon={LogIn} />
            <StatCard label="Devices" value={profile.device_history.length || 1} icon={Smartphone} />
            <StatCard label="Bitmoji Opens" value={profile.bitmoji.app_open_count} icon={Palette} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <SettingsCard title="Account">
            <InfoList
              items={[
                { label: "Display Name", value: profile.account.display_name },
                { label: "Username", value: profile.account.username },
                { label: "Created", value: formatDateTime(profile.account.created_at) },
                { label: "Country", value: profile.account.country },
                { label: "Language", value: profile.account.in_app_language },
                { label: "Platform Version", value: profile.account.platform_version },
                { label: "Creation Country", value: profile.account.account_creation_country },
                { label: "Registration IP", value: profile.account.registration_ip },
              ]}
            />
          </SettingsCard>

          <SettingsCard title="Friends">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Current" value={profile.friends.friends_count} icon={UsersRound} />
              <StatCard label="Blocked" value={profile.friends.blocked_count} icon={Shield} />
              <StatCard label="Deleted" value={profile.friends.deleted_count} icon={ContactRound} />
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Friend Preview</h3>
              <div className="mt-3 space-y-3">
                {profile.friends.top_friends.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No friend rows available in this export.</p>
                ) : (
                  profile.friends.top_friends.map((friend) => (
                    <div
                      key={`${friend.username ?? "unknown"}-${friend.added_at ?? "date"}`}
                      className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {friend.display_name || friend.username || "Unknown friend"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                            {friend.username ? `@${friend.username}` : "Username unavailable"}
                          </p>
                        </div>
                        <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          <p>{formatDate(friend.added_at)}</p>
                          {friend.source ? <p className="mt-1 normal-case tracking-normal">{friend.source}</p> : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Interests And Engagement">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="App Opens" value={profile.engagement.application_opens} icon={LogIn} />
              <StatCard label="Story Views" value={profile.engagement.story_views} icon={BadgeCheck} />
              <StatCard label="Discover" value={profile.engagement.discover_channels_viewed_count} icon={ContactRound} />
              <StatCard label="Ad Touches" value={profile.engagement.ads_interacted_count} icon={Shield} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Time Spent</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.breakdown_of_time_spent} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Interest Categories</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.interest_categories} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Content Categories</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.content_categories} />
                </div>
              </div>
            </div>
          </SettingsCard>
        </div>

        <div className="space-y-6">
          <SettingsCard title="Current Device">
            <InfoList
              items={[
                { label: "Make", value: profile.current_device.make },
                { label: "Model", value: profile.current_device.model_name },
                { label: "OS", value: profile.current_device.os_type },
                { label: "Language", value: profile.current_device.language },
              ]}
            />
          </SettingsCard>

          <SettingsCard title="Security">
            <InfoList
              items={[
                { label: "Latest Login", value: formatDateTime(profile.security.latest_login_at) },
                { label: "Latest Login Country", value: profile.security.latest_login_country },
                { label: "Latest Login Status", value: profile.security.latest_login_status },
                { label: "Password Changes", value: String(profile.security.password_change_count) },
                { label: "Connected Permissions", value: String(profile.security.connected_permissions_count) },
                { label: "Snapshot Generated", value: formatDateTime(profile.generated_at) },
              ]}
            />
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Two-Factor Events</h3>
              <div className="mt-3">
                <EventList items={profile.security.two_factor_events} />
              </div>
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Download Reports</h3>
              <div className="mt-3">
                <EventList items={profile.security.download_reports} />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Bitmoji">
            <InfoList
              items={[
                { label: "Email", value: profile.bitmoji.email },
                { label: "Phone", value: profile.bitmoji.phone_number },
                { label: "Created", value: formatDate(profile.bitmoji.account_created_at) },
                { label: "Avatar Gender", value: profile.bitmoji.avatar_gender },
                { label: "App Opens", value: String(profile.bitmoji.app_open_count) },
                { label: "Outfit Saves", value: String(profile.bitmoji.outfit_save_count) },
                { label: "Shares", value: String(profile.bitmoji.share_count) },
              ]}
            />
          </SettingsCard>

          <SettingsCard title="Account History">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Display Name Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.display_name_changes} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Email Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.email_changes} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mobile Number Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.mobile_number_changes} />
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Public Profile">
            <InfoList
              items={[
                { label: "Title", value: profile.public_profile.title },
                { label: "Location", value: profile.public_profile.location },
                { label: "Website", value: profile.public_profile.website },
                { label: "Created", value: formatDate(profile.public_profile.created_at) },
              ]}
            />
          </SettingsCard>
        </div>
      </div>
    </section>
  );
}
