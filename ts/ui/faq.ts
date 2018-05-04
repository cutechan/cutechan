import { HeaderModal } from "../base";

const faqTemplate = `
cutechan is licensed under the
<a href="https://www.gnu.org/licenses/agpl.html" target="_blank"
>GNU Affero General Public License</a>
<br>

source code repository:
<a href="https://github.com/cutechan/cutechan" target="_blank"
>github.com/cutechan/cutechan</a>
<br>

original project:
<a href="https://github.com/bakape/meguca" target="_blank"
>github.com/bakape/meguca</a>
<br>

contacts:
<a href="mailto:kagami@genshiken.org"
>kagami@genshiken.org</a>
`;

class FAQPanel extends HeaderModal {
  constructor() {
    super(
      document.querySelector(".faq-modal"),
      document.querySelector(".header-faq-icon"),
    );
  }

  protected showHook() {
    this.el.innerHTML = faqTemplate;
  }
}

export default FAQPanel;
