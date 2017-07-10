import { fileTypes } from "../common"
import { pad } from "../util"
import { config } from "../state"

export function duration(len: number): string {
	let s = ""
	if (len < 60) {
		s = `0:${pad(len)}`
	} else {
		const min = Math.floor(len / 60),
			sec = len - min * 60
		s = `${pad(min)}:${pad(sec)}`
	}
	return s
}

// TODO(Kagami): Localize.
export function fileSize(size: number): string {
	let s = ""
	if (size < (1 << 10)) {
		s = size + 'b'
	} else if (size < (1 << 20)) {
		s = Math.round(size / (1 << 10)) + 'Kb'
	} else {
		const text = Math.round(size / (1 << 20) * 10).toString()
		s = `${text.slice(0, -1)}.${text.slice(-1)}Mb`
	}
	return s
}

function imageRoot(): string {
	return config.imageRootOverride || "/uploads"
}

// Get the thumbnail path of an image, accounting for not thumbnail of specific
// type being present
export function thumbPath(thumbType: fileTypes, SHA1: string): string {
	return `${imageRoot()}/thumb/${SHA1.slice(0, 2)}/${SHA1.slice(2)}.${fileTypes[thumbType]}`
}

// Resolve the path to the source file of an upload
export function sourcePath(fileType: fileTypes, SHA1: string): string {
	return `${imageRoot()}/src/${SHA1.slice(0, 2)}/${SHA1.slice(2)}.${fileTypes[fileType]}`
}
