/**
 * Module with all available API methods.
 */
// TODO(Kagami): Port everything to the use of this module.

import { ln } from "../lang";
import {
  Dict, FutureAPI, postFormProgress,
  postJSON, ProgressFn, uncachedGET,
} from "../util";

type ReqFn = (
  url: string, data?: Dict,
  onProgress?: ProgressFn, api?: FutureAPI,
) => Promise<Response>;

function handleErr(res: Response): Promise<Dict> {
  const type = res.headers.get("Content-Type");
  if (type.startsWith("application/json")) {
    return res.json().then((data) => {
      throw new Error(data.message || ln.UI.unknownErr);
    });
  } else {
    return res.text().then((data) => {
      // XXX(Kagami): Might be quite huge HTML dump (e.g. 500 error).
      // Maybe do it more elegantly...
      const message = data.slice(0, 200);
      throw new Error(message);
    });
  }
}

function req(reqFn: ReqFn, method: string, url: string) {
  url = `/api/${url}`;
  return (data?: Dict, onProgress?: ProgressFn, api?: FutureAPI) => {
    return reqFn(url, data, onProgress, api).then((res) => {
      if (!res.ok) return handleErr(res);
      return res.json().catch(() => {
        throw new Error(ln.UI.unknownErr);
      });
    }, (err) => {
      err.message = err.message || ln.UI.networkErr;
      throw err;
    });
  };
}

// Convenient helper.
const emit = {
  GET: {
    JSON: req.bind(null, uncachedGET, "GET"),
  },
  POST: {
    Form: req.bind(null, postFormProgress, "POST"),
    JSON: req.bind(null, postJSON, "POST"),
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
};

export default API;
