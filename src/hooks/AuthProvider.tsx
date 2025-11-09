export * from './useAuth';
import * as useAuthModule from './useAuth';
// Fallback to default if named export isn't available (handles cache/compile quirks)
const Provider = (useAuthModule as any).AuthProvider ?? (useAuthModule as any).default;
export default Provider;
