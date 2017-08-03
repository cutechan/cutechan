/**
 * Conditional display widget.
 */

// tslint:disable-next-line:interface-name
interface Props {
  show: boolean;
  children?: [JSX.Element];
}

export default function({ show, children }: Props): JSX.Element {
  return show ? children[0] : null;
}
