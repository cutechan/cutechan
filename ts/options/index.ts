/**
 * User-set settings storage and change handling.
 */

import { config } from "../state";
import { ChangeEmitter, emitChanges, trigger } from "../util";

interface Options extends ChangeEmitter {
  theme: string;
  popupBackdrop: boolean;
  imageHover: boolean;
  relativeTime: boolean;
  notification: boolean;
  scrollToBottom: boolean;
  workModeToggle: boolean;
  workMode: number;
  newPost: number;
  cancelPost: number;
  selectFile: number;
  previewPost: number;
  bold: number;
  italic: number;
  spoiler: number;
  volume: number;
}

// Types of option models
export const enum optionType {
  checkbox, number, image, shortcut, menu, textarea,
}

// Full schema of the option interface
interface OptionSpec {
  // Type of option. Determines storage and rendering method. Defaults to
  // 'checkbox', if omitted.
  type?: optionType;

  // Default value. false, if omitted.
  default?: any;

  // Function to execute on option change
  exec?: (val?: any) => void;

  // Should the function not be executed on model population?
  noExecOnStart?: boolean;

  // Function that validates the users input
  validation?: (val: any) => boolean;
}

// Specifications of option behavior, where needed. Some properties defined as
// getters to prevent race with "state" module
const specs: { [id: string]: OptionSpec } = {
  // Boss key toggle
  workModeToggle: {
    default: false,
    exec: (on) => {
      document.documentElement.classList.toggle("work-mode", on);
    },
    type: optionType.checkbox,
  },
  // Backdrop clicking
  popupBackdrop: {
    default: true,
  },
  // Image hover expansion
  imageHover: {
    default: true,
  },
  // Desktop Notifications
  notification: {
    default: false,
    exec(enabled: boolean) {
      const req = enabled
        && typeof Notification === "function"
        && (Notification as any).permission !== "granted";
      if (req) {
        Notification.requestPermission();
      }
    },
  },
  // Relative post timestamps
  relativeTime: {
    default: true,
  },
  // Scroll to bottom
  scrollToBottom: {
    default: true,
  },
  // Change theme
  theme: {
    get default() {
      return config.defaultCSS;
    },
    exec(theme: string) {
      if (!theme) {
        return;
      }
      document
        .getElementById("theme-css")
        .setAttribute("href", `/static/css/${theme}.css`);
    },
    noExecOnStart: true,
    type: optionType.menu,
  },
  // Shortcuts.
  workMode: {
    default: 65,
    type: optionType.shortcut,
  },
  newPost: {
    default: 78,
    type: optionType.shortcut,
  },
  cancelPost: {
    default: 67,
    type: optionType.shortcut,
  },
  selectFile: {
    default: 79,
    type: optionType.shortcut,
  },
  previewPost: {
    default: 69,
    type: optionType.shortcut,
  },
  bold: {
    default: 66,
    type: optionType.shortcut,
  },
  italic: {
    default: 73,
    type: optionType.shortcut,
  },
  spoiler: {
    default: 80,
    type: optionType.shortcut,
  },
  // Other settings.
  volume: {
    default: 1,
  },
};

// Central options storage model.
const options: Options = (() => {
  // Need to define all properties ahead of time for the ES5 Proxy
  // polyfill to work.
  const opts = {} as Options;
  for (const k of Object.keys(specs)) {
    opts[k] = undefined;
  }
  return emitChanges(opts);
})();
export default options;

// All loaded option models
export const models: { [key: string]: OptionModel } = {};

// Controller for each individual option
class OptionModel {
  public id: string;
  public spec: OptionSpec;

  // Create new option model from template spec
  constructor(id: string, spec: OptionSpec) {
    this.spec = spec;
    this.id = id;

    // No type = checkbox + default false
    if (!spec.type) {
      spec.type = optionType.checkbox;
    }

    // Store option value in central storage options Model
    const val = options[this.id] = this.get();
    options.onChange(this.id, (v) => this.onChange(v));
    if (!spec.noExecOnStart) {
      this.execute(val);
    }
    models[this.id] = this;
  }

  // Retrieve option value from storage and parse result. If none, return
  public get(): any {
    const stored = this.read();
    if (!stored) {
      return this.spec.default;
    } else {
      if (stored === "false") {
        return false;
      }
      if (stored === "true") {
        return true;
      }
      const num = +stored;
      if (num || num === 0) {
        return num;
      }
      return stored;
    }
  }

  // Execute handler function, if any
  public execute(val: any) {
    if (this.spec.exec) {
      this.spec.exec(val);
    }
  }

  // Write value to localStorage, if needed
  public set(val: any) {
    if (val !== this.spec.default || this.read()) {
      localStorage.setItem(this.id, val.toString());
    }
    trigger("renderOptionValue", this.id, this.spec.type, val);
  }

  // Perform value validation, if any. Otherwise return true.
  public validate(val: any): boolean {
    if (this.spec.validation) {
      return this.spec.validation(val);
    }
    return true;
  }

  // Read value from localStorage
  private read(): string {
    return localStorage.getItem(this.id) || "";
  }

  // Handler to be executed on field change in central options storage model
  private onChange(val: any) {
    this.execute(val);
    this.set(val);
  }
}

export function init() {
  // Populate option model collection and central model
  for (const id of Object.keys(specs)) {
    // tslint:disable-next-line:no-unused-expression
    new OptionModel(id, specs[id]);
  }
}
