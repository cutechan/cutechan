# cutechan [![Build Status](https://travis-ci.org/cutechan/cutechan.svg?branch=master)](https://travis-ci.org/cutechan/cutechan)

K-pop oriented imageboard started as [meguca](https://github.com/bakape/meguca) fork.

## Runtime dependencies

* PostgresSQL >= 9.6
* FFmpeg >= 3.1 shared libraries (libavcodec, libavutil, libavformat, libswscale) compiled with:
    * libvpx
* GraphicsMagick >= 1.3 shared library (Q16) compiled with:
    * zlib
    * libpng
    * libjpeg

## Build dependencies

* Go >= 1.9.2 (for building server)
* Node.js >= 8.0 (for building client)
* FFmpeg and GraphicsMagick development files
* GNU Build System
* OptiPNG

## Build

`make`

## Setup

* See `./cutechan help` for server operation
* Login into the `admin` account via the infinity symbol in the top banner with
  the password `password`
* Change the default password
* Create a board from the administration panel
* Configure server from the administration panel

## Development

* `./cutechan` run the server in development mode
* `make client` and `make server` build the client and server separately
* `make client-watch` watches the file system for changes and incrementally
  rebuilds the client
* `make clean` removes files from the previous compilation

## License

[AGPL-3.0](LICENSE)
