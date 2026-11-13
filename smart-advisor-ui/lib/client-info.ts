import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';
import { VisitorLog } from './database';

export async function getClientInfo(): Promise<VisitorLog> {
    try {
        const headersList = await headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
        const userAgent = headersList.get('user-agent') || '';

        // Parse User Agent
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        return {
            ip_address: ip,
            user_agent: userAgent,
            device_vendor: result.device.vendor || 'unknown',
            device_model: result.device.model || 'unknown',
            os_name: result.os.name || 'unknown',
            os_version: result.os.version || 'unknown',
            browser_name: result.browser.name || 'unknown'
        };
    } catch (e) {
        // During static generation, headers() is not available
        // Return default values instead of throwing
        if (e instanceof Error && e.message.includes('Dynamic server usage')) {
            return {
                ip_address: 'unknown',
                user_agent: 'unknown',
                device_vendor: 'unknown',
                device_model: 'unknown',
                os_name: 'unknown',
                os_version: 'unknown',
                browser_name: 'unknown'
            };
        }
        console.error("[getClientInfo] Error:", e);
        return {
            ip_address: 'unknown',
            user_agent: 'unknown',
            device_vendor: 'unknown',
            device_model: 'unknown',
            os_name: 'unknown',
            os_version: 'unknown',
            browser_name: 'unknown'
        };
    }
}
