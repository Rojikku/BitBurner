/** @param {NS} ns */
// Main C2 Script - Run Directly

// Import Libraries
import { arrayStore, dictStore } from "/lib/db.js";
import { hack, scpSetup, refresh } from "/lib/hack.js";


export async function main(ns) {
    // Define shared scripts in use
    let hack_script = "/shared/hack.js";
    let grow_script = "/shared/grow.js";
    let weaken_script = "/shared/weaken.js";
    let share_script = "/shared/share.js";
    let script_list = [hack_script, grow_script, weaken_script, share_script];


    // Load server list array
    let serverdb = new arrayStore(ns, "/data/servers.txt");
    // Load server details
    let dbHandle = new dictStore(ns, "/data/db.txt");
    // Load list of hacked servers
    let hackedHandle = new arrayStore(ns, "/data/hacked.txt");
    // File that lists the next target of hacking
    let targetHandle = new arrayStore(ns, "/data/target.txt");

    // Setup all the variables from the refresh function
    var { servers, db, hacked, difficulties, difKeys, targets, target } = await refresh(ns, serverdb, dbHandle, hackedHandle);
    await targetHandle.write([target]); // Save next target

    // If it's not hacked, hack it
    let didSomething = false;
    for (let server of servers) {
        // Do SCP setup while I'm already looping
        await scpSetup(ns, server, script_list);
        // Skip if already hacked
        if (hacked.includes(server)) {
            continue;
        }
        // If I have the level to hack it, hack it. If I hack it, set refresh variable to true
        if (ns.getHackingLevel() >= db[server].requiredHackingSkill) {
            if (await hack(ns, server)) {
                didSomething = true;
                ns.toast(`Hacked: ${server}!`);
                hacked.push(server);
            }
        }
    }

    // Refresh if needed
    if (didSomething) {
        // eslint-disable-next-line no-redeclare
        var { servers, db, hacked, difficulties, difKeys, targets, target } = await refresh(ns, serverdb, dbHandle, hackedHandle);
        await targetHandle.write([target]);
    }

    // SCP setup purchased servers
    for (let server of ns.getPurchasedServers()) {
        await scpSetup(ns, server, script_list);
    }

    // If we somehow have nothign to run on,  quit out
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

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // If I have reached  my hacking level goal, hack it
        while (ns.getHackingLevel() >= parseInt(levelGoal)) {
            let newServer = difficulties[levelGoal];
            // Hack new target, and if you succeed, re-evalute
            if (await hack(ns, newServer)) {
                // eslint-disable-next-line no-redeclare
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