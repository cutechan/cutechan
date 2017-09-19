/** Declarations for some modules with missed types. */

declare module "textarea-caret" {
  const getCaretCoordinates: (el: HTMLTextAreaElement, pos: number) =>
    {top: number, left: number};
  export = getCaretCoordinates;
}
