FROM ubuntu:20.04

RUN sed -i 's|http://archive.ubuntu.com/ubuntu/|mirror://mirrors.ubuntu.com/mirrors.txt|g' /etc/apt/sources.list \
 && apt update && apt install -y --no-install-recommends libavformat58 libswscale5 libgraphicsmagick-q16-3 sudo && apt clean \
 && addgroup --gid 2000 cutechan && adduser --system --gid 2000 --no-create-home --disabled-login cutechan \
 && adduser --system --group --no-create-home --disabled-login cutethumb \
 && echo 'cutechan ALL=(cutethumb) NOPASSWD: /usr/bin/cutethumb' > /etc/sudoers.d/cutechan && chmod 440 /etc/sudoers.d/cutechan \
 && echo 'Set disable_coredump false' >> /etc/sudo.conf \
 && touch /cutechan.toml

EXPOSE 8001
USER cutechan
VOLUME ["/uploads"]
ENTRYPOINT ["cutechan", "--cfg", "/cutechan.toml"]
COPY bin/cutechan bin/cutethumb /usr/bin/
