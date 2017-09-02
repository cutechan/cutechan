create or replace function bump_thread(
  id bigint,
  addPost bool,
  delPost bool,
  bump bool,
  image bool
) returns void as $$
  update threads
    set
      replyTime = floor(extract(epoch from now())),
      postCtr = case
        when addPost then postCtr + 1
        when delPost then postCtr - 1
        else postCtr
      end,
      bumpTime = case when bump
        then
          case when postCtr <= 500
            then floor(extract(epoch from now()))
            else bumpTime
          end
        else bumpTime
      end,
      imageCtr = case
        when addPost AND image then imageCtr + 1
        when delPost AND image then imageCtr - 1
        else imageCtr
      end
    where id = bump_thread.id;
$$ language sql;
