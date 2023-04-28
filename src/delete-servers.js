/** @param {NS} ns */
// Script to delete all owned servers
export async function main(ns) {
    for (let hostname of ns.getPurchasedServers()) {
        ns.killall(hostname);
        ns.deleteServer(hostname);
        ns.tprint(`Deleted server ${hostname}`);
    }
}