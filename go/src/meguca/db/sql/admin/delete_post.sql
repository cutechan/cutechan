WITH files AS (
  SELECT count(*) AS cnt FROM post_files WHERE post_id = $1
)

DELETE FROM posts USING files WHERE id = $1

RETURNING
  log_moderation(2::SMALLINT, board, id, $2),
  bump_thread(op, false, true, false, files.cnt)
