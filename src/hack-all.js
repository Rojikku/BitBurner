/** @param {NS} ns */
export async function main(ns) {
    let self = ns.getHostname();
    // Open handle to stop redundancy
    let handle = "/c2/" + self + ".txt";
    await ns.write(handle, "hack", "w");
    if (!(self == "home")) {
        await ns.scp(handle, "home", self);
    }

    // Script name variable
    let worm_script = "ez-worm.js";
    let targets = ns.scan();
    for (let hostname of targets) {
        // Skip self
        if (hostname == "home") {
            continue;
        }
        // Scan
        let server = ns.getServer(hostname);
        // ns.tprint(`Attempting ${hostname}...`);
        // If it's not already hacked
        if (!server.hasAdminRights) {
            // ns.tprint(`${hostname} does not have Admin.`);
            // Skip if impossible
            if (server.requiredHackingSkill > ns.getHackingLevel()) {
                ns.tprint(`${hostname} requires ${server.requiredHackingSkill}, skipping.`);
                continue;
            } // else {
            // ns.tprint(`${hostname} skill req met.`);
            // }

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
            // Update port count
            server = ns.getServer(hostname);

            // Skip if it requires what I don't have
            let neededPorts = (server.numOpenPortsRequired - server.openPortCount);
            if (neededPorts > 0) {
                ns.tprint(`${hostname} requires too many (${neededPorts}) open ports, giving up.`);
                continue;
            }

            // Hack
            ns.tprint(`${hostname} is now being hacked.`)
            await ns.nuke(hostname);
        }
        // } else {
        // 	ns.tprint(`${hostname} is already hacked.`)
        // }
    }
    ns.spawn(worm_script, 1);
}