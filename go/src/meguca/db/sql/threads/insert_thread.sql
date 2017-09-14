SELECT insert_thread(
  $1::BIGINT,
  $2::TEXT,
  $3::BIGINT,
  $4::BIGINT,
  $5::VARCHAR(2000),
  $6::VARCHAR(20),
  $7::INET,
  $8::CHAR(40),
  $9::BIGINT[][2],
  $10::VARCHAR(100),
  $11::BIGINT
);
