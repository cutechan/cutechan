/**
 * Helper functions for communicating with the server's API.
 */

export type Dict = { [key: string]: any }
export type ProgressFn = (e: ProgressEvent) => void
export type FutureAPI = { abort?: () => void }
export class AbortError extends Error {}

function toFormData(data: Dict): FormData {
	const form = new FormData()
	for (let k of Object.keys(data)) {
		const v = data[k]
		if (Array.isArray(v)) {
			k += "[]"
			v.forEach(item => form.append(k, item))
		} else {
			form.append(k, v)
		}
	}
	return form
}

function xhrToFetchHeaders(xhr: XMLHttpRequest): Headers {
	const headers = new Headers()
	const hStr = xhr.getAllResponseHeaders()
	for (const h of hStr.trim().split(/\r\n/)) {
		const [k, v] = h.split(/: (.+)/)
		headers.append(k, v)
	}
	return headers
}

// Fetches and decodes a JSON response from the API. Returns a tuple of the
// fetched resource and error, if any
export async function fetchJSON<T>(url: string): Promise<[T, string]> {
	const res = await fetch(url)
	if (res.status !== 200) {
		return [null, await res.text()]
	}
	return [await res.json(), ""]
}

// Avoids stale fetches from the browser cache.
export function uncachedGET(url: string): Promise<Response> {
	return fetch(url, {
		method: "GET",
		credentials: "same-origin",
		headers: {"Cache-Control": "no-cache"},
	})
}

// Send a POST request with a JSON body to the server.
export function postJSON(url: string, data: Dict): Promise<Response> {
	return fetch(url, {
		method: "POST",
		credentials: "same-origin",
		body: JSON.stringify(data),
	})
}

// Send a POST multipart/form-data request to the server.
export function postForm(url: string, data: Dict): Promise<Response> {
	return fetch(url, {
		method: "POST",
		credentials: "same-origin",
		body: toFormData(data),
	})
}

// Send a POST multipart/form-data request to the server, accepting
// optional progress callback and storage for XHR API methods like
// `abort`.
// Implemented using XHR underneath because Fetch API currently lacks
// this functionality, but provides roughly same API as fetch version.
export function postFormProgress(
	url: string, data: Dict,
	onProgress?: ProgressFn, api?: FutureAPI,
): Promise<Response> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest()
		xhr.open("POST", url)
		xhr.onload = () => {
			const { status, statusText } = xhr
			const headers = xhrToFetchHeaders(xhr)
			const init = {status, statusText, headers}
			resolve(new Response(xhr.responseText, init))
		}
		xhr.onerror = reject
		if (onProgress) {
			xhr.upload.onprogress = onProgress
		}
		if (api) {
			// A bit kludgy but there is no other way..
			api.abort = () => {
				xhr.abort()
				reject(new AbortError())
			}
		}
		xhr.send(toFormData(data))
	})
}
