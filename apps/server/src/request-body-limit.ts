export const maxRequestBodyBytes = 2 * 1024 * 1024;

export function createServerListenOptions(hostname: string, port: number) {
	return { hostname, port, maxRequestBodySize: maxRequestBodyBytes } as const;
}
