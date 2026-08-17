# Architecture Notes / 架构说明

`dsh-plugin-weaknet-adaptor` has a Host half and a browser half.

## Host

- The plugin wraps `llm/stream` with `global + prepend`.
- Online mode preserves native streaming and observes terminal failures.
- Degraded mode buffers one attempt, retries network-class failures with bounded exponential backoff, then returns one coherent stream to the agent loop.
- A heartbeat probes the configured URL while degraded. Successful probes, or any successful model stream, restore online state.
- Parameters persist best-effort below the workspace `.dsh/` directory.

## Client ↔ Host transport

The Host exposes `weaknet` methods as `@Remote` SRC markers for discovery, and also registers a dedicated **`/weaknet` RPC channel** through `connection.rpc.handle()`.

The browser settings page uses the dedicated channel directly:

```text
ctx.connection.rpc.call('/weaknet', method, { args })
```

Why not rely on `/api/weaknet/*`? The built-in Typert gateway collects SRC claims with `ctx.get(serviceKey)`. Cordis service lookup follows the fiber parent chain, so a service supplied by a sibling plugin fiber may be invisible to the gateway. A dedicated channel avoids this cross-fiber visibility boundary.

## Client Remote contribution

The browser still mounts a `WEAKNET_REMOTE` contribution with `ctx.remote.$mount()` so the namespace is discoverable to the gateway and other client integrations. The settings UI does not depend on that namespace's fiber visibility.

## UI

- `settings.section` provides the editable settings page.
- `conversation.composer.dock` provides a low-attention WiFi status readout.
- Green means online, amber means degraded, red means repeated heartbeat failures crossed the configured threshold.
