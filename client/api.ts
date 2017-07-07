/**
 * Module with all available API methods.
 */
// TODO(Kagami): Port everything to the use of this module.

import { FormModel, postSM, postEvent, postState } from "./posts"
import { Dict, postForm } from "./util"

function req(method: string, url: string) {
	url = `/api/${url}`
	return function(data: Dict): Promise<Dict> {
		return postForm(url, data).then(res => res.json())
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
