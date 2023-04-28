/** @param {NS} ns */
export async function main(ns) {
    var ram = 1024;
    var hack_script = "ez-hack.js"
    var hackTarget = "computek";
    let hack_ram = ns.getScriptRam(hack_script);

    var i = 0;
    for (let hostname of ns.getPurchasedServers()) {
        let freeRam = ns.getServerMaxRam(hostname);
        let hackThreads = (Math.floor(freeRam / hack_ram));
        ns.killall(hostname);
        ns.rm(hack_script, hostname)
        await ns.scp(hack_script, hostname);
        ns.exec(hack_script, hostname, hackThreads, hackTarget);
        ++i;
    }
    while (i < ns.getPurchasedServerLimit()) {
        if (ns.getServerMoneyAvailable("home") > ns.getPurchasedServerCost(ram)) {
            var hostname = ns.purchaseServer("server-" + i, ram);
            let freeRam = ns.getServerMaxRam(hostname);
            let hackThreads = (Math.floor(freeRam / hack_ram));
            await ns.scp(hack_script, hostname);
            ns.exec(hack_script, hostname, hackThreads, hackTarget);
            ++i;
        } else {
            await ns.sleep(60000);
        }
    }
}