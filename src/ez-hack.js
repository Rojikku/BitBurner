/** @param {NS} ns */
export async function main(ns) {
    let target = ns.args[0];
    let moneyThresh = ns.getServerMaxMoney(target) * 0.75;
    let securityThresh = ns.getServerMinSecurityLevel(target) + 5;
    let loop = !(ns.fileExists("serv-die.txt", "home"));
    while (loop) {
        if (ns.getServerSecurityLevel(target) > securityThresh) {
            await ns.weaken(target);
        } else if (ns.getServerMoneyAvailable(target) < moneyThresh) {
            await ns.grow(target);
        } else {
            await ns.hack(target);
        }
        loop = !(ns.fileExists("serv-die.txt", "home"));
    }
}