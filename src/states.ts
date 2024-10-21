import { isArray, isString } from './utils.js';

type DollarString = `$${string}`;
export type NodeStates =
  | DollarString[]
  | DollarString
  | Record<DollarString, boolean | undefined>;

export default class States extends Array<DollarString> {
  private onChange: () => void;

  constructor(callback: () => void, initialState: NodeStates = {}) {
    if (isArray(initialState)) {
      super(...initialState);
    } else if (isString(initialState)) {
      super(initialState as DollarString); // Assert as DollarString
    } else {
      super(
        ...Object.entries(initialState)
          .filter(([_key, value]) => value)
          .map(([key]) => key as DollarString), // Assert as DollarString
      );
    }

    this.onChange = callback;
    return this;
  }

  has(state: DollarString) {
    // temporary check for $ prefix
    return this.indexOf(state) >= 0 || this.indexOf(`$${state}`) >= 0;
  }

  is(state: DollarString) {
    return this.indexOf(state) >= 0;
  }

  add(state: DollarString) {
    if (this.has(state)) {
      return;
    }
    this.push(state);
    this.onChange();
  }

  toggle(state: DollarString, force?: boolean) {
    if (force === true) {
      this.add(state);
    } else if (force === false) {
      this.remove(state);
    } else {
      if (this.has(state)) {
        this.remove(state);
      } else {
        this.add(state);
      }
    }
  }

  merge(newStates: NodeStates) {
    if (isArray(newStates)) {
      this.length = 0; // Clear the current states
      this.push(...newStates);
    } else if (isString(newStates)) {
      this.length = 0; // Clear the current states
      this.push(newStates as DollarString); // Assert as DollarString
    } else {
      for (const state in newStates) {
        this.toggle(
          state as DollarString,
          newStates[state as keyof NodeStates],
        );
      }
    }
    return this;
  }

  remove(state: DollarString) {
    const stateIndexToRemove = this.indexOf(state);
    if (stateIndexToRemove >= 0) {
      this.splice(stateIndexToRemove, 1);
      this.onChange();
    }
  }
}
