/// <reference types="vite/client" />

// Provide minimal NodeJS namespace shims so browser code that types timers
// as `NodeJS.Timeout` / `NodeJS.Timer` compiles without @types/node.
declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
  type Timer = ReturnType<typeof setTimeout>;
  type Immediate = ReturnType<typeof setTimeout>;
}
