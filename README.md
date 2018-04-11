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
* libjpeg(-turbo) shared library (6.2 or 8.0 ABI)
* dlib >= 19.10 shared library

## Build dependencies

* FFmpeg, GraphicsMagick, libjpeg, dlib development files
* Node.js >= 8.0 (for building client)
* Go >= 1.9.2 (for building server)
* GNU Build System
* OptiPNG

## Build

`make`

## Setup

* See `go/bin/cutechan --help` for server operation
* Login into the `admin` account with the password `password`
* Change the default password
* Create a board from the administration panel
* Configure server from the administration panel

## Development

* `make serve` runs the server
* `make client` and `make server` build the client and server separately
* `make client-watch` watches the file system for changes and incrementally
  rebuilds the client
* `make clean` removes files from the previous compilation

## VirtualBox image

If you're on Windows or would like to try cutechan in action without any setup,
check out preconfigured
[image](https://drive.google.com/uc?id=14J4JExRP47cg3cJ8tDJ3lZ7xpHHSwWZO&export=download).

**Instructions**

* Install [VirtualBox](https://www.virtualbox.org)
* File → Import Appliance → Select `cutechan.ova`
* Go to machine settings → Shared folders → Set path to your clone of cutechan repo
* Start it, use `user` for username and `1` for password
* Startup script will automatically build and run server at http://192.168.56.101:8001
* That's it, now you can do any experiments with your personal cutechan install

## License

[AGPLv3+](LICENSE)
