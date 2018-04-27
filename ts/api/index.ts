/**
 * Module with all available API methods.
 */
// TODO(Kagami): Port everything to the use of this module.

import { _ } from "../lang";
import {
  Dict, FutureAPI, ProgressFn,
  sendFormProgress, sendJSON, uncachedGET,
} from "../util";

type ReqFn = (
  url: string, data?: Dict, method?: string,
  onProgress?: ProgressFn, api?: FutureAPI,
) => Promise<Response>;

function isJson(res: Response): boolean {
  const ctype = res.headers.get("Content-Type") || "";
  return ctype.startsWith("application/json");
}

function isHtml(res: Response): boolean {
  const ctype = res.headers.get("Content-Type") || "";
  return ctype.startsWith("text/html");
}

function handleResponse(res: Response): Promise<any> {
  return res.ok ? res.json() : handleErrorCode(res);
}

function handleErrorCode(res: Response): Promise<any> {
  if (isHtml(res)) {
    // Probably 404/500 page, don't bother parsing.
    throw new Error(_("unknownErr"));
  } else if (isJson(res)) {
    // Probably standardly-shaped JSON error.
    return res.json().then((data) => {
      throw new Error(data && data.error || _("unknownErr"));
    });
  } else {
    // Probably text/plain or something like this.
    return res.text().then((data) => {
      throw new Error(data || _("unknownErr"));
    });
  }
}

function handleError(err: Error) {
  throw new Error(err.message || _("unknownErr"));
}

function makeReq(reqFn: ReqFn, method?: string) {
  return (url: string) =>
    (data?: Dict, onProgress?: ProgressFn, api?: FutureAPI) =>
      reqFn(`/api/${url}`, data, method, onProgress, api)
        .then(handleResponse, handleError);
}

// Convenient helper.
const emit = {
  GET: {
    JSON: makeReq(uncachedGET),
  },
  POST: {
    Form: makeReq(sendFormProgress),
    JSON: makeReq(sendJSON),
  },
  PUT: {
    JSON: makeReq(sendJSON, "PUT"),
  },
};

export const API = {
  post: {
    create: emit.POST.Form("post"),
    createToken: emit.POST.JSON("post/token"),
    delete: emit.POST.JSON("delete-post"),
    get: (id: number) => emit.GET.JSON(`post/${id}`)(),
  },
  thread: {
    create: emit.POST.Form("thread"),
  },
  user: {
    banByPost: emit.POST.JSON("ban"),
  },
  account: {
    setSettings: emit.POST.JSON("account/settings"),
  },
  board: {
    save: (b: string, data: Dict) => emit.PUT.JSON(`boards/${b}`)(data),
  },
};

export default API;
