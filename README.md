# cutechan [![Build Status](https://travis-ci.org/cutechan/cutechan.svg?branch=master)](https://travis-ci.org/cutechan/cutechan)

K-pop oriented imageboard started as [meguca](https://github.com/bakape/meguca) fork.

## Install dependencies (Ubuntu 20.04)

```
sudo apt install postgresql
sudo apt install build-essential golang libavformat-dev libswscale-dev libgraphicsmagick1-dev optipng
curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install nodejs
```

## Development

* `make` to build everything
* `make client` to build client
* `make server` to build server
* `make server-config` to init config
* `make server-db` to init database
* `make client-watch` to rebuild client on changes

## First run

* Run `make serve` and open http://localhost:8001 in a browser
* Login into the `admin` account with the password `password`
* Change the default password
* Create a board from the administration panel
* Configure server from the administration panel

## License

[AGPLv3+](LICENSE)
