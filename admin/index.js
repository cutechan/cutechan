/*
Core  server-side administration module
 */

const cache = require('../server/state').dbCache,
	check = require('../server/msgcheck'),
    common = require('../common'),
	config = require('../config'),
	db = require('../db'),
	events = require('events'),
	mnemonics = require('./mnemonic/mnemonics'),
	Muggle = require('../util/etc').Muggle,
	okyaku = require('../server/okyaku'),
	winston = require('winston');

const mnemonizer = new mnemonics.mnemonizer(config.SECURE_SALT);

function genMnemonic(ip) {
	return ip && mnemonizer.Apply_mnemonic(ip);
}
exports.genMnemonic = genMnemonic;

const dispatcher = okyaku.dispatcher,
	redis = global.redis;

function modHandler(kind, auth) {
	const errMsg = `Couldn't ${kind.replace('_', ' ').toLowerCase()}:`;
	kind = common[kind];
	dispatcher[kind] = (nums, client) =>
		common.checkAuth(auth, client.ident)
			&& check('id...', nums)
			&& client.db.modHandler(kind, nums, err =>
				err && client.kotowaru(Muggle(errMsg, err)));
}

modHandler('SPOILER_IMAGES', 'janitor');
modHandler('DELETE_IMAGES', 'janitor');
modHandler('DELETE_POSTS', 'janitor');
modHandler('LOCK_THREAD', 'moderator');
modHandler('UNLOCK_THREAD', 'moderator');

// Non-persistent global live admin notifications
dispatcher[common.NOTIFICATION] = function (msg, client) {
	msg = msg[0];
	if (!common.checkAuth('admin', client.ident) || !check('string', msg))
		return false;
	okyaku.push([0, common.NOTIFICATION, common.escape_html(msg)]);
	return true;
};

dispatcher[common.MOD_LOG] = function (msg, client) {
	if (!common.checkAuth('janitor', client.ident))
		return false;

	redis.zrange('modLog', 0, -1, (err, log) => {
		if (err)
			return winston.error('Moderation log fetch error:', err);
		client.send([0, common.MOD_LOG, db.destrigifyList(log)]);
	});
	return true;
};

dispatcher[common.BAN] = function (msg, client) {
	if (!common.checkAuth('moderator', client.ident)
		|| !check(['id', 'id', 'id', 'id', 'string', 'id'], msg)
	)
		return false;
	client.db.ban(msg, err =>
		err && client.kotowaru(Muggle('Couldn\'t ban:', err)));
	return true;
};

function cleanUP() {
	const m = redis.multi(),
		now = Date.now();
	// Clean up moderation log entries older than one week
	m.zremrangebyscore('modLog', 0, now - 1000*60*60*24*7);
	// Same for expired bans
	m.zremrangebyscore('bans', 0, now);
	m.exec(err =>
		err && winston.error('Error cleaning up moderation keys:', err));
}
setInterval(cleanUP, 60000);

// Load the bans from redis
function loadBans(cb) {
	redis.zrangebyscore('bans', Date.now(), '+inf', (err, bans) => {
		if (err)
			return winston.error('Error retieving ban list:', err);
		cache.bans = bans;
		cb && cb();
	});
}
exports.loadBans = loadBans;
loadBans();
