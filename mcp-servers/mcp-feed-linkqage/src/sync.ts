import { LinkqageMCPServer } from './index';

async function main() {
    const server = new LinkqageMCPServer();
    try {
        const result = await server.syncProducts();
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
