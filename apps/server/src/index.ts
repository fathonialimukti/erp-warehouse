import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "./router.js";

const port = Number(process.env.PORT ?? 2022);

const server = createHTTPServer({
    middleware: cors(),
    router: appRouter,
    createContext() {
        return {};
    },
});

server.listen(port);
console.log(`tRPC server listening on http://localhost:${port}`);
