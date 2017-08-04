import { TabbedModal } from "../base";
import { default as options, models, optionType } from "../options";
import { hook } from "../util";

// Only instance of the options panel
export let panel: OptionsPanel;

// View of the options panel
export default class OptionsPanel extends TabbedModal {
  constructor() {
    super(document.getElementById("options"));
    panel = this;

    this.on("change", (e) =>
      this.applyChange(e));

    this.assignValues();

    hook("renderOptionValue", this.assignValue.bind(this));
  }

  // Assign loaded option settings to the respective elements in the options
  // panel
  private assignValues() {
    for (const id of Object.keys(models)) {
      const model = models[id];
      const val = model.get();
      this.assignValue(id, model.spec.type, val);
    }
  }

  // Assign a single option value. Called on changes to the options externally
  // not from the options panel
  private assignValue(id: string, type: optionType, val: any) {
    const el = document.getElementById(id) as HTMLInputElement;
    if (!el) return;

    switch (type) {
      case optionType.checkbox:
        el.checked = val as boolean;
        break;
      case optionType.number:
      case optionType.menu:
      case optionType.textarea:
        el.value = val as string || "";
        break;
      case optionType.shortcut:
        el.value = String.fromCodePoint(val as number).toUpperCase();
        break;
    }
    // 'image' type simply falls through, as those don't need to be set
  }

  // Propagate options panel changes through
  // options-panel -> options -> OptionModel
  private applyChange(event: Event) {
    const el = event.target as HTMLInputElement;
    const id = el.getAttribute("id");
    const model = models[id];

    // Not an option input element
    if (!model) {
      return;
    }

    let val: boolean | string | number;
    switch (model.spec.type) {
      case optionType.checkbox:
        val = el.checked;
        break;
      case optionType.number:
        val = parseInt(el.value, 10);
        break;
      case optionType.menu:
      case optionType.textarea:
        val = el.value;
        break;
      case optionType.shortcut:
        val = el.value.toUpperCase().codePointAt(0);
        break;
    }

    if (!model.validate(val)) {
      el.value = "";
    } else {
      options[id] = val;
    }
  }
}
