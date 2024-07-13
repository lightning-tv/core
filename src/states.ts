import { isArray, isString } from './utils.js';

export type NodeStates =
  | string[]
  | string
  | Record<string, boolean | undefined>;

export default class States extends Array<string> {
  private onChange: () => void;

  constructor(callback: () => void, initialState: NodeStates = {}) {
    if (isArray(initialState)) {
      super(...initialState);
    } else if (isString(initialState)) {
      super(initialState);
    } else {
      super(
        ...Object.entries(initialState)
          .filter(([_key, value]) => value)
          .map(([key]) => key),
      );
    }

    this.onChange = callback;
    return this;
  }

  has(state: string) {
    return this.indexOf(state) >= 0;
  }

  is(state: string) {
    return this.indexOf(state) >= 0;
  }

  add(state: string) {
    if (this.has(state)) {
      return;
    }
    this.push(state);
    this.onChange();
  }

  toggle(state: string, force?: boolean) {
    if (force === true) {
      if (!this.has(state)) {
        this.add(state);
      }
    } else if (force === false) {
      if (this.has(state)) {
        this.remove(state);
      }
    } else {
      if (this.has(state)) {
        this.remove(state);
      } else {
        this.add(state);
      }
    }
  }

  remove(state: string) {
    const stateIndexToRemove = this.indexOf(state);
    if (stateIndexToRemove >= 0) {
      this.splice(stateIndexToRemove, 1);
      this.onChange();
    }
  }
}
