UPDATE main
SET val = $1
WHERE id = 'config'
RETURNING pg_notify('config_updates', $1)
