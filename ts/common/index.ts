/** Common types and constants. */

/** Data of a thread. */
export interface ThreadData extends PostData {
  abbrev: boolean;
  sticky: boolean;
  postCtr: number;
  imageCtr: number;
  replyTime: number;
  bumpTime: number;
  subject: string;
  board: string;
  posts?: PostData[];
}

/** Data of a post. */
export interface PostData {
  id: number;
  time: number;
  auth?: string;
  userID?: string;
  userName?: string;
  body: string;
  links?: PostLink[];
  commands?: Command[];
  files?: ImageData[];
  op?: number;
  board?: string;
}

/** Generic link object containing target post board and thread. */
export type PostLink = [number, number];

/** Possible command types. */
export const enum commandType {
  roll,
  flip,
}

/** Single command result delivered from the server. */
export interface Command {
  type: commandType;
  val: any;
}

/** Image data. */
export interface ImageData {
  SHA1: string;
  size: number;
  video: boolean;
  audio: boolean;
  apng: boolean;
  fileType: fileTypes;
  thumbType: fileTypes;
  length?: number;
  title?: string;
  // [width, height, thumbnail_width, thumbnail_height]
  dims: [number, number, number, number];
}

/** Possible file types of a post image. */
// MUST BE KEPT IN SYNC WITH go/src/meguca/common/images.go!
export enum fileTypes {
  jpg,
  png,
  gif,
  webm,
  pdf,
  svg,
  mp4,
  mp3,
  ogg,
  zip,
  "7z",
  "tar.gz",
  "tar.xz",
}

export const thumbSize = 200;
