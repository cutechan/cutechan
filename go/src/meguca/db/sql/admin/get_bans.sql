SELECT board, ip, forPost, by, expires, reason FROM bans
WHERE board = ANY($1)
ORDER BY expires DESC
