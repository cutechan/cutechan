/** Declarations for some modules with missed types. */

declare module "textarea-caret" {
  const getCaretCoordinates: (el: HTMLTextAreaElement, pos: number) =>
    {top: number, left: number};
  export = getCaretCoordinates;
}

declare module "vmsg" {
  interface RecordOptions {
    wasmURL?: string;
    shimURL?: string;
    pitch?: number;
  }
  interface Exports {
    record: (opts?: RecordOptions) => Promise<Blob>;
  }
  const exports: Exports;
  export default exports;
}
