export GOBIN = $(PWD)/bin
export PATH := $(PATH):$(GOBIN)
export NODEBIN = $(PWD)/node_modules/.bin
export HTMLMIN = $(NODEBIN)/html-minifier
export GULP = $(NODEBIN)/gulp

all: client server

node_modules:
	npm install

mustache-pp/%.mustache: mustache/%.mustache
	@mkdir -p mustache-pp
	$(HTMLMIN) --collapse-whitespace --collapse-inline-tag-whitespace -o $@ $<

mustache-pp: node_modules $(subst mustache/,mustache-pp/,$(wildcard mustache/*.mustache))

smiles-pp: node_modules $(wildcard smiles/*.png)
	$(GULP) smiles

client: mustache-pp smiles-pp
	$(GULP)

client-watch: mustache-pp smiles-pp
	NODE_ENV=development $(GULP) -w

client-dev: mustache-pp smiles-pp
	NODE_ENV=development $(GULP)

bin/go-bindata:
	cd go; go install github.com/kevinburke/go-bindata/go-bindata

bin/easyjson:
	cd go; go install github.com/mailru/easyjson/easyjson

bin/qtc:
	cd go; go install github.com/valyala/quicktemplate/qtc

GENSRC  = $(shell find go -type f -name '*.go' | xargs grep -l '^//go:generate')
GENSRC += $(shell find go/db/sql -type f -name '*.sql')
GENSRC += $(wildcard go/templates/*.qtpl)
GENSRC += $(wildcard po/*.po)
go/db/bin_data.go: bin/go-bindata bin/easyjson bin/qtc mustache-pp $(GENSRC)
	cd go; go generate ./...

server: smiles-pp go/db/bin_data.go
	cd go; go install ./cmd/...

serve: server
	cutechan --debug --cfg cutechan.toml

server-config:
	cp cutechan.toml.example cutechan.toml

server-db:
	sudo -u postgres psql -c "CREATE USER meguca WITH PASSWORD 'meguca';"
	sudo -u postgres createdb meguca -O meguca

gofmt:
	cd go; go fmt ./...

mustache-clean:
	rm -rf mustache-pp

smiles-clean:
	rm -rf smiles-pp go/smiles

client-clean:
	rm -rf labels-pp dist

server-clean:
	rm -rf bin go/*/bin_data.go go/*/*_easyjson.go go/templates/*.qtpl.go

clean: mustache-clean smiles-clean client-clean server-clean

client-deploy: client
	rsync -rvze ssh --delete dist/ ${CUTECHAN_DEPLOY_HOST}:/srv/cutechan/www/

server-deploy: server
	docker build -t cutechan .
	docker save cutechan | pv | ssh -C ${CUTECHAN_DEPLOY_HOST} 'docker load'
	ssh ${CUTECHAN_DEPLOY_HOST} 'systemctl restart docker-compose@cutechan.service'

deploy: client-deploy server-deploy
