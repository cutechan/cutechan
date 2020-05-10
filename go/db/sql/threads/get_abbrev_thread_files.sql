SELECT pf.post_id, i.*
FROM post_files pf
JOIN images i ON i.sha1 = pf.file_hash
WHERE pf.post_id = ANY($1)
ORDER BY pf.id
