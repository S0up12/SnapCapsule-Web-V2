from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ProfileAccountSummary(BaseModel):
    username: str | None = Field(default=None, description="Primary Snapchat username from the export.")
    display_name: str | None = Field(default=None, description="Best available display name from the export.")
    country: str | None = Field(default=None, description="Country associated with the Snapchat account.")
    created_at: datetime | None = Field(default=None, description="Account creation timestamp.")
    account_creation_country: str | None = Field(default=None, description="Country recorded when the account was created.")
    in_app_language: str | None = Field(default=None, description="Preferred in-app language recorded by Snapchat.")
    platform_version: str | None = Field(default=None, description="Platform version value exported by Snapchat.")
    registration_ip: str | None = Field(default=None, description="Registration IP if present in the export.")


class ProfileCurrentDevice(BaseModel):
    make: str | None = Field(default=None, description="Current device manufacturer reported in the export.")
    model_name: str | None = Field(default=None, description="Current device model name or identifier.")
    os_type: str | None = Field(default=None, description="Operating system type reported by Snapchat.")
    language: str | None = Field(default=None, description="Current device language setting.")


class ProfileDeviceHistoryEntry(BaseModel):
    make: str | None = Field(default=None, description="Device manufacturer.")
    model: str | None = Field(default=None, description="Device model identifier.")
    device_type: str | None = Field(default=None, description="Device category such as PHONE.")
    start_time: datetime | None = Field(default=None, description="Timestamp when the device started being used.")


class ProfileRankingSummary(BaseModel):
    snapscore: int = Field(..., description="Snapscore exported in ranking statistics.")
    total_friends: int = Field(..., description="Total friends count reported in ranking statistics.")
    accounts_followed: int = Field(..., description="Number of followed accounts reported in ranking statistics.")
    spotlight_posts: int = Field(..., description="Number of Spotlight posts or interactions reported in ranking data.")
    top_spotlight_tags: list[str] = Field(..., description="Most-used Spotlight tags inferred from ranking data.")


class ProfileFriendSummaryEntry(BaseModel):
    username: str | None = Field(default=None, description="Friend username.")
    display_name: str | None = Field(default=None, description="Friend display name.")
    added_at: datetime | None = Field(default=None, description="Timestamp when the friend relationship started.")
    source: str | None = Field(default=None, description="How the friend was added according to the export.")


class ProfileFriendsSummary(BaseModel):
    friends_count: int = Field(..., description="Number of current friends in the export.")
    friend_requests_sent_count: int = Field(..., description="Number of outbound friend requests in the export.")
    blocked_count: int = Field(..., description="Number of blocked users in the export.")
    deleted_count: int = Field(..., description="Number of deleted friends in the export.")
    ignored_count: int = Field(..., description="Number of ignored Snapchatters in the export.")
    pending_count: int = Field(..., description="Number of pending requests in the export.")
    top_friends: list[ProfileFriendSummaryEntry] = Field(..., description="Small preview list of recent or prominent friends.")


class ProfileBitmojiSummary(BaseModel):
    email: str | None = Field(default=None, description="Bitmoji account email if present.")
    phone_number: str | None = Field(default=None, description="Bitmoji account phone number if present.")
    account_created_at: datetime | None = Field(default=None, description="Bitmoji account creation timestamp.")
    avatar_gender: str | None = Field(default=None, description="Bitmoji avatar gender reported by analytics.")
    app_open_count: int = Field(..., description="Bitmoji app open count.")
    outfit_save_count: int = Field(..., description="Saved Bitmoji outfit count.")
    share_count: int = Field(..., description="Bitmoji share count.")


