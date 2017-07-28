/**
 * Shared constants, should be used everywhere.
 */
// Don't import here anything!

// Selectors, must be kept in sync with markup and styles!
export const ALERTS_CONTAINER_SEL = ".alerts-container";
export const HOVER_CONTAINER_SEL = ".hover-container";
export const POPUP_CONTAINER_SEL = ".popup-container";
export const REPLY_CONTAINER_SEL = ".reply-container";
export const BOARD_SEARCH_INPUT_SEL = ".board-search-input";
export const THREAD_SEL = ".thread";
export const POST_SEL = ".post";
export const POST_LINK_SEL = ".post-link";
export const POST_BODY_SEL = ".post-body";
export const POST_FILE_TITLE_SEL = ".post-file-title";
export const POST_FILE_LINK_SEL = ".post-file-link";
export const POST_FILE_THUMB_SEL = ".post-file-thumb";
export const POST_BACKLINKS_SEL = ".post-backlinks";

// Action trigger selectors, might appear multiple times in markup.
export const TRIGGER_OPEN_REPLY_SEL = ".trigger-open-reply";
export const TRIGGER_QUOTE_POST_SEL = ".trigger-quote-post";
export const TRIGGER_DELETE_POST_SEL = ".trigger-delete-post";
export const TRIGGER_BAN_BY_POST_SEL = ".trigger-ban-by-post";
export const TRIGGER_MEDIA_POPUP_SEL = ".trigger-media-popup";

// Constants.
export const ALERT_HIDE_TIMEOUT_SECS = 5;
export const RELATIVE_TIME_PERIOD_SECS = 60;
export const HOVER_TRIGGER_TIMEOUT_SECS = 0.1;
export const POST_HOVER_TIMEOUT_SECS = 0.5;
export const ZOOM_STEP_PX = 100;
export const HEADER_HEIGHT_PX = 30;
export const REPLY_THREAD_WIDTH_PX = 700;
export const REPLY_BOARD_WIDTH_PX = 1000;
export const REPLY_HEIGHT_PX = 200;
export const REPLY_MIN_WIDTH_PX = 400;
export const REPLY_MIN_HEIGHT_PX = 200;
export const DEFAULT_NOTIFICATION_IMAGE_URL = "/static/img/notification.png";
