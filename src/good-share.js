/** @param {NS} ns */
export async function main(ns) {
    let hack_ram = 4;
    let this_script_ram = 3.75;
    let hostname = ns.getHostname();
    let freeRam = ((ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)) + this_script_ram);
    let hack_script = "ez-share.js";
    let hackThreads = (Math.floor(freeRam / hack_ram));
    ns.tprint(`${hostname} has ${freeRam} of RAM, creating ${hackThreads}...`)
    if (hackThreads >= 0) {
        ns.tprint(`I will now run ${hack_script} with ${hackThreads} threads!`)
        ns.spawn(hack_script, hackThreads);
    } else {
        ns.tprint("Epic fail, it's >= 0!")
    }
}