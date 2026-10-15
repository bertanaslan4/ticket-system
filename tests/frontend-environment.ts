import { builtinEnvironments } from "vitest/environments";
// React Router uses Node's Request; keep its matching AbortSignal implementation.
export default {
  name: "ticket-jsdom",
  transformMode: "web",
  async setup(global, options) {
    const { AbortController, AbortSignal } = global;
    const env = await builtinEnvironments.jsdom.setup(global, options);
    // jsdom does not implement native dialog operations; browser QA covers focus containment.
    global.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    global.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    global.AbortController = AbortController;
    global.AbortSignal = AbortSignal;
    return env;
  },
};
