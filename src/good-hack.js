/** @param {NS} ns */
import { arrayStore } from "/lib/db.js";
export async function main(ns) {
    let targetHandle = new arrayStore(ns, "/data/target.txt");
    // Define shared scripts in use
    let hack_script = "/shared/hack.js";
    let grow_script = "/shared/grow.js";
    let weaken_script = "/shared/weaken.js";
    let script_list = [hack_script, grow_script, weaken_script];
    // Setup RAM required for each script
    let script_ram = {};
    for (let script of script_list) {
        script_ram[script] = ns.getScriptRam(script);
    }
    let target = await targetHandle.read();
    target = target[0];
    let server = ns.getHostname();
    let origTarget = target;
    let moneyThresh = ns.getServerMaxMoney(target) * 0.75;
    let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    let runScript = weaken_script;

    while (true) {
        target = await targetHandle.read();
        target = target[0];
        if (target != origTarget) {
            origTarget = target;
            moneyThresh = ns.getServerMaxMoney(target) * 0.75;
            securityThresh = ns.getServerMinSecurityLevel(target) + 5;
        }
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
        if (hackThreads > 0) {
            ns.exec(runScript, server, hackThreads, target);
        }
        // No errors
        await ns.sleep(5000);
    }
}