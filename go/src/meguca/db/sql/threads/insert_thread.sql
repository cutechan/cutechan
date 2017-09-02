select insert_thread(
  $1::varchar(100),
  $2::bigint,
  $3::bool,
  $4::bigint,
  $5::text,
  $6::bigint,
  $7::bigint,
  $8::varchar(2000),
  $9::varchar(50),
  $10::char(10),
  $11::varchar(20),
  $12::bytea,
  $13::inet,
  $14::char(40),
  $15::bigint[][2],
  $16::json[]
);
