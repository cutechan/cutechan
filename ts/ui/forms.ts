import { View, ViewAttrs } from "../base";
import { importTemplate } from "../util";
import CaptchaView from "./captcha";

interface FormAttrs extends ViewAttrs {
  lazyCaptcha?: boolean;
}

// Generic input form view with optional captcha support
abstract class FormView extends View<null> {
  protected captcha: CaptchaView;
  private lazyCaptcha: boolean;

  constructor(attrs: FormAttrs) {
    super(attrs);
    this.onClick({
      ".array-add": (e) =>
        this.addInput(e, "arrayItem"),
      ".map-add": (e) =>
        this.addInput(e, "keyValue"),
      ".map-remove, .array-remove": (e) =>
        this.removeInput(e),
      "input[name=cancel]": () =>
        this.remove(),
    });
    this.on("submit", (e) =>
      this.submit(e));

    this.lazyCaptcha = attrs.lazyCaptcha;
    if (!attrs.lazyCaptcha) {
      this.initCaptcha();
    }
  }

  // Forms, that are not rendered on initialization, need to call this method
  // themselves
  public initCaptcha() {
    const captcha = this.el.querySelector(".captcha-container");
    if (captcha) {
      // Clear any previous captcha, when reusing form
      captcha.querySelector("img").removeAttribute("src");
      (captcha.querySelector(`input[name="captcha"]`) as HTMLInputElement)
        .value = "";

      this.captcha = new CaptchaView(captcha);
    }
  }

  // Also destroy captcha, if any
  public remove() {
    if (this.captcha) {
      this.captcha.remove();
    }
    super.remove();
  }

  // Load a new captcha, if present and response code is not 0
  public reloadCaptcha() {
    if (this.captcha) {
      this.captcha.reload();
    } else if (this.lazyCaptcha) {
      this.initCaptcha();
    }
  }

  protected abstract send(): void;

  // Inject captcha data into the request struct, if any
  protected injectCaptcha(req: {}) {
    if (this.captcha) {
      Object.assign(req, this.captcha.data());
    }
  }

  // Render a text comment about the response status below the form
  protected renderFormResponse(text: string) {
    this.el.querySelector(".form-response").textContent = text;
    this.reloadCaptcha();
  }

  // Submit form to server. Pass it to the assigned handler function
  private submit(event: Event) {
    event.preventDefault();
    this.send();
  }

  private addInput(event: Event, id: string) {
    (event.target as Element).before(importTemplate(id));
  }

  private removeInput(event: Event) {
    (event.target as Element).closest("span").remove();
  }
}

export default FormView;
