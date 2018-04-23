import { AccountForm } from "./form";

// Panel view for creating boards
export class BoardCreationForm extends AccountForm {
  constructor() {
    super({ tag: "form" });
    this.renderPublicForm("/html/create-board");
  }

  protected send() {
    this.postResponse("/api/create-board", (req) => {
      req.id = this.inputElement("boardName").value;
      req.title = this.inputElement("boardTitle").value;
    });
  }
}
