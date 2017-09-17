DELETE FROM images i
WHERE NOT EXISTS (SELECT 1 FROM post_files WHERE file_hash = i.sha1)
RETURNING SHA1, fileType, thumbType
