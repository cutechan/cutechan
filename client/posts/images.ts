import { fileTypes } from "../common"
import { config } from "../state"

function pad(n: number): string {
	n |= 0
	return (n < 10 ? "0" : "") + n
}

export function duration(len: number): string {
  return pad(len / 60) + ":" + pad(len % 60)
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
