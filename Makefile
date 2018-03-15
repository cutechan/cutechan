export GOPATH = $(PWD)/go
export TMPDIR = $(PWD)/go
export PATH := $(PATH):$(PWD)/go/bin
export NODE_BIN = $(PWD)/node_modules/.bin
export HTMLMIN = $(NODE_BIN)/html-minifier
export GULP = $(NODE_BIN)/gulp

all: templates smiles client server

TEMPLATES = $(wildcard mustache/*.mustache)
TEMPLATESPP = $(subst mustache/,mustache-pp/,$(TEMPLATES))

mustache-pp:
	mkdir mustache-pp

mustache-pp/%.mustache: mustache/%.mustache
	$(HTMLMIN) --collapse-whitespace --collapse-inline-tag-whitespace \
		-o $@ $<

templates: mustache-pp $(TEMPLATESPP)

.PHONY: smiles
smiles:
	$(GULP) smiles

node_modules:
	npm install

client: node_modules
	$(GULP)

client-watch:
	$(GULP) -w

go/bin/go-bindata:
	go get github.com/kevinburke/go-bindata/...

go/bin/easyjson:
	go get github.com/mailru/easyjson/...

go/bin/qtc:
	go get github.com/valyala/quicktemplate/qtc/...

GENSRC = $(shell find go/src/meguca -type f -name '*.go' | xargs grep -l '^//go:generate')
GENSRC += $(shell find go/src/meguca/db/sql -type f -name '*.sql')
GENSRC += $(wildcard go/src/meguca/templates/*.qtpl)
GENSRC += $(wildcard go/src/meguca/imager/*.png)
GENSRC += $(wildcard i18n/*.json)
GENSRC += $(TEMPLATESPP)
go/bin/_gen: go/bin/go-bindata go/bin/easyjson go/bin/qtc $(GENSRC)
	go generate meguca/...
	touch go/bin/_gen

GOSRC = $(shell find go/src/meguca -type f -name '*.go')
cutechan: go/bin/_gen $(GOSRC)
	go get -v meguca/...
	cp go/bin/meguca cutechan

server: cutechan

serve: templates cutechan
	./cutechan -b :8001

deb: clean templates smiles client server
	-patchelf --replace-needed libGraphicsMagick.so.3 libGraphicsMagick-Q16.so.3 cutechan
	mkdir deb_dist
	cp -a DEBIAN deb_dist
	mkdir -p deb_dist/usr/share/cutechan/www
	cp -a dist/* deb_dist/usr/share/cutechan/www
	mkdir -p deb_dist/usr/bin
	cp -a cutechan deb_dist/usr/bin
	chmod -R go+rX deb_dist
	fakeroot dpkg-deb -z0 -b deb_dist cutechan.deb

test: gofmt-staged cutechan
	npm -s test
	#go test meguca/...

gofmt:
	go fmt meguca/...

gofmt-staged:
	./gofmt-staged.sh

.PHONY: tags
tags:
	ctags -R go/src/meguca ts

clean: templates-clean smiles-clean client-clean server-clean deb-clean test-clean

templates-clean:
	rm -rf mustache-pp

smiles-clean:
	rm -rf smiles-pp

client-clean:
	rm -rf dist

server-clean:
	rm -rf cutechan \
		go/bin/meguca \
		go/bin/_gen \
		go/src/meguca/*/bin_data.go \
		go/src/meguca/common/*_easyjson.go \
		go/src/meguca/config/*_easyjson.go \
		go/src/meguca/templates/*.qtpl.go

deb-clean:
	rm -rf deb_dist *.deb

test-clean:
	rm -rf go/multipart-* \
		go/src/meguca/imager/uploads \
		go/src/meguca/imager/assets/uploads \
		go/src/meguca/imager/testdata/thumb_*.jpg \
		go/src/meguca/imager/testdata/thumb_*.png
