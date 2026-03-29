import {
  BadgeCheck,
  ContactRound,
  LoaderCircle,
  LogIn,
  MapPinned,
  Palette,
  Shield,
  Smartphone,
  UsersRound,
} from "lucide-react";

import PrivacyText from "../components/privacy/PrivacyText";
import SettingsCard from "../components/settings/SettingsCard";
import { useProfile, type ProfileData, type ProfileEventLabel, type ProfileEventValue, type ProfileSecurityDownload } from "../hooks/useProfile";
import { usePrivacyPreferences } from "../hooks/usePrivacyPreferences";
import { useSettings } from "../hooks/useSettings";

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

function formatDateTime(value: string | null, hideExactTimestamps: boolean = false) {
  if (!value) {
    return "Unknown";
  }

  if (hideExactTimestamps) {
    return formatDate(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDecimal(value: number | null) {
  if (value === null) {
    return "Unknown";
  }

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function maskSensitiveValue(value: string | null, hidden: boolean, fallback: string = "Hidden for privacy") {
  if (!hidden) {
    return value;
  }
  return value ? fallback : value;
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
    <div className="relative rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.04]">
      <Icon className="absolute right-4 top-4 h-5 w-5 text-slate-500 dark:text-slate-300" />
      <div className="pr-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
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

function ChipList({
  items,
  scrollAfter = 6,
}: {
  items: string[];
  scrollAfter?: number;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No exported data here yet.</p>;
  }

  const shouldScroll = items.length >= scrollAfter;

  return (
    <div className={shouldScroll ? "max-h-24 overflow-y-auto pr-2" : undefined}>
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
    </div>
  );
}

function EventList({
  items,
  scrollAfter = 3,
  hideExactTimestamps = false,
}: {
  items: Array<ProfileEventLabel | ProfileEventValue | ProfileSecurityDownload>;
  scrollAfter?: number;
  hideExactTimestamps?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No exported history in this section.</p>;
  }

  const shouldScroll = items.length > scrollAfter;

  return (
    <div className={shouldScroll ? "max-h-56 space-y-3 overflow-y-auto pr-2" : "space-y-3"}>
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
                {formatDateTime(item.date, hideExactTimestamps)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlaceList({
  items,
  emptyMessage,
  hideDetails = false,
}: {
  items: Array<{ name: string | null; location: string | null; date: string | null; share_type: string | null }>;
  emptyMessage: string;
  hideDetails?: boolean;
}) {
  if (hideDetails) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Location details are hidden by privacy settings.</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
      {items.map((item, index) => (
        <div
          key={`${item.name ?? "unknown"}-${item.location ?? "place"}-${item.date ?? index}`}
          className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name || "Unknown place"}</p>
              {item.location ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.location}</p> : null}
            </div>
            <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {item.date ? <p>{item.date}</p> : null}
              {item.share_type ? <p className="mt-1 normal-case tracking-normal">{item.share_type}</p> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubscriptionList({
  items,
  hideExactTimestamps = false,
}: {
  items: ProfileData["subscriptions"]["recent_purchases"];
  hideExactTimestamps?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No subscription purchases in this export.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.purchase_date ?? "unknown"}-${item.provider ?? "provider"}-${index}`}
          className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.purchase_type || "Unknown purchase"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {[item.provider, item.price === null ? null : formatDecimal(item.price)]
                  .filter(Boolean)
                  .join(" · ") || "Purchase details unavailable"}
              </p>
            </div>
            <div className="text-right text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <p>{formatDateTime(item.purchase_date, hideExactTimestamps)}</p>
              <p className="mt-1 normal-case tracking-normal">{item.is_active ? "Active" : "Inactive"}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallList({
  items,
  hideExactTimestamps = false,
  hideLocationDetails = false,
}: {
  items: ProfileData["communications"]["recent_calls"];
  hideExactTimestamps?: boolean;
  hideLocationDetails?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No call history in this export.</p>;
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
      {items.map((item, index) => (
        <div
          key={`${item.date ?? "unknown"}-${item.direction ?? "direction"}-${index}`}
          className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {[item.direction, item.call_type].filter(Boolean).join(" · ") || "Unknown call"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {[
                  item.result,
                  item.participants === null ? null : `${item.participants} people`,
                  item.duration_seconds === null ? null : `${formatNumber(item.duration_seconds)} sec`,
                  item.network,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No extra details"}
              </p>
              {!hideLocationDetails && (item.city || item.country) ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {[item.city, item.country].filter(Boolean).join(", ")}
                </p>
              ) : null}
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {formatDateTime(item.date, hideExactTimestamps)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SupportNoteList({
  items,
  hideExactTimestamps = false,
}: {
  items: ProfileData["communications"]["support_notes"];
  hideExactTimestamps?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No support notes in this export.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.date ?? "unknown"}-${item.subject ?? "subject"}-${index}`}
          className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.subject || "Support note"}</p>
              {item.message ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{item.message}</p> : null}
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {formatDateTime(item.date, hideExactTimestamps)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapchatPlusCard({
  profile,
  hideExactTimestamps = false,
}: {
  profile: ProfileData;
  hideExactTimestamps?: boolean;
}) {
  return (
    <SettingsCard
      title="Snapchat+"
      description="Subscription purchase data imported from Snapchat+ export files."
    >
      <div className="rounded-[1.4rem] border border-amber-300/45 bg-[linear-gradient(135deg,_rgba(254,249,195,0.92),_rgba(253,224,71,0.18))] px-4 py-4 shadow-[0_18px_36px_rgba(161,98,7,0.12)] dark:border-amber-300/25 dark:bg-[linear-gradient(135deg,_rgba(120,53,15,0.22),_rgba(251,191,36,0.08))]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-800/80 dark:text-amber-200/75">Snapchat+ Import</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              {profile.subscriptions.latest_purchase?.purchase_type || "Subscription"}
            </p>
          </div>
          <span className="rounded-full border border-amber-400/40 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-900 dark:border-amber-300/20 dark:bg-white/[0.06] dark:text-amber-100">
            {profile.subscriptions.snapchat_plus_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <InfoList
          items={[
            { label: "Purchases", value: String(profile.subscriptions.purchase_count) },
            { label: "Latest Provider", value: profile.subscriptions.latest_purchase?.provider ?? null },
            {
              label: "Latest Price",
              value:
                profile.subscriptions.latest_purchase?.price === null || profile.subscriptions.latest_purchase?.price === undefined
                  ? null
                  : formatDecimal(profile.subscriptions.latest_purchase.price),
            },
            { label: "Latest End", value: formatDateTime(profile.subscriptions.latest_purchase?.ends_at ?? null, hideExactTimestamps) },
          ]}
        />
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Purchases</h3>
        <div className="mt-3">
          <SubscriptionList items={profile.subscriptions.recent_purchases} hideExactTimestamps={hideExactTimestamps} />
        </div>
      </div>
    </SettingsCard>
  );
}

export default function Profile() {
  const profileQuery = useProfile();
  const settingsQuery = useSettings();
  const { blurPrivateNames, hideExactTimestamps, hideLocationDetails } = usePrivacyPreferences();

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
  const showSnapchatPlusCard =
    (settingsQuery.data?.show_snapchat_plus_profile_card ?? true) && profile.subscriptions.purchase_count > 0;
  const showCommunicationsCard =
    profile.communications.outgoing_calls_count > 0 ||
    profile.communications.incoming_calls_count > 0 ||
    profile.communications.completed_calls_count > 0 ||
    profile.communications.support_notes.length > 0;

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
              <PrivacyText
                as="h2"
                blurred={blurPrivateNames}
                className="mt-2 truncate text-3xl font-semibold tracking-tight text-slate-950 dark:text-white"
              >
                {profile.account.display_name || profile.account.username || "Snapchat Profile"}
              </PrivacyText>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                <PrivacyText
                  as="span"
                  blurred={blurPrivateNames}
                  className="rounded-full border border-slate-200/80 bg-white/85 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.06]"
                >
                  @{profile.account.username || "unknown"}
                </PrivacyText>
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
          <StatCard label="Snapscore" value={formatNumber(profile.ranking.snapscore)} icon={BadgeCheck} />
          <StatCard label="Devices" value={profile.device_history.length || 1} icon={Smartphone} />
          <StatCard label="Location Points" value={profile.location.raw_location_count} icon={MapPinned} />
        </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <SettingsCard title="Account">
            <InfoList
              items={[
                { label: "Display Name", value: profile.account.display_name },
                { label: "Username", value: profile.account.username },
                { label: "Created", value: formatDateTime(profile.account.created_at, hideExactTimestamps) },
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
                          <PrivacyText
                            as="p"
                            blurred={blurPrivateNames}
                            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
                          >
                            {friend.display_name || friend.username || "Unknown friend"}
                          </PrivacyText>
                          <PrivacyText
                            as="p"
                            blurred={blurPrivateNames}
                            className="mt-1 text-sm text-slate-600 dark:text-slate-400"
                          >
                            {friend.username ? `@${friend.username}` : "Username unavailable"}
                          </PrivacyText>
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

          <SettingsCard title="Location">
            <InfoList
              items={[
                { label: "Latest Region", value: maskSensitiveValue(profile.location.latest_region, hideLocationDetails) },
                { label: "Latest City", value: maskSensitiveValue(profile.location.latest_city, hideLocationDetails) },
                { label: "Latest Country", value: maskSensitiveValue(profile.location.latest_country, hideLocationDetails) },
                {
                  label: "Latest Coordinate Time",
                  value: hideLocationDetails ? "Hidden for privacy" : formatDateTime(profile.location.latest_coordinate_at, hideExactTimestamps),
                },
                { label: "Latest Coordinate", value: maskSensitiveValue(profile.location.latest_coordinate, hideLocationDetails) },
                { label: "Inferred Home", value: maskSensitiveValue(profile.location.inferred_home, hideLocationDetails) },
                { label: "Inferred Work", value: maskSensitiveValue(profile.location.inferred_work, hideLocationDetails) },
                { label: "Declared Home", value: maskSensitiveValue(profile.location.declared_home, hideLocationDetails) },
              ]}
            />
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Frequent Regions</h3>
                <div className="mt-3">
                  {hideLocationDetails ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Location details are hidden by privacy settings.</p>
                  ) : (
                    <ChipList items={profile.location.frequent_regions} />
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Location Summary</h3>
                <div className="mt-3 space-y-3">
                  <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">History Points</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.location.raw_location_count}</p>
                  </div>
                  <div className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/85 px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">School</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {maskSensitiveValue(profile.location.school_name, hideLocationDetails) || "Not available"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Visited Places</h3>
                <div className="mt-3">
                  <PlaceList items={profile.location.visited_places} emptyMessage="No inferred visited places in this export." hideDetails={hideLocationDetails} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Snap Map Places</h3>
                <div className="mt-3">
                  <PlaceList items={profile.location.snap_map_places} emptyMessage="No Snap Map places history in this export." hideDetails={hideLocationDetails} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Business Visits</h3>
                <div className="mt-3">
                  <PlaceList items={profile.location.business_visits} emptyMessage="No business visit history in this export." hideDetails={hideLocationDetails} />
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Interests And Engagement">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="App Opens" value={profile.engagement.application_opens} icon={LogIn} />
              <StatCard label="Story Views" value={profile.engagement.story_views} icon={BadgeCheck} />
              <StatCard label="Discover" value={profile.engagement.discover_channels_viewed_count} icon={ContactRound} />
              <StatCard label="Shares" value={profile.engagement.off_platform_share_count} icon={Shield} />
            </div>
            <div className="mt-5">
              <InfoList
                items={[
                  { label: "Age Cohort", value: profile.engagement.cohort_age },
                  { label: "Ad Demographic", value: profile.engagement.derived_ad_demographic },
                  { label: "Latest Share", value: formatDateTime(profile.engagement.latest_off_platform_share_at, hideExactTimestamps) },
                  { label: "Ad Touches", value: String(profile.engagement.ads_interacted_count) },
                ]}
              />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Time Spent</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.breakdown_of_time_spent} scrollAfter={4} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Interest Categories</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.interest_categories} scrollAfter={4} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Content Categories</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.content_categories} scrollAfter={4} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Web Interactions</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.web_interactions} scrollAfter={4} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">App Interactions</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.app_interactions} scrollAfter={4} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Share Destinations</h3>
                <div className="mt-3">
                  <ChipList items={profile.engagement.share_destinations} scrollAfter={4} />
                </div>
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

          {showSnapchatPlusCard ? <SnapchatPlusCard profile={profile} hideExactTimestamps={hideExactTimestamps} /> : null}
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

          <SettingsCard title="Ranking">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Snapscore" value={formatNumber(profile.ranking.snapscore)} icon={BadgeCheck} />
              <StatCard label="Friends" value={profile.ranking.total_friends} icon={UsersRound} />
              <StatCard label="Following" value={profile.ranking.accounts_followed} icon={ContactRound} />
              <StatCard label="Spotlight" value={profile.ranking.spotlight_posts} icon={Palette} />
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Top Spotlight Tags</h3>
              <div className="mt-3">
                <ChipList items={profile.ranking.top_spotlight_tags} />
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Security">
            <InfoList
              items={[
                { label: "Latest Login", value: formatDateTime(profile.security.latest_login_at, hideExactTimestamps) },
                { label: "Latest Login Country", value: profile.security.latest_login_country },
                { label: "Latest Login Status", value: profile.security.latest_login_status },
                { label: "Latest Terms Acceptance", value: formatDateTime(profile.security.latest_terms_acceptance_at, hideExactTimestamps) },
                { label: "Password Changes", value: String(profile.security.password_change_count) },
                { label: "Connected Permissions", value: String(profile.security.connected_permissions_count) },
                { label: "Snapshot Generated", value: formatDateTime(profile.generated_at, hideExactTimestamps) },
              ]}
            />
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Two-Factor Events</h3>
              <div className="mt-3">
                <EventList items={profile.security.two_factor_events} hideExactTimestamps={hideExactTimestamps} />
              </div>
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected Apps</h3>
              <div className="mt-3">
                <EventList items={profile.security.connected_apps} hideExactTimestamps={hideExactTimestamps} />
              </div>
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Terms Acceptance</h3>
              <div className="mt-3">
                <EventList items={profile.security.terms_acceptances} hideExactTimestamps={hideExactTimestamps} />
              </div>
            </div>
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Download Reports</h3>
              <div className="mt-3">
                <EventList items={profile.security.download_reports} hideExactTimestamps={hideExactTimestamps} />
              </div>
            </div>
          </SettingsCard>

          {showCommunicationsCard ? (
            <SettingsCard title="Calls & Support">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Outgoing" value={profile.communications.outgoing_calls_count} icon={LogIn} />
                <StatCard label="Incoming" value={profile.communications.incoming_calls_count} icon={Smartphone} />
                <StatCard label="Completed" value={profile.communications.completed_calls_count} icon={BadgeCheck} />
              </div>
              <div className="mt-5">
                <InfoList items={[{ label: "Latest Call", value: formatDateTime(profile.communications.latest_call_at, hideExactTimestamps) }]} />
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Calls</h3>
                <div className="mt-3">
                  <CallList items={profile.communications.recent_calls} hideExactTimestamps={hideExactTimestamps} hideLocationDetails={hideLocationDetails} />
                </div>
              </div>
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Support Notes</h3>
                <div className="mt-3">
                  <SupportNoteList items={profile.communications.support_notes} hideExactTimestamps={hideExactTimestamps} />
                </div>
              </div>
            </SettingsCard>
          ) : null}

          <SettingsCard title="Account History">
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Display Name Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.display_name_changes} hideExactTimestamps={hideExactTimestamps} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Email Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.email_changes} hideExactTimestamps={hideExactTimestamps} />
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mobile Number Changes</h3>
                <div className="mt-3">
                  <EventList items={profile.history.mobile_number_changes} hideExactTimestamps={hideExactTimestamps} />
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Public Profile">
            <InfoList
              items={[
                { label: "Title", value: profile.public_profile.title },
                { label: "Location", value: maskSensitiveValue(profile.public_profile.location, hideLocationDetails) },
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
