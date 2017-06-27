"use strict";

const path = require("path");
const del = require("del");
const stripAnsi = require("strip-ansi");
const gulp = require("gulp");
const babel = require("gulp-babel");
const gutil = require("gulp-util");
const jsonminify = require("gulp-jsonminify");
const less = require("gulp-less");
const nano = require("gulp-cssnano");
const rename = require("gulp-rename");
const sourcemaps = require("gulp-sourcemaps");
const ts = require("gulp-typescript");
const uglify = require("gulp-uglify");
const notify = require("gulp-notify");
const runSequence = require("run-sequence");

const DIST_DIR = "dist";
const STATIC_DIR = path.join(DIST_DIR, "static");
const ES6_DIR = path.join(STATIC_DIR, "js", "es6");
const ES5_DIR = path.join(STATIC_DIR, "js", "es5");
const VENDOR_DIR = path.join(STATIC_DIR, "js", "vendor");
const CSS_DIR = path.join(STATIC_DIR, "css");
const LANG_DIR = path.join(STATIC_DIR, "lang");

// Keep script alive and rebuild on file changes.
// Triggered with the `-w` flag.
const watch = gutil.env.w;

// Dependency tasks for the default tasks.
const tasks = [];

// Notify about errors.
const notifyError = notify.onError({
  title: "<%= error.name %>",
  message: "<%= options.stripAnsi(error.message) %>",
  templateOptions: {stripAnsi},
});

// Simply log the error on continuos builds, but fail the build and exit
// with an error status, if failing a one-time build. This way we can
// use failure to build the client to not pass Travis CL tests.
function handleError(err) {
  if (watch) {
    notifyError(err);
  } else {
    throw err;
  }
}

// Create a new gulp task and set it to execute on default and
// incrementally.
function createTask(name, path, task) {
  tasks.push(name);
  gulp.task(name, () =>
    task(gulp.src(path))
  );

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    gulp.watch(path, [name]);
  }
}

function buildClient() {
  return gulp.src("client/**/*.ts")
    .pipe(sourcemaps.init())
    .pipe(ts.createProject("client/tsconfig.json", {
      typescript: require("typescript"),
    })(ts.reporter.nullReporter()))
    .on("error", handleError);
}

// Builds the client files of the appropriate ECMAScript version.
function buildES6() {
  const name = "es6";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient()
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(ES6_DIR)));

  // Recompile on source update, if running with the `-w` flag.
  if (watch) {
    gulp.watch("client/**/*.ts", [name])
  }
}

// Build legacy ES5 client for old browsers.
function buildES5() {
  const name = "es5";
  tasks.push(name);
  gulp.task(name, () =>
    buildClient()
      .pipe(babel({
        presets: ["latest"],
      }))
      .pipe(uglify())
      .on("error", handleError)
      .pipe(sourcemaps.write("maps"))
      .pipe(gulp.dest(ES5_DIR))
  );
}

gulp.task("clean", () => {
  return del(DIST_DIR);
});

// Client JS files.
buildES6();
buildES5();

// Third-party dependencies.
createTask("vendor", [
  "node_modules/almond/almond.js ",
  "node_modules/babel-polyfill/dist/polyfill.min.js",
  "node_modules/whatwg-fetch/fetch.js ",
  "node_modules/dom4/build/dom4.js",
  "node_modules/core-js/client/core.min.js",
  "node_modules/proxy-polyfill/proxy.min.js",
], src =>
  src
    .pipe(gulp.dest(VENDOR_DIR))
);

// Compile Less to CSS.
createTask("css", ["less/*.less", "!less/*.mix.less"], src =>
  src
    .pipe(sourcemaps.init())
    .pipe(less())
    .on("error", handleError)
    .pipe(nano())
    .pipe(sourcemaps.write("maps"))
    .pipe(gulp.dest(CSS_DIR))
);

// Language packs.
createTask("lang", "lang/**/*.json", src =>
  src
    .pipe(jsonminify())
    .on("error", handleError)
    .pipe(gulp.dest(LANG_DIR))
);

// Static assets.
createTask("assets", "assets/**", src =>
  src
    .pipe(gulp.dest(STATIC_DIR))
);

// Build everything.
gulp.task("default", runSequence("clean", tasks));
