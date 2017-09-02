with rows as (
  select 1 from post_tokens where ip = $1 and expires > now()
)
select count(rows) < 10 from rows
