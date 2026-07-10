import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../server/src/router";

const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "http://localhost:2022" })],
});

async function testGreetingIntegration() {
    console.log("🔍 Testing tRPC greeting integration...");

    try {
        // Test greeting query
        const greetingResult = await trpcClient.greeting.query({ name: "Integration Test" });
        console.log("✅ Greeting query works:", greetingResult);

        // Test createGreeting mutation
        const mutationResult = await trpcClient.createGreeting.mutate({ name: "Test User" });
        console.log("✅ CreateGreeting mutation works:", mutationResult);

        console.log("🎉 tRPC greeting integration is fully working!");
    } catch (error) {
        console.error("❌ Integration test failed:", error);
    }
}

testGreetingIntegration();