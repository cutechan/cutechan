import { accountPanel } from "..";
import { showAlert } from "../../alerts";
import lang from "../../lang";
import { FormView } from "../../ui";
import { Dict, makeFrag, postJSON, uncachedGET } from "../../util";

// Generic input form that is embedded into AccountPanel
export abstract class AccountForm extends FormView {
  // Unhide the parent AccountPanel, when this view is removed
  public remove() {
    super.remove();
    accountPanel.toggleMenu(true);
  }

  // Reset any views and state on 403, which means an inconsistency between
  // the client's assumptions about its permissions and the actual permissions
  // stored in the database (likely because of session expiry).
  public handle403() {
    this.remove();
    showAlert(lang.ui.sessionExpired);
  }

  // Render a form field and embed the input fields inside it. Then append it
  // to the parent view.
  protected render() {
    accountPanel.toggleMenu(false);
    accountPanel.el.append(this.el);
  }

  // Render a simple publically available form, that does not require to
  // submit any private information
  protected async renderPublicForm(url: string) {
    const res = await uncachedGET(url);
    switch (res.status) {
      case 200:
        this.el.append(makeFrag(await res.text()));
        this.render();
        break;
      case 403:
        this.handle403();
        break;
      default:
        throw await res.text();
    }
  }

  // Send a POST request with a JSON body to the server and remove the view.
  // In case of errors, render them to the .form-response.
  // Use fn to add any data to the request object.
  protected async postResponse(url: string, fn: (data: Dict) => void) {
    const data = {};
    fn(data);
    await this.handlePostResponse(await postJSON(url, data));
  }

  // Handle the response of a POST request
  protected async  handlePostResponse(res: Response) {
    switch (res.status) {
      case 200:
        this.remove();
        break;
      case 403:
        this.handle403();
        break;
      default:
        this.renderFormResponse(await res.text());
    }
  }

  // Extract values from an input form and add them to the request map
  protected extractForm(req: {}) {
    const els: NodeListOf<HTMLInputElement> = this.el
      .querySelectorAll("input[name], select[name], textarea[name]");
    for (const el of els) {
      let val: any;
      switch (el.type) {
        case "submit":
        case "button":
          continue;
        case "checkbox":
          val = el.checked;
          break;
        case "number":
          val = parseInt(el.value, 10);
          break;
        default:
          val = el.value;
      }
      req[el.name] = val;
    }

    // Read all key-value maps
    for (const map of this.el.querySelectorAll(".map-form")) {
      const fields: NodeListOf<HTMLInputElement> =
        map.querySelectorAll(".map-field");
      if (!fields.length) {
        continue;
      }

      const m: { [key: string]: string } = {};
      for (let i = 0; i < fields.length; i += 2) {
        m[fields[i].value] = fields[i + 1].value;
      }
      req[map.getAttribute("name")] = m;
    }

    // Read all array forms
    for (const ar of this.el.querySelectorAll(".array-form")) {
      const fields =
        [...ar.querySelectorAll(".array-field")] as HTMLInputElement[];
      if (fields.length) {
        req[ar.getAttribute("name")] = fields.map((f) =>
          f.value);
      }
    }

    return req;
  }
}
