/** @param {NS} ns */

export function targetList(ns, difKeys, difficulties, hacked) {
    // Takes list of keys ordered from difKeys, and difficulties dictionary
    let skillLevel = ns.getHackingLevel();
    let targets = [];
    for (let level of difKeys) {
        if (level <= skillLevel) {
            let target = difficulties[level];
            if (hacked.includes(target)) {
                targets.push(target);
            }
        }
    }
    return targets;
}


// Function that loads the DB and then re-populates all contained server information
export function refreshDB(ns, db, servers = null) {
    // Takes db, refreshes
    // Optionally takes servers if db is empty

    // Define servers if undefined
    if (servers == null) {
        servers = Object.keys(db);
        if (servers.length === 0) {
            ns.alert("Error, you didn't define servers and DB is empty!")
            return {};
        }
    }
    // Update DB
    for (let server of servers) {
        db[server] = ns.getServer(server);
    }
    return db;
}


// Function that takes a target and script list, and updates via rm and SCP
export async function scpSetup(ns, target, script_list) {
    //Delete old copies
    for (let script of script_list) {
        if (ns.fileExists(script, target)) {
            ns.rm(script, target);
        }
    }
    return await ns.scp(script_list, target);
}


// Function that parses the database and returns an array of all hacked servers
export function listHacked(ns, db) {
    // Returns an array of hacked servers as hacked
    let hacked = [];
    for (let server of Object.keys(db)) {
        if (db[server].hasAdminRights) {
            hacked.push(server);
        }
    }
    return hacked;
}


// Function that checks a list of targets, and tells you which one is worth the most money
export function bestValue(ns, targets, db) {
    // Takes list of targets and server db
    let best = targets.at(-1);
    for (let target of targets) {
        try {
            if (db[target].moneyMax > db[best].moneyMax) {
                best = target;
            }
        } catch (error) {
            ns.print(`Had an error in bestValue: ${error}`);
        }
    }
    return best;
}


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


export async function refresh(ns, serverdb, dbHandle, hackedHandle) {
    let servers = await serverdb.read();
    // If the server list isn't filled, fill it.
    if (servers.length == 0) {
        let toScan = ns.scan("home");
        let mine = /server-./;
        while (toScan.length > 0) {
            let server = toScan.shift();
            // Don't include my servers in the DB
            if (mine.test(server) || server == "home" || server == "darkweb") {
                continue;
            }
            if (!servers.includes(server)) {
                servers.push(server);
                // Scan and add to list
                toScan = toScan.concat(ns.scan(server));
            }
        }
        await serverdb.write(servers);
    }


    // Refresh the server details
    let db = dbHandle.read();
    db = refreshDB(ns, db, servers);
    await dbHandle.write(db);

    // Refresh hacked status
    let hacked = listHacked(ns, db);
    await hackedHandle.write(hacked);

    // Get all levels in a dict
    let difficulties = {};
    for (let server of Object.keys(db)) {
        difficulties[db[server].requiredHackingSkill] = server;
    }
    // Setup a list of the difficulties in order
    let difKeys = Object.keys(difficulties);
    difKeys = difKeys.sort((a, b) => a - b);

    // Get ordered list of targets by difficulty
    let targets = targetList(ns, difKeys, difficulties, hacked);

    // Set hacking target to the best one
    let target = bestValue(ns, targets, db);

    return { servers, db, hacked, difficulties, difKeys, targets, target };
}