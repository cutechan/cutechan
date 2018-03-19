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

client: node_modules go/src/github.com/Kagami/kpopnet
	$(GULP)

client-watch:
	$(GULP) -w

go/src/github.com/Kagami/kpopnet:
	go get github.com/Kagami/kpopnet

go/bin/go-bindata:
	go get github.com/kevinburke/go-bindata/...

go/bin/easyjson:
	go get github.com/mailru/easyjson/...

go/bin/qtc:
	go get github.com/valyala/quicktemplate/qtc/...

GENSRC = $(shell find go/src/meguca -type f -name '*.go' | xargs grep -l '^//go:generate')
GENSRC += $(shell find go/src/meguca/db/sql -type f -name '*.sql')
GENSRC += $(wildcard go/src/meguca/templates/*.qtpl)
GENSRC += $(wildcard i18n/*.json)
GENSRC += $(TEMPLATESPP)
go/bin/_gen: go/bin/go-bindata go/bin/easyjson go/bin/qtc $(GENSRC)
	go generate meguca/...
	touch go/bin/_gen

GOSRC = $(shell find go/src/meguca -type f -name '*.go')
go/bin/cutechan: go/bin/_gen $(GOSRC)
	go get -v meguca/...

server: go/bin/cutechan

serve: templates server
	cutechan

deb: clean templates smiles client server
	-patchelf --replace-needed libGraphicsMagick.so.3 libGraphicsMagick-Q16.so.3 go/bin/cutechan-thumb
	mkdir deb_dist
	cp -a DEBIAN deb_dist
	mkdir -p deb_dist/usr/share/cutechan/www
	cp -a dist/* deb_dist/usr/share/cutechan/www
	mkdir -p deb_dist/usr/bin
	cp -a go/bin/cutechan* deb_dist/usr/bin
	chmod -R go+rX deb_dist
	fakeroot dpkg-deb -z0 -b deb_dist cutechan.deb

test: gofmt-staged server
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
	rm -f \
		go/bin/_gen \
		go/bin/cutechan* \
		go/src/meguca/*/bin_data.go \
		go/src/meguca/*/*_easyjson.go \
		go/src/meguca/templates/*.qtpl.go

deb-clean:
	rm -rf deb_dist *.deb

test-clean:
	rm -rf go/multipart-* \
		go/src/meguca/imager/uploads \
		go/src/meguca/assets/uploads
