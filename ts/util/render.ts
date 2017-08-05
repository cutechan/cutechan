// Utility functions for reducing layout thrashing, by batching DOM writes and
// reads. Basically a stripped down version of FastDOM.
// Also contains utilities for HTML template tags.
// TODO(Kagami): Remove.

// Holds cached references to all out HTML template tags' contents
const templates: { [name: string]: DocumentFragment } = {};

// Import a prepared template and return it's HTML contents
export function importTemplate(name: string): DocumentFragment {
  return document.importNode(templates[name], true) as DocumentFragment;
}

// Load HTML templates
for (const el of document.head.querySelectorAll("template")) {
  templates[el.getAttribute("name")] = (el as HTMLTemplateElement).content;
}
