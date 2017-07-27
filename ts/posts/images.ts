import { fileTypes } from "../common"
import { config } from "../state"

function imageRoot(): string {
	return config.imageRootOverride || "/uploads"
}

// Get the thumbnail path of an image.
export function thumbPath(thumbType: fileTypes, sha1: string): string {
	return `${imageRoot()}/thumb/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[thumbType]}`
}

// Resolve the path to the source file of an upload.
export function sourcePath(fileType: fileTypes, sha1: string): string {
	return `${imageRoot()}/src/${sha1.slice(0, 2)}/${sha1.slice(2)}.${fileTypes[fileType]}`
}
