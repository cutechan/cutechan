/**
 * Module with all available API methods.
 */
// TODO(Kagami): Port everything to the use of this module.

import { ln } from "./lang"
import { FormModel, postSM, postEvent, postState } from "./posts"
import { Dict, postForm } from "./util"

function handleErr(res: Response): Promise<Dict> {
	const type = res.headers.get("Content-Type")
	if (type === "application/json") {
		return res.json().then(data => {
			throw new Error(data.message || ln.UI.unknownErr)
		})
	} else {
		return res.text().then(data => {
			// XXX(Kagami): Might be quite huge HTML dump (e.g. 500). Maybe do
			// it more elegantly...
			throw new Error(data.slice(0, 200))
		})
	}
}

function req(method: string, url: string) {
	url = `/api/${url}`
	return function(data: Dict): Promise<Dict> {
		return postForm(url, data).then(res => {
			if (!res.ok) return handleErr(res)
			return res.json().catch(() => { throw new Error(ln.UI.unknownErr) })
		})
	}
}

const post = req.bind(null, "POST")

// Create post via WebSocket because it's already opened when we are in
// thread and it's a bit faster than sending HTTP request. So why not?
function createPostWS({ body }: Dict): Promise<Dict> {
	return new Promise((resolve, reject) => {
		postSM.act(postState.ready, postEvent.open, () => {
			return postState.sendingNonLive
		})
		postSM.act(postState.sendingNonLive, postEvent.done, () => {
			resolve({})
			return postState.ready
		})

		postSM.feed(postEvent.open)
		const model = new FormModel()
		model.parseInput(body)
		model.commitNonLive()
	})
}

export const API = {
	thread: {
		create: post("thread"),
	},
	post: {
		create: post("post"),
		createWS: createPostWS,
	},
}

export default API
