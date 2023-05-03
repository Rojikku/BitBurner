/** @param {NS} ns */
// Main C2 Script - Run Directly

// Import Libraries
import { arrayStore, dictStore } from "/lib/db.js";
import { hack, scpSetup, refresh, checkProgs } from "/lib/hack.js";


export async function main(ns) {

    // Prevent unnecessary debug
    ns.disableLog("ALL");

    // Define shared scripts in use
    let hack_script = "/shared/hack.js";
    let grow_script = "/shared/grow.js";
    let weaken_script = "/shared/weaken.js";
    let share_script = "/shared/share.js";
    let script_list = [hack_script, grow_script, weaken_script, share_script];


    // Load server list array - Static per run
    let serverdb = new arrayStore(ns, "/data/servers.txt");
    // Load server details - Has to be updated constantly
    let dbHandle = new dictStore(ns, "/data/db.txt");
    // Load list of hacked servers - Updated each hack
    let hackedHandle = new arrayStore(ns, "/data/hacked.txt");
    // File that lists the next target of hacking - Updated as level raises
    let targetHandle = new arrayStore(ns, "/data/target.txt");
    // Time since last augmentation, updated each refresh
    let augHandle = new arrayStore(ns, "/data/aug.txt");
    // File that lists expected completion of current task
    let timeHandle = new arrayStore(ns, "/data/timer.txt");
    // Purchase server money handle
    let purchaseHandle = new arrayStore(ns, "/data/purchase.txt");

    // Handle progs
    // Array that contains an integer referencing how many programs I own
    let progsHandle = new arrayStore(ns, "/data/progs.txt");
    // List of all programs used for hacking
    let progsList = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"]
    let maxProgs = progsList.length;
    let progs = checkProgs(ns, progsList);
    // If progs are maxed, set it to false so it won't check later
    if (progs == maxProgs) {
        maxProgs = false;
    }
    await progsHandle.write(progs);

    // Setup all the variables from the refresh function
    var { servers, db, hacked, difficulties, difKeys, target } = await refresh(ns, serverdb, dbHandle, hackedHandle, augHandle);
    await targetHandle.write([target]); // Save next target

    // Variable explanation
    // Servers is a list of all servers in the game, array
    // db is a getServers of all servers in the game, dict
    // hacked is a list of all hacked servers, array
    // difficulties is a dict of all servers, with the required hacking level as the key, dict
    // difKeys is the keys for difficulties, sorted in level order
    // target highest payout of hacked

    // SCP setup privateServers servers, if we already have them
    for (let server of ns.getPurchasedServers()) {
        await scpSetup(ns, server, script_list);
    }

    // Set next hacking level goal

    // Get the current target's hacking level as a string
    let previousGoal = (db[target].requiredHackingSkill).toString();
    // Get the index of the next goal based on previous goal
    let goalIndex = difKeys.indexOf(previousGoal) + 1;
    // Get the level of the next goal
    let levelGoal = difKeys.at(goalIndex);
    // Save current target for later comparison
    let origTarget = target;
    // Set thresholds for the target
    let moneyThresh = db[target].moneyMax * 0.75;
    let securityThresh = db[target].minDifficulty + 5;
    // Define the script to run
    let runScript = weaken_script;



    // Set initial private server RAM value
    let ram = 8;
    // Setup a dict with RAM required for each script
    let script_ram = {};
    for (let script of script_list) {
        script_ram[script] = ns.getScriptRam(script);
    }

    // Setup private server shopping list
    let i = 0;
    let serversShoppingList = [];
    while (i < ns.getPurchasedServerLimit()) {
        serversShoppingList.push("server-" + i);
        ++i;
    }
    // Array of all owned servers
    let privateServers = ns.getPurchasedServers()
    // Check if we are fully stocked on servers
    let fullStock = false;
    if (privateServers.length == ns.getPurchasedServerLimit()) {
        fullStock = true;
    }
    // Variable that will count how many programs we have for hacking
    let oldprogs = progs;
    // Variable if we should hack new servers
    let runHack = true;
    // Variable to stop upgrading once all private servers are maxed
    let serversMaxed = false;

    // Pool of servers for work
    let pool = hacked.concat(privateServers);

    // eslint-disable-next-line no-constant-condition
    while (true) {

        // Count progs if they're not maxed
        if (maxProgs) {
            progs = checkProgs(ns, progsList);
            if (progs == maxProgs) {
                maxProgs = false;
            }
            // If there's new programs, re-hack
            if (progs != oldprogs) {
                runHack = true;
                oldprogs = progs;
                await progsHandle.write(progs);
            }
        }

        // If I have reached  my hacking level goal, update my goal
        while (ns.getHackingLevel() >= parseInt(levelGoal)) {
            // Increment goal index
            ++goalIndex;
            // Set next goal
            levelGoal = difKeys.at(goalIndex);
            // Run hack function
            runHack = true;
        }

        // If ordered, hack more things
        if (runHack) {
            let didSomething = false;
            for (let server of servers) {
                // Skip if already hacked
                if (hacked.includes(server)) {
                    continue;
                }
                // Do SCP setup while I'm already looping
                await scpSetup(ns, server, script_list);
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
                var { servers, db, hacked, difficulties, difKeys, target } = await refresh(ns, serverdb, dbHandle, hackedHandle, augHandle);
                if (target != origTarget) {
                    await targetHandle.write([target]);
                    ns.toast(`Changing target to ${target}!`, "info");
                    origTarget = target;
                    moneyThresh = db[target].moneyMax * 0.75;
                    securityThresh = db[target].minDifficulty + 5;
                }
            }
            // Set runHack status back to false
            runHack = false;
        }

        // If servers aren't maxed, consider upgrading
        if (!serversMaxed) {

            // Track if I buy something
            let didBuy = false;
            // Track if I quit because can't afford
            let poor = false;

            // If I'm not fully stocked
            if (!fullStock) {
                // Update variable
                privateServers = ns.getPurchasedServers();
                // While I can afford upgrades
                while ((0.10 * ns.getServerMoneyAvailable("home")) > ns.getPurchasedServerCost(ram)) {
                    let server = serversShoppingList.pop()
                    // If, against all odds, the server is already owned, then don't even try it
                    // Might happen if script is restarted
                    if (privateServers.includes(server)) {
                        continue;
                    }
                    let bought = ns.purchaseServer(server, ram);
                    if (bought != null) {
                        await scpSetup(ns, server, script_list);
                        didBuy = true;
                    } else {
                        // Else, if failed to buy, put it back in the list.
                        serversShoppingList.unshift(server);
                    }
                }
                if (serversShoppingList.length == 0) {
                    fullStock == true;
                } else {
                    await purchaseHandle.write(ns.getPurchasedServerCost(ram))
                }
            }
            // If I have purchased all servers
            if (fullStock) {
                // Loop through my servers to buy upgrades
                // Update variable
                privateServers = ns.getPurchasedServers();
                for (let server of privateServers) {
                    // If requirement already met, skip
                    if (ns.getServerMaxRam(server) >= ram) {
                        continue;
                    }
                    // If it costs more than 10%, break
                    if ((0.10 * ns.getServerMoneyAvailable("home")) < ns.getPurchasedServerUpgradeCost(server, ram)) {
                        poor = true;
                        await purchaseHandle.write(ns.getPurchasedServerUpgradeCost(server, ram))
                        break;
                    } else {
                        ns.upgradePurchasedServer(server, ram);
                        didBuy = true;
                    }
                }
            }

            // Do final checks after upgrades/purchases
            if (didBuy == true) {
                // Update variable
                privateServers = ns.getPurchasedServers();
            } else if (!poor && fullStock) {
                // If I didn't buy anything, and I've bought all servers, and I didn't cancel because of being poor, I probably should go to the next level
                ram = ram * 2;
            }
            // If I can't buy more, stop trying
            if (ns.getPurchasedServerMaxRam() < ram) {
                serversMaxed = true;
                await purchaseHandle.write("Maxed")
            }
        }


        // Make a pool of all servers I can use
        pool = hacked.concat(privateServers);

        // Decide on script
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            runScript = weaken_script;
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            runScript = grow_script;
        } else {
            runScript = hack_script;
        }

        // Do some farming
        for (let server of pool) {
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