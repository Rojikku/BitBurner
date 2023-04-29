/** @param {NS} ns */

// Function that hacks all ports, and returns true if it attempts nuke
export async function hack(ns, hostname) {
    // Open all ports
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(hostname);
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(hostname);
    }
    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(hostname);
    }
    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(hostname);
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(hostname);
    }
    // Update port count
    let server = ns.getServer(hostname);

    // Skip if it requires what I don't have
    let neededPorts = (server.numOpenPortsRequired - server.openPortCount);
    if (neededPorts <= 0) {
        await ns.nuke(hostname);
        return true;
    }
    return false;
}