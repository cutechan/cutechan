INSERT INTO idol_previews (id, image_id) VALUES ($1, $2)
ON CONFLICT (id) DO
  UPDATE SET image_id = $2
