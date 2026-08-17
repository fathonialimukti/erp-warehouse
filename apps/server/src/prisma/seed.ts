import "dotenv/config";
import { runSeed } from "./seed/index.js";

runSeed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
