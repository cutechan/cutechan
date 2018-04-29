/**
 * Internationalization support.
 */

// tslint:disable-next-line:no-reference
/// <reference path="index.d.ts" />

import langs from "cc-langs";
import options from "../options";

let lang: Lang = null;

export function gettext(msgid: string): string {
  return (lang.messages[msgid] as string) || msgid;
}

export function ngettext(msgid1: string, msgid2: string, n: number): string {
  const forms = lang.messages[msgid1];
  if (forms) {
    const idx = +lang.getPluralN(n);
    return forms[idx];
  } else {
    return n === 1 ? msgid1 : msgid2;
  }
}

const _ = gettext;
export { _ };
export default _;

export const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function init() {
  lang = langs[options.lang];
}
