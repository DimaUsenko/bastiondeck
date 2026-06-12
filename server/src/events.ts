import { EventEmitter } from "node:events";
import type { LogLine, WireTunnel } from "./types.js";

// Lightweight pub/sub bridging the manager to SSE routes.
//   "tunnels" -> full snapshot whenever any tunnel's state changes
//   "log:<id>" -> a new log line for one tunnel

class Hub extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0); // many SSE subscribers
  }

  emitTunnels(tunnels: WireTunnel[]): void {
    this.emit("tunnels", tunnels);
  }

  onTunnels(fn: (tunnels: WireTunnel[]) => void): () => void {
    this.on("tunnels", fn);
    return () => this.off("tunnels", fn);
  }

  emitLog(id: string, line: LogLine): void {
    this.emit(`log:${id}`, line);
  }

  onLog(id: string, fn: (line: LogLine) => void): () => void {
    const evt = `log:${id}`;
    this.on(evt, fn);
    return () => this.off(evt, fn);
  }
}

export const hub = new Hub();
