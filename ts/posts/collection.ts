import { Model } from "../base";
import { Post } from "./model";

// Holds a collection of Post models
export default class PostCollection extends Model {
  // Retrieve a model by ID from all PostCollections in reverse collection
  // creation order
  public static getFromAll(id: number): Post {
    for (const col of [...PostCollection.all].reverse()) {
      const m = col.get(id);
      if (m) {
        return m;
      }
    }
    return null;
  }

  private static all = new Set<PostCollection>();

  private models: { [key: string]: Post } = {};

  constructor() {
    super();
    PostCollection.all.add(this);
  }

  // Remove a collection from the global registry
  public unregister() {
    PostCollection.all.delete(this);
  }

  // Retrieve a model by its ID
  public get(id: number): Post {
    return this.models[id];
  }

  // Add model to collection
  public add(model: Post) {
    this.models[model.id] = model;
    model.collection = this;
  }

  // Remove model from the collection
  public remove(model: Post) {
    delete this.models[model.id];
    delete model.collection;
  }

  public removeThread(opModel: Post) {
    for (const model of this) {
      if (model.op === opModel.id) {
        this.remove(model);
      }
    }
  }

  // Remove all models from collection
  public clear() {
    for (const id of Object.keys(this.models)) {
      delete this.models[id].collection;
    }
    this.models = {};
  }

  // Return weather a post exists in the collection
  public has(id: number): boolean {
    return id in this.models;
  }

  // Make collections iterable
  public *[Symbol.iterator](): IterableIterator<Post> {
    yield* Object
      .keys(this.models)
      .map((key) =>
        this.models[key]);
  }
}
