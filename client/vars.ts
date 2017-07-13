/**
 * Shared constants, should be used everywhere.
 */
// Don't import here anything!

// Selectors, must be kept in sync with markup and styles!
export const REPLY_CONTAINER_SEL = ".reply-container"
export const ALERTS_CONTAINER_SEL = ".alerts-container"
export const BOARD_SEARCH_INPUT_SEL = ".board-search-input"
export const THREAD_SEL = ".thread"
export const POST_SEL = ".post"
export const POST_FILE_THUMB_SEL = ".post-file-thumb"
export const POST_BODY_SEL = ".post-body"
export const POST_BACKLINKS_SEL = ".post-backlinks"

// Action trigger selectors, might appear multiple time in markup.
export const TRIGGER_OPEN_REPLY_SEL = ".trigger-open-reply"
export const TRIGGER_QUOTE_POST_SEL = ".trigger-quote-post"
export const TRIGGER_DELETE_POST_SEL = ".trigger-delete-post"
export const TRIGGER_BAN_BY_POST_SEL = ".trigger-ban-by-post"

// Constants.
export const ALERT_HIDE_TIMEOUT_SECS = 5
export const RELATIVE_TIME_PERIOD_SECS = 60
export const ZOOM_STEP_PX = 100
export const BANNER_HEIGHT_PX = 25
