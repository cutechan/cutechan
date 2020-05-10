SELECT i.*
FROM posts p
JOIN post_files pf ON pf.post_id = p.id
JOIN images i ON i.sha1 = pf.file_hash
WHERE p.id = $1
ORDER BY pf.id
