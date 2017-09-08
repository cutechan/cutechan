// Common types and constants in a separate module to avoid circular
// dependencies

// Detect FireFox, so we can disable any functionality it's retarded bugs and
// data races break
export const isCuck = navigator.userAgent.toLowerCase().includes("firefox");

// Generic link object containing target post board and thread
export type PostLink = [number, number];

// Data of any post. In addition to server-sent JSON includes the state
// property.
export interface PostData {
  editing: boolean;
  deleted: boolean;
  banned: boolean;
  sticky: boolean;
  images: ImageData[];
  time: number;
  id: number;
  op: number;
  body: string;
  auth: string;
  board?: string;
  links?: PostLink[];
}

// Data of an OP post
export interface ThreadData extends PostData {
  postCtr: number;
  imageCtr: number;
  replyTime: number;
  bumpTime: number;
  subject: string;
  board: string;
  posts?: PostData[];
}

// Image data embeddable in posts and thread hashes
export interface ImageData {
  apng: boolean;
  audio: boolean;
  video: boolean;
  fileType: fileTypes;
  thumbType: fileTypes;
  length?: number;
  artist?: string;
  title?: string;
  size: number;
  // [width, height, thumbnail_width, thumbnail_height]
  dims: [number, number, number, number];
  MD5: string;
  SHA1: string;
  name: string;
}

// Possible file types of a post image
export enum fileTypes {
  jpg, png, gif, webm, pdf, svg, mp4, mp3, ogg, zip, "7z", "tar.gz", "tar.xz",
}

export const thumbSize = 200;
