// Lightweight client-side re-exports of the server RBAC helpers.
// Purpose: make it easy to import RBAC helpers into other JS projects
// (including a React Native app) by copying this file or importing from
// the repository. This file intentionally re-exports only pure helpers
// (no Next.js-specific code).

export { Roles, Permissions, can, defaultPageForRole } from '../app/lib/rbac.js';

// Note for React Native integration:
// - You can copy this file into your RN project and adjust the import
//   path to point to a local `rbac.js` that mirrors the role/permission
//   maps used here. Alternatively, add this repository as a git submodule
//   and import from the copied path.
