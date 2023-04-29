/** @param {NS} ns */
// Main C2 Script - Run Directly

// Import Libraries
import { arrayStore, dictStore } from "/lib/db.js";
import { hack, bestValue, listHacked, scpSetup, refreshDB } from "/lib/hack.js";


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



export async function main(ns) {
    // Define shared scripts in use
    let hack_script = "/shared/hack.js";
    let grow_script = "/shared/grow.js";
    let weaken_script = "/shared/weaken.js";
    let script_list = [hack_script, grow_script, weaken_script];


    // Load server list array
    let serverdb = new arrayStore(ns, "/data/servers.txt");
    // Load server details
    let dbHandle = new dictStore(ns, "/data/db.txt");
    // Load list of hacked servers
    let hackedHandle = new arrayStore(ns, "/data/hacked.txt");

    let targetHandle = new arrayStore(ns, "/data/target.txt");

    // Setup all the variables from the refresh function
    var { servers, db, hacked, difficulties, difKeys, targets, target } = await refresh(ns, serverdb, dbHandle, hackedHandle);
    await targetHandle.write([target]);

    // If it's not hacked, hack it
    let didSomething = false;
    for (let server of servers) {
        // Do SCP setup while I'm at it
        await scpSetup(ns, server, script_list);
        if (hacked.includes(server)) {
            continue;
        }
        if (ns.getHackingLevel() >= db[server].requiredHackingSkill) {
            if (await hack(ns, server)) {
                didSomething = true;
                ns.toast(`Hacked: ${server}!`);
                hacked.push(server);
            }
        }
    }
    if (didSomething) {
        // eslint-disable-next-line no-redeclare
        var { servers, db, hacked, difficulties, difKeys, targets, target } = await refresh(ns, serverdb, dbHandle, hackedHandle);
        await targetHandle.write([target]);
    }

    for (let server of ns.getPurchasedServers()) {
        await scpSetup(ns, server, script_list);
    }

    if (hacked.length === 0) {
        ns.toast("Nothing hacked?!", "error");
        await ns.exit();
    }

    // Set next hacking level goal
    let previousGoal = (db[target].requiredHackingSkill).toString();
    let goalIndex = difKeys.indexOf(previousGoal) + 1;
    let levelGoal = difKeys.at(goalIndex);
    let origTarget = target;
    let moneyThresh = db[target].moneyMax * 0.75;
    let securityThresh = db[target].minDifficulty + 5;
    let runScript = weaken_script;

    // Set initial private server RAM value
    let ram = 8;
    // Setup RAM required for each script
    let script_ram = {};
    for (let script of script_list) {
        script_ram[script] = ns.getScriptRam(script);
    }

    // Setup private server list
    let i = 0;
    let privateServers = [];
    while (i < ns.getPurchasedServerLimit()) {
        privateServers.push("server-" + i);
        ++i;
    }
    let purchased = ns.getPurchasedServers();
    let fullStock = false;
    if (purchased.length == ns.getPurchasedServerLimit()) {
        fullStock = true;
    }
    let fullUpgrade = false;

    while (true) {
        if (ns.getHackingLevel() > parseInt(levelGoal)) {
            let newServer = difficulties[levelGoal];
            // Hack new target, and if you succeed, re-evalute
            if (await hack(ns, newServer)) {
                var { servers, db, hacked, difficulties, difKeys, targets, target } = await refresh(ns, serverdb, dbHandle, hackedHandle);
                await targetHandle.write([target]);
                ns.toast(`Hacked: ${newServer}!`);
            }
            await scpSetup(ns, newServer, script_list);
            // Increment goal index
            ++goalIndex;
            // Set next goal
            levelGoal = difKeys.at(goalIndex);
        }
        if (target != origTarget) {
            ns.toast(`Changing target to ${target}!`, "info");
            origTarget = target;
            moneyThresh = db[target].moneyMax * 0.75;
            securityThresh = db[target].minDifficulty + 5;
        }
        // Do some farming
        for (let server of targets) {
            // Decide on script
            if (ns.getServerSecurityLevel(target) > securityThresh) {
                runScript = weaken_script;
            } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
                runScript = grow_script;
            } else {
                runScript = hack_script;
            }
            // Have to use UsedRam function to get latest numbers
            let freeRam = db[server].maxRam - ns.getServerUsedRam(server);
            let hackThreads = (Math.floor(freeRam / script_ram[runScript]));
            // If it's still doing a task, let it finish
            if (hackThreads <= 0) {
                continue;
            }
            ns.exec(runScript, server, hackThreads, target);
        }

        // Manage private servers
        let bulkBuy = false;
        // If buying one is less than 10% of my money
        if (ns.getPurchasedServerMaxRam() < ram) {
            ns.print("Servers maxed?!")
        } else if (((0.10 * ns.getServerMoneyAvailable("home")) > ns.getPurchasedServerCost(ram)) || ram == 8) {
            let didBuy = false;
            let purchased = ns.getPurchasedServers();
            for (let server of privateServers) {
                if (ns.getServerMoneyAvailable("home") < ns.getPurchasedServerCost(ram)) {
                    break;
                }
                // If we're full stock, upgrade
                if (fullStock) {
                    // If the purchase price gets too much, quit buying!
                    if ((0.10 * ns.getServerMoneyAvailable("home")) < ns.getPurchasedServerCost(ram)) {
                        break;
                    }
                    // If it's below target
                    if (ns.getServerMaxRam(server) < ram) {
                        ns.killall(server); // Clear scripts
                        ns.deleteServer(server); // Delete
                        ns.purchaseServer(server, ram); // Upgrade!
                        await scpSetup(ns, server, script_list);
                        didBuy = true;
                    }
                } else { // If we're not, get to full stock!
                    if (purchased.includes(server)) {
                        continue;
                    } else {
                        let bought = ns.purchaseServer(server, ram);
                        if (bought != null) {
                            await scpSetup(ns, server, script_list);
                        }
                        didBuy = true;
                    }
                }
            }
            if (didBuy != true) {
                fullUpgrade = true;
            }
            if (fullUpgrade == true) {
                ram = ram * 2;
                fullUpgrade = false;
            }
        }

        // Private farms!
        // Call from the function to be safe
        for (let server of ns.getPurchasedServers()) {
            // Decide on script
            if (ns.getServerSecurityLevel(target) > securityThresh) {
                runScript = weaken_script;
            } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
                runScript = grow_script;
            } else {
                runScript = hack_script;
            }
            // Have to use UsedRam function to get latest numbers
            let freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            let hackThreads = (Math.floor(freeRam / script_ram[runScript]));
            // If it's still doing a task, let it finish
            if (hackThreads <= 0) {
                continue;
            }
            ns.exec(runScript, server, hackThreads, target);
        }

        // No errors
        await ns.sleep(5000);
    }
}