SELECT type, id, by, created
FROM mod_log
WHERE board = ANY($1)
ORDER BY created DESC
