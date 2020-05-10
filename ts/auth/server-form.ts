import { makeFrag } from "../util";
import { AccountForm } from "./form";

// Panel for server administration controls such as global server settings
export class ServerConfigForm extends AccountForm {
  constructor() {
    super({ tag: "form" });
    this.render();
  }

  // Request current configuration and render the panel
  protected async render() {
    const res = await fetch("/html/configure-server", {
      credentials: "include",
      method: "POST",
    });
    switch (res.status) {
      case 200:
        this.el.append(makeFrag(await res.text()));
        super.render();
        break;
      case 403:
        this.handle403();
        break;
      default:
        throw await res.text();
    }
  }

  // Extract and send the configuration struct from the form
  protected send() {
    this.postResponse("/api/configure-server", (req) => this.extractForm(req));
  }
}
