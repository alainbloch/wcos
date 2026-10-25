// A fair reader/writer gate keeps exports consistent and hides partial import commits.
// Lowdb is a single-process store: maintenance scripts must run with the app stopped.
export class TransferGate {
  readers = 0;
  writer = false;
  queue = [];
  acquire(exclusive = false) {
    return new Promise((resolve) => {
      this.queue.push({ exclusive, resolve });
      this.drain();
    });
  }
  drain() {
    if (this.writer) return;
    while (this.queue.length) {
      const next = this.queue[0];
      if (next.exclusive && this.readers) return;
      this.queue.shift();
      if (next.exclusive) this.writer = true;
      else this.readers++;
      let released = false;
      next.resolve(() => {
        if (released) return;
        released = true;
        if (next.exclusive) this.writer = false;
        else this.readers--;
        this.drain();
      });
      if (next.exclusive) return;
    }
  }
}
export function installTransferGate(app) {
  const gate = new TransferGate();
  app.addHook("onRequest", async (request) => {
    const exclusive =
      !["GET", "HEAD", "OPTIONS"].includes(request.method) ||
      request.url.startsWith("/admin/settings/data-transfer/export");
    request.releaseTransferGate = await gate.acquire(exclusive);
    if (request.raw.aborted) request.releaseTransferGate();
  });
  app.addHook("onRoute", (options) => {
    const handler = options.handler;
    options.handler = async function (request, reply) {
      request.transferHandlerActive = true;
      try {
        const result = await handler.call(this, request, reply);
        // Static handlers may schedule stream delivery and return undefined.
        // Wait for their reply instead of ending the response with an empty body.
        return result === undefined ? await reply : result;
      } finally {
        request.transferHandlerActive = false;
        request.releaseTransferGate?.();
      }
    };
  });
  app.addHook("onRequestAbort", async (request) => {
    if (!request.transferHandlerActive) request.releaseTransferGate?.();
  });
  app.addHook("onResponse", async (request) => request.releaseTransferGate?.());
}
