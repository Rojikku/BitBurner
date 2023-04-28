/** @param {NS} ns */
export async function main(ns) {
    // Set target of all hacking
    let hack_target = "computek";
    // Setup scripts to spread
    let nuke_script = "hack-all.js";
    let hack_script = "worm-hack.js";
    let worm_script = "ez-worm.js";
    let hack_ram = ns.getScriptRam(hack_script);
    let script_list = [nuke_script, worm_script, hack_script];

    let targets = ns.scan();
    let self = ns.getHostname();

    // Remove evidence
    ns.rm("/c2/" + self + ".txt", self);

    // Worm Spread Loop
    for (let hostname of targets) {

        // Setting up skips	
        // Skip if it's me
        if (hostname == "home") {
            continue;
        }
        // Skip if you don't have root
        if (!ns.hasRootAccess(hostname)) {
            continue;
        }
        // Handle handles, which are names based on hostname
        let handle = "/c2/" + hostname + ".txt";
        if (ns.fileExists(handle, "home")) {
            continue;
        }
        // Check if the script is already running
        // let hacked = false;
        let psList = ns.ps(hostname);
        if (psList.length > 0) {
            continue;
        }
        // for (let script of psList) {
        // 	for (let test of script_list) {
        // 		if (script.filename == test) {
        // 			hacked = true;
        // 			break;
        // 		}
        // 	}
        // }

        // // Skip if already hacked
        // if (hacked === true) {
        // 	continue;
        // }


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
        ns.exec(nuke_script, hostname, 1);
        ns.tprint(`${hostname} is spreading the worm!`);
    }

    // Start farming!
    if (self != "home") {
        let freeRam = ns.getServerMaxRam(self);
        let hackThreads = (Math.floor(freeRam / hack_ram));
        ns.tprint(`${self} has ${freeRam} of RAM, creating ${hackThreads}...`);
        if (hackThreads >= 0) {
            ns.tprint(`${self} will now run ${hack_script} with ${hackThreads} threads!`);
            ns.spawn(hack_script, hackThreads, hack_target);
        } else {
            ns.tprint(`Epic fail, it's >= 0 on ${self}!`);
        }
    }
}