"use strict";System.register(["underscore","../util"],function(e,n){function t(e,n){return Object.freeze(Object.defineProperties(e,{raw:{value:Object.freeze(n)}}))}function a(e){var n="",t=e.trip,a=e.name,r=e.auth;return(a||!t)&&(n+=a?i(a):lang.anon,t&&(n+=" ")),t&&(n+="<code>"+i(t)+"</code>"),r&&(n+=" ## "+(imports.hotConfig.staff_aliases[r]||r)),n}function r(e){var n=new Date(e);return c(n.getDate())+" "+lang.year[n.getMonth()]+" "+n.getFullYear()+("("+lang.week[n.getDay()]+")")+(c(n.getHours())+":"+c(n.getMinutes()))}function o(e,n){var t=Math.floor((n-e)/6e4),a=void 0;if(1>t){if(t>-5)return this.lang.just_now;a=!0,t=-t}for(var r=[60,24,30,12],o=["minute","hour","day","month"],i=0;i<r.length;i++){if(t<r[i])return lang.ago(t,lang.time[o[i]],a);t=Math.floor(t/r[i])}return lang.ago(t,lang.time.year,a)}var i,s,c,u,l,h;return{setters:[function(e){i=e.escape},function(e){s=e.parseHTML,c=e.pad}],execute:function(){function n(e){var n=e.num,t=e.op,a=e.subject;return s(u,a?"<h3>「"+i(e.subject)+"」</h3>":"",c(e),f(e.time),this.postURL(n,t),this.postURL(n,t),n)}function c(e){var n='<b class="name',t=e.auth,r=e.email;if(t&&(n+=" "+("admin"===t?"admin":"moderator")),n+='">',r){var o={"class":"email",href:"mailto:"+encodeURI(r),target:"blank"};n+=s(l,o)}return n+=a(e),r&&(n+="</a>"),n+="</b>",e.mnemonic&&(n+=" "+m(e.mnemonic)),n}function m(e){return'<b class="mod addr">'+mnem+"</b>"}function f(e){var n=void 0,t=void 0,a=r(e);return options.get("relativeTime")&&(n=a,t=o(e,Date.now())),s(h,n,t||a)}u=t(['<header>\n            <input type="checkbox" class="postCheckbox">\n            ',"\n            ","\n            ",'\n            <nav>\n                <a href="','" class="history">\n                    No.\n                </a>\n                <a href="','" class="quote">\n                    ','\n                </a>\n            </nav>\n        </header>\n        <span class="oi control" data-glyph="chevron-bottom"></span>'],['<header>\n            <input type="checkbox" class="postCheckbox">\n            ',"\n            ","\n            ",'\n            <nav>\n                <a href="','" class="history">\n                    No.\n                </a>\n                <a href="','" class="quote">\n                    ','\n                </a>\n            </nav>\n        </header>\n        <span class="oi control" data-glyph="chevron-bottom"></span>']),l=t(["<a ",">"],["<a ",">"]),h=t(['<time title="','">\n            ',"\n        </time>"],['<time title="','">\n            ',"\n        </time>"]),e("renderHeader",n),e("renderName",c),e("renderMnemonic",m),e("renderTime",f)}}});
//# sourceMappingURL=../../maps/posts/render/header.js.map
