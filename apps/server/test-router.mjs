import { appRouter } from './dist/router.js';

console.log('appRouter:', appRouter);
console.log('appRouter._def:', appRouter._def);
console.log('appRouter._def.procedures:', appRouter._def.procedures);
console.log('Procedure keys:', Object.keys(appRouter._def.procedures || {}));
