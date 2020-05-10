DELETE FROM images i
WHERE
  NOT EXISTS (SELECT 1 FROM post_files WHERE file_hash = i.sha1)
  AND NOT EXISTS (SELECT 1 FROM image_tokens WHERE sha1 = i.sha1)
  AND NOT EXISTS (SELECT 1 FROM stickers WHERE sha1 = i.sha1)
  AND NOT EXISTS (SELECT 1 FROM idol_previews WHERE image_id = i.sha1)
RETURNING sha1, fileType, thumbType
