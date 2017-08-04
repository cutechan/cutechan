import { CaptchaView } from "../../ui";
import { on } from "../../util";

function expand(e: Event) {
  const el = document.getElementById("new-thread-form") as HTMLElement;
  el.style.display = "block";
  const c = el.querySelector(".captcha-container");
  if (c) {
    // tslint:disable-next-line:no-unused-expression
    new CaptchaView(c);
  }
}

export default () =>
  on(document.getElementById("threads"), "click", expand, {
    passive: true,
    selector: ".new-thread-button",
  });
