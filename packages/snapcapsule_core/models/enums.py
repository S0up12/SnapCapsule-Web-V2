from enum import Enum


class AssetSource(str, Enum):
    CHAT = "chat"
    MEMORY = "memory"
    STORY = "story"
    UNKNOWN = "unknown"


class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"


class ChatMessageSource(str, Enum):
    CHAT_HISTORY = "chat_history"
    SNAP_HISTORY = "snap_history"


class StoryType(str, Enum):
    PRIVATE = "private"
    PUBLIC = "public"
    SAVED = "saved"
    UNKNOWN = "unknown"
