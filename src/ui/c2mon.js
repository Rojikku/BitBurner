/** @param {NS} ns **/
// Load Libraries
import { createSidebarItem, sidebar } from "/box/box.js"
import { arrayStore, dictStore } from "/lib/db.js";

export async function main(ns) {

    // Load list of hacked servers
    let hackedHandle = new arrayStore(ns, "/data/hacked.txt");
    // File that lists the next target of hacking
    let targetHandle = new arrayStore(ns, "/data/target.txt");

    let style = `<style>
    .f.mon {
        display:flex;
        flex-direction: column;
        flex-basis: auto;
        height: 20em;
        padding: 10px;
    }
    .f.mon>span {
        color:lightgrey;
        font-size: 1.6em;
        padding: 0px;
        margin: 0px;
    }
    </style>`
    let item = createSidebarItem("C2 Monitor", `
    ${style}
    <div class="f mon" id="c2mon">
    </div>`, "&#xEEBF");
    let running = true;
    while (running) {
        if (!sidebar.contains(item)) running = false;
        let target = await targetHandle.read();
        target = ns.getServer(target[0]);
        let hacked = await hackedHandle.read();
        let servers = ns.getPurchasedServers()
        let moneyThresh = ns.formatNumber(target.moneyMax * 0.75);
        item.querySelector('#c2mon').innerHTML = `
        <span style="color:lime;">Target:<br /> ${target.hostname}</span><br />
        <span style="color:lime;">T Money:<br /> \$${ns.formatNumber(target.moneyAvailable)}/${moneyThresh}</span><br />
        <span style="color:red;">T Diff:<br /> ${ns.formatNumber(target.hackDifficulty, 0)}/${ns.formatNumber(target.minDifficulty + 5, 0)}</span><br />
        <span>Servers Hacked: ${hacked.length}</span><br />
        <span>Servers: ${servers.length}/${ns.getPurchasedServerLimit()}</span>
        `;
        await ns.sleep(1000);
    }
}