class ProfileEngagementSummary(BaseModel):
    application_opens: int = Field(..., description="Application opens recorded in the export.")
    story_views: int = Field(..., description="Story views recorded in the export.")
    discover_channels_viewed_count: int = Field(..., description="Distinct viewed Discover channel rows.")
    ads_interacted_count: int = Field(..., description="Ads interacted with according to the export.")
    cohort_age: str | None = Field(default=None, description="Snapchat demographic age cohort if present.")
    derived_ad_demographic: str | None = Field(default=None, description="Derived ad demographic label if present.")
    breakdown_of_time_spent: list[str] = Field(..., description="Compact breakdown of time spent on app sections.")
    interest_categories: list[str] = Field(..., description="Interest categories inferred by Snapchat.")
    content_categories: list[str] = Field(..., description="Content categories inferred by Snapchat.")
    web_interactions: list[str] = Field(..., description="Recent web interaction domains exported by Snapchat.")
    app_interactions: list[str] = Field(..., description="Recent app interaction labels exported by Snapchat.")
    off_platform_share_count: int = Field(..., description="Number of off-platform sharing rows in the export.")
    latest_off_platform_share_at: datetime | None = Field(default=None, description="Most recent off-platform share timestamp.")
    share_destinations: list[str] = Field(..., description="Distinct share destinations used off-platform.")


class ProfileEventLabel(BaseModel):
    date: datetime | None = Field(default=None, description="Event timestamp.")
    label: str | None = Field(default=None, description="Primary event label.")


class ProfileEventValue(BaseModel):
    date: datetime | None = Field(default=None, description="Event timestamp.")
    value: str | None = Field(default=None, description="Event value shown in the profile workspace.")


class ProfileSecurityDownload(BaseModel):
    date: datetime | None = Field(default=None, description="Download report timestamp.")
    label: str | None = Field(default=None, description="Download report status.")
    value: str | None = Field(default=None, description="Email associated with the report.")


class ProfileSecuritySummary(BaseModel):
    login_count: int = Field(..., description="Number of login history entries in the export.")
    latest_login_at: datetime | None = Field(default=None, description="Most recent login timestamp.")
    latest_login_country: str | None = Field(default=None, description="Country of the most recent login.")
    latest_login_status: str | None = Field(default=None, description="Status of the most recent login event.")
    password_change_count: int = Field(..., description="Number of password change entries in account history.")
    connected_permissions_count: int = Field(..., description="Number of connected app permission entries.")
    latest_terms_acceptance_at: datetime | None = Field(default=None, description="Most recent primary terms acceptance timestamp.")
    two_factor_events: list[ProfileEventLabel] = Field(..., description="Recent two-factor authentication events.")
    download_reports: list[ProfileSecurityDownload] = Field(..., description="Recent download report events.")
    connected_apps: list[ProfileSecurityDownload] = Field(..., description="Recent connected app permission events.")
    terms_acceptances: list[ProfileEventLabel] = Field(..., description="Recent primary terms acceptance versions.")


class ProfileSubscriptionRecord(BaseModel):
    purchase_date: datetime | None = Field(default=None, description="Purchase timestamp.")
    purchase_type: str | None = Field(default=None, description="Subscription or purchase type label.")
    provider: str | None = Field(default=None, description="Provider used for the purchase.")
    price: float | None = Field(default=None, description="Recorded purchase price if available.")
    ends_at: datetime | None = Field(default=None, description="Subscription end timestamp if present.")
    is_active: bool = Field(default=False, description="Whether the purchase appears active at snapshot generation time.")


class ProfileSubscriptionsSummary(BaseModel):
    snapchat_plus_active: bool = Field(default=False, description="Whether the latest Snapchat+ subscription appears active.")
    purchase_count: int = Field(default=0, description="Number of recorded Snapchat+ or platform purchase rows.")
    latest_purchase: ProfileSubscriptionRecord | None = Field(default=None, description="Most recent Snapchat+ purchase row.")
    recent_purchases: list[ProfileSubscriptionRecord] = Field(default_factory=list, description="Recent Snapchat+ purchase rows.")


class ProfileCallRecord(BaseModel):
    date: datetime | None = Field(default=None, description="Call timestamp.")
    direction: str | None = Field(default=None, description="Call direction bucket such as outgoing, incoming, or completed.")
    call_type: str | None = Field(default=None, description="Call media type such as AUDIO or VIDEO.")
    participants: int | None = Field(default=None, description="Number of people reported in the chat.")
    result: str | None = Field(default=None, description="Call result label if Snapchat exported one.")
    city: str | None = Field(default=None, description="City reported for the call event.")
    country: str | None = Field(default=None, description="Country reported for the call event.")
    duration_seconds: int | None = Field(default=None, description="Call duration in seconds if present.")
    network: str | None = Field(default=None, description="Reported network type such as WIFI.")


