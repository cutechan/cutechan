import { Component } from "preact";

type BackgroundClickComponent<T = BackgroundClick> = new (...args: any[]) => T;
interface BackgroundClick extends Component<any, any> {
  render: (p?: any, s?: any) => any;
  onBackgroundClick: (e: MouseEvent) => void;
}

const handleClickProp = Symbol("handleClick");

export function BackgroundClickMixin<TBase extends BackgroundClickComponent>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this[handleClickProp] = (e: MouseEvent) => {
        if (e.button === 0) {
          this.onBackgroundClick(e);
        }
      };
    }
    public componentDidMount() {
      if (super.componentDidMount) {
        super.componentDidMount();
      }
      document.addEventListener("click", this[handleClickProp]);
    }
    public componentWillUnmount() {
      if (super.componentWillUnmount) {
        super.componentWillUnmount();
      }
      document.removeEventListener("click", this[handleClickProp]);
    }
  };
}

type EscapePressComponent<T = EscapePress> = new (...args: any[]) => T;
interface EscapePress extends Component<any, any> {
  render: (p?: any, s?: any) => any;
  onEscapePress: (e: KeyboardEvent) => void;
}

const handleKeyProp = Symbol("handleKey");

export function EscapePressMixin<TBase extends EscapePressComponent>(Base: TBase) {
  return class extends Base {
    constructor(...args: any[]) {
      super(...args);
      this[handleKeyProp] = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
          this.onEscapePress(e);
        }
      };
    }
    public componentDidMount() {
      super.componentDidMount();
      document.addEventListener("keydown", this[handleKeyProp]);
    }
    public componentWillUnmount() {
      super.componentWillUnmount();
      document.removeEventListener("keydown", this[handleKeyProp]);
    }
  };
}
