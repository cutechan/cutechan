SELECT board, id, type, by, created
FROM mod_log
WHERE board = ANY($1)
ORDER BY created DESC
