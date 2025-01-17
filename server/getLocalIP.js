import os from 'os';

export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(interfaces)) {
        const networkInterface = interfaces[interfaceName];
        for (const network of networkInterface) {
            // IPv4アドレスのみを取得し、ループバックアドレス(127.0.0.1)は除外
            if (network.family === 'IPv4' && !network.internal) {
                return network.address;
            }
        }
    }
    return 'localhost'; // IPアドレスが見つからない場合
}