class ProfileSupportRecord(BaseModel):
    date: datetime | None = Field(default=None, description="Support interaction timestamp.")
    subject: str | None = Field(default=None, description="Support subject label.")
    message: str | None = Field(default=None, description="Support message body.")


class ProfileCommunicationsSummary(BaseModel):
    outgoing_calls_count: int = Field(default=0, description="Number of outgoing call rows in the export.")
    incoming_calls_count: int = Field(default=0, description="Number of incoming call rows in the export.")
    completed_calls_count: int = Field(default=0, description="Number of completed call rows in the export.")
    latest_call_at: datetime | None = Field(default=None, description="Most recent call timestamp across talk history rows.")
    recent_calls: list[ProfileCallRecord] = Field(default_factory=list, description="Recent combined talk history rows.")
    support_notes: list[ProfileSupportRecord] = Field(default_factory=list, description="Recent support note rows.")


class ProfileHistorySummary(BaseModel):
    display_name_changes: list[ProfileEventValue] = Field(..., description="Recent display name changes.")
    email_changes: list[ProfileEventValue] = Field(..., description="Recent email changes.")
    mobile_number_changes: list[ProfileEventValue] = Field(..., description="Recent mobile number changes.")


class ProfileLocationSummary(BaseModel):
    latest_region: str | None = Field(default=None, description="Most recent region recorded in Snapchat location data.")
    latest_city: str | None = Field(default=None, description="Most recent city recorded in Snapchat location data.")
    latest_country: str | None = Field(default=None, description="Most recent country recorded in Snapchat location data.")
    frequent_regions: list[str] = Field(..., description="Recent frequent regions inferred by Snapchat.")
    raw_location_count: int = Field(..., description="Number of raw location history coordinate rows in the export.")
    latest_coordinate_at: datetime | None = Field(default=None, description="Timestamp of the latest raw coordinate point.")
    latest_coordinate: str | None = Field(default=None, description="Latest raw coordinate pair string from the export.")
    inferred_home: str | None = Field(default=None, description="Inferred home location string from Snapchat.")
    inferred_work: str | None = Field(default=None, description="Inferred work location string from Snapchat.")
    declared_home: str | None = Field(default=None, description="User-provided home location string if present.")
    school_name: str | None = Field(default=None, description="School name from location history if present.")
    visited_places: list[dict[str, str | None]] = Field(..., description="Inferred places Snapchat thinks you may have visited.")
    business_visits: list[dict[str, str | None]] = Field(..., description="Business visits derived from Snapchat location history.")
    snap_map_places: list[dict[str, str | None]] = Field(..., description="Snap Map places history rows.")


class ProfilePublicProfileSummary(BaseModel):
    created_at: datetime | None = Field(default=None, description="Public profile creation timestamp if available.")
    title: str | None = Field(default=None, description="Public profile title.")
    location: str | None = Field(default=None, description="Public profile location.")
    website: str | None = Field(default=None, description="Public profile website.")


class ProfileResponse(BaseModel):
    generated_at: datetime | None = Field(default=None, description="Timestamp when the compact profile snapshot was generated.")
    account: ProfileAccountSummary
    current_device: ProfileCurrentDevice
    device_history: list[ProfileDeviceHistoryEntry] = Field(..., description="Recent device history preview.")
    ranking: ProfileRankingSummary
    friends: ProfileFriendsSummary
    bitmoji: ProfileBitmojiSummary
    engagement: ProfileEngagementSummary
    security: ProfileSecuritySummary
    subscriptions: ProfileSubscriptionsSummary = Field(
        default_factory=ProfileSubscriptionsSummary,
        description="Snapchat+ and other platform purchase summary derived from the export.",
    )
    communications: ProfileCommunicationsSummary = Field(
        default_factory=ProfileCommunicationsSummary,
        description="Combined talk history and support interactions derived from the export.",
    )
    history: ProfileHistorySummary
    location: ProfileLocationSummary
    public_profile: ProfilePublicProfileSummary
