/** @param {NS} ns */
export async function main(ns) {
    let cleanup_script = "ez-cleanup.js";
    let script_list = [cleanup_script]

    let targets = ns.scan();
    let self = ns.getHostname();

    // Worm Spread Loop
    for (let hostname of targets) {

        // Setting up skips	
        // Skip if you don't have root
        if (!ns.hasRootAccess(hostname)) {
            continue;
        }
        // Handle handles, which are names based on hostname
        let handle = hostname + ".txt";
        if (ns.fileExists(handle, hostname)) {
            ns.rm(handle, hostname);
        }

        // Script body
        // Delete anything from script list on target
        for (let script of script_list) {
            if (ns.fileExists(script, hostname)) {
                ns.rm(script, hostname);
            }
        }

        // Update Scripts
        await ns.scp(script_list, hostname);
        // ns.tprint(`Updated scripts on: ${hostname}.`)

        // Spread the Worm!
        ns.exec(cleanup_script, hostname, 1);
        ns.tprint(`${hostname} is spreading the cleanup!`);
    }
}