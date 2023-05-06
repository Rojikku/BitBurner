/** @param {NS} ns */
// Main C2 Script - Run Directly

// Import Libraries
import { arrayStore, dictStore } from "/lib/db.js";
import { hack, scpSetup, refresh, checkProgs, execScript } from "/lib/hack.js";


export async function main(ns) {

    // Prevent unnecessary debug
    ns.disableLog("ALL");
    ns.print("Starting c2...");

    ns.print("Loading scripts...");
    // Define shared scripts in use
    let hack_script = "/shared/hack.js";
    let grow_script = "/shared/grow.js";
    let weaken_script = "/shared/weaken.js";
    let share_script = "/shared/share.js";
    let script_list = [hack_script, grow_script, weaken_script, share_script];


    ns.print("Loading file handles...");
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

    ns.print("Loading progs...")
    // Handle progs
    // Array that contains an integer referencing how many programs I own
    let progsHandle = new arrayStore(ns, "/data/progs.txt");
    // List of all programs used for hacking
    let progsList = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"]
    let maxProgs = progsList.length;
    let progs = checkProgs(ns, progsList);
    ns.print("Progs: " + progs);
    // If progs are maxed, set it to false so it won't check later
    if (progs == maxProgs) {
        maxProgs = false;
        ns.print("Max Progs!")
    }
    await progsHandle.write(progs);

    ns.print("Loading database...");
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
        ns.print("Setting up scripts on: " + server);
        await scpSetup(ns, server, script_list);
    }

    // Set next hacking level goal
    ns.print("Loading goals...")
    // Get the current target's hacking level as a string
    let previousGoal = (db[target].requiredHackingSkill).toString();
    // Get the index of the next goal based on previous goal
    let goalIndex = difKeys.indexOf(previousGoal) + 1;
    // Get the level of the next goal
    let levelGoal = difKeys.at(goalIndex);
    // Save current target for later comparison
    let origTarget = target;



    ns.print("Loading server settings...")
    // Set initial private server RAM value
    let ram = 2;
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
    ns.print("Setting up pool of " + pool.length + " servers...");

    ns.print("Starting loop...");
    // eslint-disable-next-line no-constant-condition
    while (true) {

        ns.print("[.] Running loop...")
        // Count progs if they're not maxed
        if (maxProgs) {
            ns.print("Checking progs...");
            progs = checkProgs(ns, progsList);
            if (progs == maxProgs) {
                maxProgs = false;
            }
            // If there's new programs, re-hack
            if (progs != oldprogs) {
                runHack = true;
                oldprogs = progs;
                ns.print("New prog count: " + progs);
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
            ns.print("New hacking level target reached! Next Goal: " + levelGoal)
        }

        // If ordered, hack more things
        if (runHack) {
            ns.print("Running Hack function...");
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
                ns.print("Refreshing database...");
                // eslint-disable-next-line no-redeclare
                var { servers, db, hacked, difficulties, difKeys, target } = await refresh(ns, serverdb, dbHandle, hackedHandle, augHandle);
                if (target != origTarget) {
                    await targetHandle.write([target]);
                    ns.toast(`Changing target to ${target}!`, "info");
                    origTarget = target;
                }
            }
            // Set runHack status back to false
            runHack = false;
        }

        // If servers aren't maxed, consider upgrading
        if (!serversMaxed) {

            ns.print("Dealing with servers...");
            // Track if I buy something
            let didBuy = false;
            // Track if I quit because can't afford
            let poor = false;

            // If I'm not fully stocked
            if (!fullStock) {
                ns.print("Increasing stock of servers...");
                // Update variable
                privateServers = ns.getPurchasedServers();
                // While I can afford upgrades
                while ((0.10 * ns.getServerMoneyAvailable("home")) > ns.getPurchasedServerCost(ram)) {
                    let server = serversShoppingList.pop()
                    if (!server) break;
                    // If, against all odds, the server is already owned, then don't even try it
                    // Might happen if script is restarted
                    if (privateServers.includes(server)) {
                        continue;
                    }
                    let bought = ns.purchaseServer(server, ram);
                    if (bought != null) {
                        await scpSetup(ns, server, script_list);
                        didBuy = true;
                        ns.print("Purchased one server!");
                    } else {
                        // Else, if failed to buy, put it back in the list.
                        serversShoppingList.unshift(server);
                    }
                }
                if (serversShoppingList.length == 0) {
                    fullStock == true;
                    ns.print("Finished buying servers!");
                } else {
                    await purchaseHandle.write(ns.getPurchasedServerCost(ram));
                }
            }
            // If I have purchased all servers
            if (fullStock) {
                ns.print("Upgrading servers...");
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
                        ns.print("Too poor.");
                        await purchaseHandle.write(ns.getPurchasedServerUpgradeCost(server, ram));
                        break;
                    } else {
                        ns.upgradePurchasedServer(server, ram);
                        didBuy = true;
                        ns.print("Bought upgrade to " + ram + " GiB on " + server);
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
                ns.print("Servers maxed!");
                await purchaseHandle.write("Maxed");
            }
        }


        // Make a pool of all servers I can use
        pool = hacked.concat(privateServers);
        ns.print("Setting up pool of " + pool.length + " servers...");

        let poolRam = 0;
        for (let server of pool) {
            let freeRam = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
            poolRam += freeRam;
        }
        let poolThreads = (Math.floor(poolRam / script_ram[grow_script]));
        ns.print("Pool's RAM at: " + poolRam + " for " + poolThreads + " threads");

        let threadDict = {
            preWeaken: 0,
            grow: 0,
            postWeaken: 0,
            hack: 0
        };

        ns.print("Deciding on thread distribution for run...");
        ns.print("Analyze weaken...");
        // Get security levels
        let secLvl = ns.getServerSecurityLevel(target);
        let secMin = db[target].minDifficulty + 5;
        let secDiff = secLvl - secMin;
        // Calculate needed threads
        threadDict["preWeaken"] = Math.floor(secDiff / ns.weakenAnalyze(1));
        ns.print("Desired Threads: " + threadDict["preWeaken"]);

        ns.print("Analyze grow...");
        let money = ns.getServerMoneyAvailable(target);
        let moneyMax = db[target].moneyMax * 0.75;
        let growDiff = moneyMax / money;
        threadDict["grow"] = Math.floor(ns.growthAnalyze(target, growDiff));
        
        ns.print("Analyzing effect of grow...")
        let growEff = ns.growthAnalyzeSecurity(threadDict["grow"], target);
        threadDict["postWeaken"] = Math.floor(growEff / ns.weakenAnalyze(1));

        ns.print("Analyzing effective money stealing...")
        let threadPercent = ns.hackAnalyze(target);
        let hackThreads = 0.5 / threadPercent;
        threadDict["hack"] = Math.ceil(hackThreads);

        let desiredThreads = 0;

        for (let stage of Object.keys(threadDict)) {
            if (threadDict[stage] < 1) threadDict[stage] = 0;
            ns.print("Desired Threads in " + stage + ": " + threadDict[stage]);
            desiredThreads += threadDict[stage];
        }
        ns.print("Total desired threads: " + desiredThreads);
        ns.print("Total pool threads: " + poolThreads);

        // If you want more weaken threads than we have threads in general, just loop
        if (threadDict["preWeaken"] > (poolThreads * 0.5)) {
            ns.print("Weaken is more than 50% of the requirement, doing all weakens");
            for (let server of pool) {
                var [reuse, threads, pid] = execScript(ns, server, target, script_ram, weaken_script, 999999);
            }
            let sleepTime = ns.getWeakenTime(target);
            ns.print("Sleeping for delay of " + sleepTime + "ms");
            await ns.sleep(sleepTime);
            continue;
        }

        // If I don't have enough threads, scale it down
        if (desiredThreads > poolThreads) {
            ns.print("Scaling down threads to cluster...");
            let threadFactor = Math.ceil(desiredThreads / poolThreads);
            ns.print("Thread Factor: " + threadFactor);

            for (let stage of Object.keys(threadDict)) {
                threadDict[stage] = Math.ceil(threadDict[stage] / threadFactor);
                ns.print("Desired Threads in " + stage + ": " + threadDict[stage]);
            }
            ns.print("Threads scaled down...");

            desiredThreads = 0;
            for (let stage of Object.keys(threadDict)) {
                desiredThreads += threadDict[stage];
            }
            ns.print("Total desired threads: " + desiredThreads);
        }

        let delayDict = {
            preWeaken: 0,
            grow: 0,
            postWeaken: 0,
            hack: 0
        }

        let timeDict = {
            weaken: ns.getWeakenTime(target),
            grow: ns.getGrowTime(target),
            hack: ns.getHackTime(target)
        }

        ns.print("Setting up delays...");
        // No delay for first step
        delayDict["preWeaken"] = 10;

        // Delay second step by time of the first step plus 100ms, minus time required to complete
        delayDict["grow"] = timeDict["weaken"] + 100 - timeDict["grow"]
        // If that's a negative number somehow, or previous step has no threads, min delay
        if (delayDict["grow"] < 10 || threadDict["preWeaken"] < 1) delayDict["grow"] = 10;

        // Third Step
        delayDict["postWeaken"] = timeDict["grow"] + 100 + delayDict["grow"] - timeDict["weaken"];
        // If that's a negative number somehow, or previous step has no threads, min delay
        if (delayDict["postWeaken"] < 0 || threadDict["grow"] < 1) delayDict["postWeaken"] = 10;

        // Fourth Step
        delayDict["hack"] = timeDict["weaken"] + delayDict["postWeaken"] + 100 - timeDict["hack"];
        // If that's a negative number somehow, or previous step has no threads, min delay
        if (delayDict["hack"] < 0 || threadDict["postWeaken"] < 1) delayDict["hack"] = 10;

        for (let stage of Object.keys(delayDict)) {
            ns.print("Delay for stage " + stage + " is " + delayDict[stage] + "ms");
        }


        var poolIndex = 0;
        for (let stage of Object.keys(threadDict)) {
            let assigned = 0;
            if (poolThreads > 0) {
                ns.print("Sleeping for delay of " + delayDict[stage] + "ms");
                await ns.sleep(delayDict[stage]);
                ns.print("[!] poolIndex: " + poolIndex);
                ns.print("Assigning " + threadDict[stage] + " threads for " + stage);
                for (poolIndex; poolIndex < pool.length; poolIndex++) {
                    if (threadDict[stage] > 0) {
                        // ns.print(threadDict[stage] + " threads to be assigned...")
                        var [ reuse, threads, pid ] = execScript(ns, pool[poolIndex], target, script_ram, weaken_script, threadDict[stage]);
                        if (reuse) {
                            poolIndex--;
                        }
                        assigned += threads;
                        poolThreads -= threads;
                        threadDict[stage] -= threads;
                    } else {
                        break;
                    }
                }
                ns.print("Assigned threads: " + assigned);
            } else {
                break;
            }
        }

        let sleepTime = 500 + timeDict["hack"];
        ns.print("Sleeping for " + sleepTime + "ms");
        // No errors
        await ns.sleep(sleepTime);
    }
}