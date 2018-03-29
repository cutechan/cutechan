define("loader", [
  "almond",
  "events",
  "mustache",
  "classnames",
  "preact",
  "textarea-caret",
  "vmsg",
  "ruhangul",
], function () {
  var scriptCount = 0;
  var scripts = [];

  // Check for browser compatibility by trying to detect some ES6
  // features.
  function check(func) {
    try {
      return eval("(function(){" + func + "})()");
    } catch (e) {
      return false;
    }
  }

  // Check if a browser API function is defined.
  function checkFunction(func) {
    try {
      return typeof eval(func) === "function";
    } catch (e) {
      return false;
    }
  }

  function loadScript(path) {
    var script = document.createElement("script");
    script.src = "/static/js/" + path + ".js"
    script.async = true;
    document.body.appendChild(script);
    return script;
  }

  var es6Tests = [
    // Arrow functions
    'return (()=>5)()===5;',

    // Block scoped const
    '"use strict";  const bar = 123; {const bar = 456;} return bar===123;',

    // Block-scoped let
    '"use strict"; let bar = 123;{ let bar = 456; }return bar === 123;',

    // Computed object properties
    "var x='y';return ({ [x]: 1 }).y === 1;",

    // Shorthand object properties
    "var a=7,b=8,c={a,b};return c.a===7 && c.b===8;",

    // Template strings
    'var a = "ba"; return `foo bar${a + "z"}` === "foo barbaz";',

    // for...of
    'var arr = [5]; for (var item of arr) return item === 5;',

    // Spread operator
    'return Math.max(...[1, 2, 3]) === 3',

    // Class statement
    '"use strict"; class C {}; return typeof C === "function"',

    // Super call
    '"use strict"; var passed = false;'
    + 'class B {constructor(a) {  passed = (a === "barbaz")}};'
    + 'class C extends B {constructor(a) {super("bar" + a)}};'
    + 'new C("baz"); return passed;',

    // Default parameters
    'return (function (a = 1, b = 2) { return a === 3 && b === 2; }(3));',

    // Destructuring declaration
    'var [a,,[b],c] = [5,null,[6]];return a===5 && b===6 && c===undefined',

    // Parameter destructuring
    'return function([a,,[b],c]){return a===5 && b===6 && c===undefined;}'
    + '([5,null,[6]])',

    // Generators
    'function * generator(){yield 5; yield 6};'
    + 'var iterator = generator();'
    + 'var item = iterator.next();'
    + 'var passed = item.value === 5 && item.done === false;'
    + 'item = iterator.next();'
    + 'passed &= item.value === 6 && item.done === false;'
    + 'item = iterator.next();'
    + 'passed &= item.value === undefined && item.done === true;'
    + 'return passed;'
  ];
  for (var i = 0; i < es6Tests.length; i++) {
    if (!check(es6Tests[i])) {
      window.legacy = true;
      break;
    }
  }

  // Stdlib functions and methods.
  var stdlibTests = [
    "Set",
    "Map",
    "Promise",
    "Symbol",
    "Array.from",
    "Array.prototype.includes",
    "String.prototype.includes",
    "String.prototype.repeat",
  ];
  for (var i = 0; i < stdlibTests.length; i++) {
    if (!checkFunction(stdlibTests[i])) {
      scripts.push("core.min");
      break;
    }
  }

  if (!checkFunction("Proxy")) {
    scripts.push("proxy.min");
  }

  var DOMMethods = [
    // DOM level 4 methods
    "Element.prototype.remove",
    "Element.prototype.contains",
    "Element.prototype.matches",
    "Element.prototype.after",
    "Element.prototype.before",
    "Element.prototype.append",
    "Element.prototype.prepend",
    "Element.prototype.replaceWith",
    // DOM level 3 query methods
    "Element.prototype.querySelector",
    "Element.prototype.querySelectorAll",
  ];
  var DOMUpToDate = true;
  for (var i = 0; i < DOMMethods.length; i++) {
    if (!checkFunction(DOMMethods[i])) {
      DOMUpToDate = false;
      break;
    }
  }
  // Check event listener option support.
  if (DOMUpToDate) {
    var s = "var a = document.createElement(\"a\");"
      + "var ctr = 0;"
      + "a.addEventListener(\"click\", () => ctr++, {once: true});"
      + "a.click(); a.click();"
      + "return ctr === 1;";
    DOMUpToDate = check(s);
  }
  if (!DOMUpToDate) {
    scripts.push("dom4");
  }

  // Fetch API.
  if (!checkFunction("fetch")) {
    scripts.push("fetch");
  }

  // Iterable NodeList.
  // TODO(Kagami): Check if still needed.
  if (!window.legacy && !checkFunction("NodeList.prototype[Symbol.iterator]")) {
    NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }

  if (!checkFunction("window.crypto.subtle.digest")) {
    // Remove prefixes on Web Crypto API for Safari.
    if (checkFunction("window.crypto.webkitSubtle.digest")) {
      window.crypto.subtle = window.crypto.webkitSubtle;
    }
    // Remove prefixes on Web Crypto API for IE11.
    else if (checkFunction("window.msCrypto.subtle.digest")) {
      window.crypto = window.msCrypto;
    }
  }

  // Application.
  scripts.push("app" + (window.legacy ? ".es5" : ""));

  for (var i = 0; i < scripts.length; i++) {
    scriptCount++;
    loadScript(scripts[i]).onload = checkAllLoaded;
  }

  function checkAllLoaded() {
    if (--scriptCount === 0) {
      requirejs("app");
    }
  }
});

requirejs("loader");
