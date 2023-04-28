/** @param {NS} ns */
export async function main(ns) {
    for (let hostname of ns.getPurchasedServers()) {
        ns.killall(hostname);
        ns.deleteServer(hostname);
        ns.tprint(`Deleted server ${hostname}`);
    }
}