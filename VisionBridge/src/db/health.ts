import dotenv = require('dotenv');
dotenv.config({ quiet: true } as any);

import { closePool, getDatabaseHealthReport } from './pool';

async function main(): Promise<void> {
    try {
        const report = await getDatabaseHealthReport();
        // Safe output only: no DATABASE_URL, hostnames with creds, passwords, or connection strings.
        console.log(JSON.stringify(report));
        if (!report.configured) {
            process.exitCode = 0;
            return;
        }
        process.exitCode = report.connected ? 0 : 1;
    } catch (err) {
        console.log(JSON.stringify({ configured: false, connected: false, errorCode: (err as any)?.code || 'HEALTH_CHECK_ERROR' }));
        process.exitCode = 1;
    } finally {
        try {
            await closePool();
        } catch {
            // ignore
        }
    }
}

if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    main();
}
