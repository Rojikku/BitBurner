/** @param {NS} ns */
export async function main(ns) {
    let c2 = ns.ls("home", "c2/");
    for (let server of c2) {
        ns.rm(server);
    }
}